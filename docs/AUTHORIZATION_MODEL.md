# AegisPulse Authorization & Identity Model

## 1. Authentication Architecture

AegisPulse employs a cryptographically secure, stateless token and session lifecycle built on Node.js native `node:crypto` HMAC-SHA256 (JWT-compliant).

```
   [ Clinician Client / Bedside Tablet ]
                  │
                  ▼  POST /api/v1/auth/login
       ┌──────────────────────────────┐
       │     AegisPulse API Gateway   │
       └──────────────┬───────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
 ┌──────────────┐            ┌──────────────┐
 │ Access Token │            │ Refresh Token│
 │  TTL: 15 min │            │  TTL: 7 days │
 └──────────────┘            └──────────────┘
```

### 1.1 Token Structure & Claims

Tokens consist of standard base64url-encoded segments: `header.payload.signature`.

```json
{
  "sub": "usr-nurse-101",
  "username": "nurse",
  "fullName": "Sarah Jenkins, RN",
  "role": "WARD_NURSE",
  "assignedWardIds": ["WARD-A"],
  "type": "access",
  "jti": "8f3b2a1c0d4e5f6a7b8c9d0e1f2a3b4c",
  "iat": 1789460000,
  "exp": 1789460900
}
```

| Claim | Type | Description |
| :--- | :--- | :--- |
| `sub` | `string` | Unique User Identifier (`userId`) |
| `username` | `string` | Clinician system login handle |
| `fullName` | `string` | Clinician clinical display name |
| `role` | `UserRole` | Explicit clinical authorization role |
| `assignedWardIds` | `string[]` | Authorized ward clinical jurisdictions (e.g. `['WARD-A']` or `['*']`) |
| `type` | `string` | Token classification: `'access'` (15m) or `'refresh'` (7d) |
| `jti` | `string` | Unique token instance UUID used for revocation and logout tracking |
| `iat` | `number` | Issued-at Unix epoch timestamp |
| `exp` | `number` | Expiration Unix epoch timestamp |

### 1.2 Cryptographic Verification

- **Algorithm:** HMAC-SHA256 (`HS256`).
- **Signing Secret:** 256-bit CSPRNG `JWT_SECRET` configured in environment.
- **Timing-Safe Comparison:** Signatures are evaluated via `crypto.timingSafeEqual()` to prevent timing side-channel attacks.

---

## 2. Session Lifecycle & Token Management

### 2.1 Login Flow (`POST /api/v1/auth/login`)
- Accepts `{ username, password }`.
- Verifies hashed credentials against salted storage using timing-safe buffer comparison.
- Issues paired tokens:
  - **Access Token:** Short-lived (15 minutes / 900 seconds) for routine API requests.
  - **Refresh Token:** Long-lived (7 days / 604,800 seconds) retained securely for session renewal.

### 2.2 Refresh Flow (`POST /api/v1/auth/refresh`)
- Accepts `{ refreshToken }`.
- Validates signature, verifies `type === 'refresh'`, confirms expiration is in the future, and ensures token is not revoked.
- Issues a freshly signed access token without requiring re-entry of clinical credentials.

### 2.3 Logout & Revocation Flow (`POST /api/v1/auth/logout`)
- Extracts Bearer token from the request header.
- Blacklists the unique token identifier (`jti`) in the `TokenRevocationStore`.
- Any subsequent request bearing the revoked token is rejected with **HTTP 401 Unauthorized**.

### 2.4 Password Complexity Policy
- **Minimum Length:** 8 characters.
- **Character Requirements:** Must contain at least one alphabetical letter and at least one numeric digit.

---

## 3. Explicit Roles & Privilege Hierarchy

The platform defines 6 distinct roles with mutually enforced clinical boundaries:

```
                  ┌──────────────────────┐
                  │    ADMIN / SYSTEM    │  (Hospital-Wide Jurisdiction: ['*'])
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │  ATTENDING_PHYSICIAN │  (Multi-Ward Specialist Authority)
                  └──────────┬───────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌──────────────────┐                   ┌────────────────────┐
│   CHARGE_NURSE   │                   │ RESIDENT_PHYSICIAN │
└────────┬─────────┘                   └─────────┬──────────┘
         │                                       │
         └───────────────────┬───────────────────┘
                             ▼
                    ┌──────────────────┐
                    │    WARD_NURSE    │  (Unit-Specific Bedside Jurisdiction)
                    └──────────────────┘
```

| Role | Scope & Authority | Allowed Actions | Restricted Actions |
| :--- | :--- | :--- | :--- |
| **`WARD_NURSE`** | Bedside clinical care within assigned wards. | View assigned ward patients, vitals, timeline; ingest observations; acknowledge alerts; perform routine actions. | Cannot access other wards; cannot execute administrative simulation/chaos commands. |
| **`CHARGE_NURSE`** | Shift supervisory oversight across assigned units. | All Ward Nurse actions + multi-bed priority review, care escalation, and unit-level workflow audits. | Cannot run platform configuration changes or simulation tools. |
| **`RESIDENT_PHYSICIAN`** | Junior medical officer evaluation. | Review clinical vitals, copilot insights, and update clinical action statuses across assigned units. | Limited to assigned clinical services. |
| **`ATTENDING_PHYSICIAN`** | Senior medical staff with comprehensive clinical authority. | Full clinical actions, medication orders, diagnostic reviews, and copilot queries across assigned wards. | Cannot access administrative system management endpoints. |
| **`ADMIN`** | Hospital IT & System Administrator. | Simulation scenarios, chaos engineering, database maintenance, user provisioning across all wards (`*`). | Prohibited from altering patient clinical records without audit trail. |
| **`SYSTEM`** | Core internal daemon service engine. | Automated simulation clock ticks, pipeline telemetry streaming, batch synchronization. | Internal service engine only. |

