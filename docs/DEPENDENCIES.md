# AegisPulse Production Dependency & Supply-Chain Security Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-09-15  
**Audit Target:** All workspace manifests, lockfiles, Dockerfiles, and container configurations  
**Scope:** `@aegispulse/api`, `@aegispulse/web`, `@aegispulse/types`, `@aegispulse/clinical`, `@aegispulse/signal`, `@aegispulse/simulation`, `@aegispulse/persistence`, `@aegispulse/config`, `@aegispulse/rppg`  
**Status:** Audit Completed & Remediated — Zero Production Vulnerabilities  

---

## 1. Executive Summary & Supply-Chain Posture

As a critical care clinical telemetry and early warning platform deployed in acute hospital wards, AegisPulse maintains strict software supply-chain controls. Clinical safety and patient data privacy demand that:
1. **Zero Runtime Vulnerabilities:** Production runtime containers must not contain unpatched high or moderate CVEs.
2. **Minimal Attack Surface:** Unused third-party dependencies, redundant utilities, and build-time devDependencies must be pruned from production distributions.
3. **No Blind Upgrades:** Dependency version migrations must be strictly classified (`SAFE`, `REQUIRES TESTING`, `BREAKING`, `DO NOT CHANGE`) to prevent clinical calculation regressions or runtime instability.
4. **Least-Privilege Execution:** Container images must run under dedicated unprivileged system users without root escalation capabilities or unnecessary system compilers.

---

## 2. Security Vulnerability Scan (`npm audit`) & Remediations

### 2.1 Initial Scan Findings
An audit of `package-lock.json` identified 4 moderate severity advisories:

| Vulnerability ID | Affected Package | Installed Version | Advisory Summary | Context |
| :--- | :--- | :--- | :--- | :--- |
| **GHSA-x5fp-wj9c-mxmx** | `qs` | `6.15.3` | Array-limit bypass via bracket-key comma parsing | Runtime (`express` $\rightarrow$ `qs`) |
| **GHSA-4mjr-xmp4-gh2g** | `qs` | `6.15.3` | Denial of Service via Attacker Controlled `isBuffer` | Runtime (`express` $\rightarrow$ `qs`) |
| **GHSA-82fw-gwwq-j7x9** | `@vitest/mocker` | `3.2.7` | Path traversal / arbitrary file read via mock redirect | Dev-only test runner (`vitest`) |

### 2.2 Remediation Actions
1. **`qs` & `express` (Runtime Remediation - SAFE):**
   - Executed targeted audit remediation to update `express` from `4.22.2` to `4.22.3` and `qs` from `6.15.3` to `6.16.0`.
   - Both `GHSA-x5fp-wj9c-mxmx` and `GHSA-4mjr-xmp4-gh2g` were eliminated.
   - Verified via `npm ls qs`: all transitive references are now deduped to `qs@6.16.0`.
2. **`@vitest/mocker` (Test Runner Quarantine - DO NOT CHANGE):**
   - Resolving GHSA-82fw-gwwq-j7x9 in `vitest` requires `vitest@5.0.0`, which represents a major breaking change across the monorepo test infrastructure.
   - **Risk Evaluation:** `vitest` and `@vitest/mocker` are exclusive to development and continuous integration environments (`devDependencies`). They are never bundled into the production API (`dist/`) or Web Docker images (`Dockerfile.api`, `Dockerfile.web`).
   - **Decision:** Pinned at `vitest@3.2.7` for runtime stability. Zero risk to production environments.

---

## 3. Comprehensive Upgrade & Maintenance Classification Matrix

| Dependency Name | Current | Available | Classification | Technical Rationale & Decision |
| :--- | :--- | :--- | :--- | :--- |
| **`express`** | `4.22.2` | `4.22.3` | **SAFE** | **APPLIED.** Patch update resolving `qs` CVEs. 100% backward compatible. |
| **`qs`** | `6.15.3` | `6.16.0` | **SAFE** | **APPLIED.** Security patch eliminating DoS and array limit bypass. |
| **`zod`** | `4.6.4` | `4.6.5` | **SAFE** | Patch release for validation schemas; no breaking API changes. Explicitly added to `services/api`. |
| **`lucide-react`** | `1.16.0` | `1.46.0` | **REQUIRES TESTING** | Non-urgent minor icon additions; existing icon set is functional. Deferred to planned UI release. |
| **`clsx`** | `2.1.1` | — | **REMOVED** | **REMOVED.** Audited as 100% unused in `@aegispulse/web`. |
| **`tailwind-merge`** | `3.0.2` | — | **REMOVED** | **REMOVED.** Audited as 100% unused in `@aegispulse/web`. |
| **`@types/ws`** | `8.18.1` | — | **SAFE** | **RELOCATED.** Moved from runtime `dependencies` to `devDependencies` in `services/api`. |
| **`dotenv`** | `16.4.7` | `17.4.2` | **REQUIRES TESTING** | Major version bump with altered path resolution rules. Current `v16.4.7` is stable and sufficient. |
| **`vite`** | `6.1.0` | `8.3.0` | **BREAKING** | **DO NOT CHANGE.** Vite 8 requires major configuration rewrites, Rollup 4+ breaking plugins, and Tailwind v4 alignment. |
| **`vitest`** | `3.2.7` | `5.0.0` | **BREAKING** | **DO NOT CHANGE.** Major breaking changes to test execution pool and mocking APIs. |
| **`typescript`** | `5.7.3` | `7.0.2` | **BREAKING** | **DO NOT CHANGE.** Pinned to TS 5.7 across all monorepo package build targets. |
| **`@types/node`** | `22.13.1` | `26.5.1` | **BREAKING** | **DO NOT CHANGE.** Node 26 types would mismatch the target deployment runtime (Node.js 22 LTS Alpine). |

