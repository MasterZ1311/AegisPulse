export type Environment = 'development' | 'test' | 'staging' | 'production' | 'demo';

export interface AppConfig {
  nodeEnv: Environment;
  port: number;
  host: string;
  dbPath: string;
  jwtSecret: string;
  corsOrigins: string[];
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  broadcasterBufferCapacity: number;
  syncMaxKeyHistory: number;
  requestTimeoutMs: number;
  allowDevTestTokens: boolean;
  allowHeaderAuth: boolean;
  silentLogs: boolean;
}

const INSECURE_JWT_PLACEHOLDERS = new Set([
  'replace_with_a_cryptographically_secure_random_string_in_production',
  'your-super-secret-256bit-key-change-in-production',
  'secret',
  'jwt_secret',
  'change_me',
  'password',
]);

export class ConfigurationError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.errors = errors;
  }
}

/**
 * Validates and loads application configuration according to the active environment.
 * In PRODUCTION or STAGING:
 *   - Mandatory secrets (JWT_SECRET) must be set and meet minimum 256-bit entropy.
 *   - CORS origins must be explicitly specified (wildcard '*' and localhost are strictly forbidden).
 *   - Database path must be non-volatile (must not be ':memory:').
 *   - Insecure development flags (ALLOW_DEV_TEST_TOKENS, ALLOW_HEADER_AUTH) must be false.
 * In DEVELOPMENT, TEST, or DEMO:
 *   - Safe default values are provided so local development works seamlessly out of the box.
 */
export function validateConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const errors: string[] = [];

  const rawNodeEnv = (env.NODE_ENV || 'development').toLowerCase() as Environment;
  const isProd = rawNodeEnv === 'production' || rawNodeEnv === 'staging';

  // 1. Validate PORT
  let port = 3001;
  if (env.PORT) {
    const parsedPort = parseInt(env.PORT, 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      errors.push(`PORT must be a valid integer between 1 and 65535 (received: '${env.PORT}').`);
    } else {
      port = parsedPort;
    }
  }

  // 2. Validate HOST
  const host = env.HOST || (isProd ? '0.0.0.0' : 'localhost');

  // 3. Validate AEGIS_DB_PATH
  let dbPath = env.AEGIS_DB_PATH || env.DATABASE_PATH;
  if (!dbPath) {
    if (isProd) {
      errors.push("AEGIS_DB_PATH is REQUIRED in production/staging (cannot default to in-memory storage; data will be lost on container restart). Set AEGIS_DB_PATH to a persistent volume path like '/data/aegispulse.db'.");
    } else {
      dbPath = ':memory:';
    }
  } else if (isProd && dbPath === ':memory:') {
    errors.push("AEGIS_DB_PATH cannot be ':memory:' in production/staging. Clinical persistence requires a persistent file or mounted volume path.");
  }

  // 4. Validate JWT_SECRET
  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProd) {
      errors.push("JWT_SECRET is REQUIRED in production/staging. Provide a cryptographically secure string with minimum 32 characters (256 bits).");
    } else {
      jwtSecret = 'dev-insecure-local-jwt-secret-minimum-32-chars-ok';
    }
  } else if (isProd) {
    if (jwtSecret.length < 32) {
      errors.push(`JWT_SECRET must be at least 32 characters (256 bits) for cryptographic security (current length: ${jwtSecret.length}).`);
    }
    if (INSECURE_JWT_PLACEHOLDERS.has(jwtSecret.trim())) {
      errors.push("JWT_SECRET is set to an insecure example placeholder. You must generate a unique, cryptographically random secret (e.g. `openssl rand -base64 32`).");
    }
  }

  // 5. Validate CORS_ORIGIN
  const rawCors = env.CORS_ORIGIN || env.ALLOWED_ORIGINS;
  let corsOrigins: string[] = [];

  if (!rawCors) {
    if (isProd) {
      errors.push("CORS_ORIGIN is REQUIRED in production/staging. Set CORS_ORIGIN to explicit authorized hospital frontend origin(s), e.g. 'https://aegispulse.hospital.org'.");
    } else {
      corsOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
    }
  } else {
    corsOrigins = rawCors.split(',').map((o) => o.trim()).filter(Boolean);
    if (isProd) {
      if (corsOrigins.includes('*')) {
        errors.push("CORS_ORIGIN cannot be wildcard '*' in production/staging. Telemetry and Protected Health Information (PHI) cannot be exposed to arbitrary web origins.");
      }
      const hasLocalhost = corsOrigins.some((o) => o.includes('localhost') || o.includes('127.0.0.1'));
      if (hasLocalhost) {
        errors.push("CORS_ORIGIN in production/staging cannot contain 'localhost' or '127.0.0.1'. Must use valid HTTPS production domain(s).");
      }
    }
  }

  // 6. Validate ALLOW_DEV_TEST_TOKENS and ALLOW_HEADER_AUTH
  const allowDevTestTokens = env.ALLOW_DEV_TEST_TOKENS === 'true';
  const allowHeaderAuth = env.ALLOW_HEADER_AUTH === 'true';

  if (isProd) {
    if (allowDevTestTokens) {
      errors.push("ALLOW_DEV_TEST_TOKENS MUST NOT be true in production/staging. This flag disables token verification and allows arbitrary role escalation ('role:<ROLE>').");
    }
    if (allowHeaderAuth) {
      errors.push("ALLOW_HEADER_AUTH MUST NOT be true in production/staging. This flag allows arbitrary user impersonation via unverified HTTP headers ('x-user-role', 'x-user-id').");
    }
  }

  // 7. Parse auxiliary tuning values
  const rateLimitWindowMs = env.RATE_LIMIT_WINDOW_MS ? parseInt(env.RATE_LIMIT_WINDOW_MS, 10) : 60000;
  const rateLimitMaxRequests = env.RATE_LIMIT_MAX_REQUESTS ? parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10) : 300;
  const broadcasterBufferCapacity = env.BROADCASTER_BUFFER_CAPACITY ? parseInt(env.BROADCASTER_BUFFER_CAPACITY, 10) : 1000;
  const syncMaxKeyHistory = env.SYNC_MAX_KEY_HISTORY ? parseInt(env.SYNC_MAX_KEY_HISTORY, 10) : 10000;
  const requestTimeoutMs = env.REQUEST_TIMEOUT_MS ? parseInt(env.REQUEST_TIMEOUT_MS, 10) : 30000;
  const logLevel = env.LOG_LEVEL || (isProd ? 'info' : 'debug');
  const silentLogs = env.SILENT_LOGS === 'true';

  if (errors.length > 0) {
    const errorList = errors.map((e, idx) => `  ${idx + 1}. ${e}`).join('\n');
    throw new ConfigurationError(
      `[AegisPulse Configuration Error] Startup failed due to ${errors.length} configuration violations:\n${errorList}\n\nPlease update your environment variables or runtime secret injection before launching.`,
      errors
    );
  }

  return {
    nodeEnv: rawNodeEnv,
    port,
    host,
    dbPath: dbPath || ':memory:',
    jwtSecret: jwtSecret || 'dev-insecure-local-jwt-secret-minimum-32-chars-ok',
    corsOrigins,
    logLevel,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    broadcasterBufferCapacity,
    syncMaxKeyHistory,
    requestTimeoutMs,
    allowDevTestTokens,
    allowHeaderAuth,
    silentLogs,
  };
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = validateConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