---

## 4. Multi-Tenant Jurisdiction Isolation (WBAC)

AegisPulse enforces **Ward-Based Access Control (WBAC)** and **Patient-Scoped Access Control** strictly on the server:

### 4.1 Ward-Level Permissions (`requireWardAccess`)
- Clinicians only hold access to wards listed in their `assignedWardIds` (e.g. `['WARD-A']`).
- Requests targeting a ward outside their assignment return **HTTP 403 Forbidden**:
  ```json
  {
    "type": "https://aegispulse.internal/errors/FORBIDDEN",
    "title": "Forbidden",
    "status": 403,
    "detail": "Unauthorized ward access: User 'nurse' is not assigned to ward 'WARD-4B'. Clinical jurisdiction denied.",
    "code": "FORBIDDEN"
  }
  ```

### 4.2 Patient-Level Permissions (`requirePatientWardAccess`)
- Before querying or modifying a patient resource (`/api/v1/patients/:patientId/...`), the middleware resolves the patient's assigned ward from the persistence layer.
- If the patient is admitted to a ward outside the clinician's jurisdiction, the server rejects the request with **HTTP 403 Forbidden**.
- Prevents horizontal privilege escalation and cross-ward data leakage.

### 4.3 Server-Side Enforcement Guarantee

> [!CAUTION]
> **Zero Reliance on Frontend Visibility:**
> Frontend UI controls (buttons, tabs, patient cards) may hide unauthorized options for user experience, but **ALL access boundaries are authoritatively enforced on the backend**. Bypassing the frontend via direct API calls (`curl`, Postman) strictly encounters HTTP 401 or HTTP 403 rejections.

---

## 5. Security Threat Mitigation Matrix

| Threat Vector | Severity | Mitigation Strategy | Tested HTTP Status |
| :--- | :---: | :--- | :---: |
| **Unauthenticated Access** | P0 | Centralized `authenticate()` middleware requires valid `Authorization: Bearer <token>`. | **`401 Unauthorized`** |
| **Expired Sessions** | P0 | `tokenService.verifyToken()` evaluates `now > exp` and rejects stale access tokens. | **`401 Unauthorized`** |
| **Invalid / Forged Credentials** | P0 | Timing-safe HMAC-SHA256 signature verification rejects forged or tampered tokens. | **`401 Unauthorized`** |
| **Privilege Escalation (Vertical)** | P0 | `requireRole(['ADMIN', 'SYSTEM'])` restricts privileged endpoints; non-admins are blocked. | **`403 Forbidden`** |
| **Cross-Ward Access (Horizontal)** | P1 | `requirePatientWardAccess()` checks patient admitted ward against clinician assigned wards. | **`403 Forbidden`** |
| **Revoked Session / Post-Logout** | P1 | `tokenRevocationStore` blacklists `jti`; subsequent requests with logged-out token fail. | **`401 Unauthorized`** |
| **Unauthorized User / Zero Jurisdiction** | P1 | Users with empty `assignedWardIds: []` cannot access any clinical wards or patient records. | **`403 Forbidden`** |
| **Stale Refresh Tokens** | P1 | Refresh tokens expire after 7 days and cannot be reused once revoked. | **`401 Unauthorized`** |

---

## 6. Provisioned Test Users & Access Boundaries

The platform provisions four standard test accounts to audit and verify all access boundaries:

| Username | Password | Full Name | Role | Assigned Wards | Boundary Characteristics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`nurse`** | `NursePass123!` | Sarah Jenkins, RN | `WARD_NURSE` | `['WARD-A']` | Restricted strictly to Ward A. Cross-ward access (Ward 4B) and administrative endpoints are strictly forbidden (403). |
| **`doctor`** | `DoctorPass123!` | Dr. Elena Rostova, MD | `ATTENDING_PHYSICIAN` | `['WARD-A', 'WARD-4B']` | Multi-ward clinical oversight across Ward A and Ward 4B. Administrative endpoints are strictly forbidden (403). |
| **`administrator`** (alias: `admin`) | `AdminPass123!` | Aegis System Administrator | `ADMIN` | `['*']` | Wildcard jurisdiction across all hospital wards; authorized to trigger simulation scenarios and system maintenance. |
| **`unauthorized user`** (alias: `guest`, `unauthorized`) | `GuestPass123!` | Unauthorized Guest Account | `WARD_NURSE` | `[]` | Zero clinical ward jurisdiction. Any attempt to query ward or patient endpoints is strictly forbidden (403). |

### 6.1 Executing the Manual Verification Suite

To manually audit and verify all 22 live access boundaries against an active server instance:

```bash
npx tsx scripts/verify-access-boundaries.ts
```

### 6.2 Executing the Automated Vitest Suite

To execute the 18 automated security test suites:

```bash
npx vitest run services/api/tests/identity-access-control.test.ts
```