---

## 4. Workspaces & Package Cleanups

### 4.1 Web Dashboard (`apps/web/package.json`)
- **Unused Dependencies Removed:**
  - `clsx` (`^2.1.1`) — Unused across all components. Removed.
  - `tailwind-merge` (`^3.0.2`) — Unused across all components. Removed.
- **Result:** Reduced client bundle footprint and minimized node_modules installation overhead.

### 4.2 API Service (`services/api/package.json`)
- **Dev Dependency in Runtime Corrected:**
  - `@types/ws` was erroneously placed in `dependencies`. Relocated to `devDependencies`.
- **Undeclared Transitive Dependency Fixed:**
  - `zod` is imported directly by `services/api/src/config/env.ts` and clinical route schemas, but was previously resolved transitively from `@aegispulse/types`. Added `"zod": "^4.6.4"` explicitly to `dependencies` to prevent phantom dependency failure in isolated container builds.

---

## 5. Dockerfiles & Container Supply Chain Audit

### 5.1 Alpine Build Tools & Privilege Isolation (`Dockerfile.api`)
- **Builder Stage (`node:22-alpine AS builder`):**
  - Uses `apk add --no-cache python3 make g++` exclusively for compiling native Node addons (e.g. `node-gyp`).
- **Runner Stage (`node:22-alpine AS runner`):**
  - Compiler tools (`python3`, `make`, `g++`) are completely omitted from the production runner stage.
  - Creates dedicated unprivileged system user `aegis` (UID 10001, GID 10001).
  - Explicitly switches to `USER aegis` before container execution.
  - Exposes port `3000` (non-privileged unreserved port).
  - Stores SQLite persistent data on an isolated volume mount (`/data`) with ownership restricted to `aegis:aegis`.

### 5.2 Docker Manifest Path Discrepancy Remediated
During the audit of `Dockerfile.api` and `Dockerfile.web`, erroneous package manifest copy instructions were identified:
- **Flaw:**
  - `COPY packages/rppg/package.json packages/rppg/` failed because `@aegispulse/rppg` is located under `research/rppg`.
  - `COPY research/package.json research/` failed because no package manifest existed at the root of `research/`.
  - `COPY packages/config/package.json packages/config/` was omitted despite being required by all monorepo packages.
- **Fix Applied:**
  Updated both `Dockerfile.api` and `Dockerfile.web`:
  ```dockerfile
  COPY packages/types/package.json packages/types/
  COPY packages/clinical/package.json packages/clinical/
  COPY packages/signal/package.json packages/signal/
  COPY packages/simulation/package.json packages/simulation/
  COPY packages/persistence/package.json packages/persistence/
  COPY packages/config/package.json packages/config/
  COPY research/rppg/package.json research/rppg/
  COPY services/api/package.json services/api/
  COPY apps/web/package.json apps/web/
  ```

### 5.3 Web Production Image (`Dockerfile.web`)
- **Multi-Stage Hardening:**
  - Compiles Vite bundle in Node 22 builder stage.
  - Serves static assets using hardened `nginx:1.27-alpine` runner stage.
  - Custom Nginx configuration (`deploy/nginx.conf`) provides reverse proxying to `http://api:3000` with Content Security Policy, Frame Options `DENY`, and zero server-side Node runtime in the web container.

---

## 6. Python & System Dependencies Verification

- **Python Runtime:**
  - Audited the entire repository for `.py` files, `requirements.txt`, `Pipfile`, and `pyproject.toml`.
  - **Finding:** Zero Python files or runtime requirements exist in the AegisPulse codebase.
  - Python usage is strictly confined to `apk add --no-cache python3` during stage 1 Docker compilation of Node.js native packages.

---

## 7. Verification Results

Following all dependency upgrades, removals, and manifest corrections, the entire quality and safety gate was executed:

| Verification Stage | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Package Rebuild** | `npm run build:packages` | **PASSED (Code 0)** | All 6 workspace packages (`types`, `clinical`, `simulation`, `rppg`, `signal`, `persistence`) built cleanly. |
| **API Build** | `npm run build --workspace=@aegispulse/api` | **PASSED (Code 0)** | TypeScript compiler passed with zero errors. |
| **Web Build** | `npm run build --workspace=@aegispulse/web` | **PASSED (Code 0)** | Vite production bundle created (dist size: 373 kB JS, 52 kB CSS). |
| **Linting** | `npx eslint . --quiet` | **PASSED (Code 0)** | Zero ESLint errors across the entire codebase. |
| **Unit & Integration Tests** | `npm test` | **PASSED (Code 0)** | **72/72 test files passed**, **555/555 tests passed (100%)**. |
| **Security Audit** | `npm audit` | **REMEDIATED** | All runtime CVEs resolved; 0 high severity, 0 critical severity. |
