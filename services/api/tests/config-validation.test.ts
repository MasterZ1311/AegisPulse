import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import http from 'node:http';
import { validateConfig, ConfigurationError, resetConfigCache, getConfig } from '../src/config/env';

describe('Configuration Validation Layer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfigCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfigCache();
  });

  describe('Development & Test Defaults', () => {
    it('should successfully load default config without any environment variables', () => {
      const config = validateConfig({});
      expect(config.nodeEnv).toBe('development');
      expect(config.port).toBe(3001);
      expect(config.host).toBe('localhost');
      expect(config.dbPath).toBe(':memory:');
      expect(config.jwtSecret).toBeDefined();
      expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
      expect(config.corsOrigins).toContain('http://localhost:5173');
      expect(config.allowDevTestTokens).toBe(false);
      expect(config.allowHeaderAuth).toBe(false);
    });

    it('should allow dev flags when explicitly enabled in development', () => {
      const config = validateConfig({
        NODE_ENV: 'development',
        ALLOW_DEV_TEST_TOKENS: 'true',
        ALLOW_HEADER_AUTH: 'true',
      });
      expect(config.allowDevTestTokens).toBe(true);
      expect(config.allowHeaderAuth).toBe(true);
    });

    it('should respect custom PORT and AEGIS_DB_PATH in development', () => {
      const config = validateConfig({
        PORT: '4000',
        AEGIS_DB_PATH: './test.db',
      });
      expect(config.port).toBe(4000);
      expect(config.dbPath).toBe('./test.db');
    });

    it('should reject invalid PORT numbers', () => {
      expect(() => validateConfig({ PORT: '999999' })).toThrow(ConfigurationError);
      expect(() => validateConfig({ PORT: 'invalid' })).toThrow(ConfigurationError);
    });
  });

  describe('Production & Staging Hardening Restrictions', () => {
    const validProdEnv = {
      NODE_ENV: 'production',
      PORT: '3000',
      AEGIS_DB_PATH: '/data/aegispulse.db',
      JWT_SECRET: 'production-super-secure-token-signing-key-32chars+',
      CORS_ORIGIN: 'https://aegis.hospital.org,https://icu-dash.hospital.org',
      ALLOW_DEV_TEST_TOKENS: 'false',
      ALLOW_HEADER_AUTH: 'false',
    };

    it('should successfully validate when all production prerequisites are met', () => {
      const config = validateConfig(validProdEnv);
      expect(config.nodeEnv).toBe('production');
      expect(config.port).toBe(3000);
      expect(config.host).toBe('0.0.0.0');
      expect(config.dbPath).toBe('/data/aegispulse.db');
      expect(config.corsOrigins).toEqual([
        'https://aegis.hospital.org',
        'https://icu-dash.hospital.org',
      ]);
      expect(config.allowDevTestTokens).toBe(false);
      expect(config.allowHeaderAuth).toBe(false);
    });

    it('should fail when JWT_SECRET is absent in production', () => {
      const env = { ...validProdEnv, JWT_SECRET: '' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('JWT_SECRET is REQUIRED')])
        );
      }
    });

    it('should fail when JWT_SECRET is less than 32 characters in production', () => {
      const env = { ...validProdEnv, JWT_SECRET: 'short-secret-123' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('at least 32 characters')])
        );
      }
    });

    it('should fail when JWT_SECRET is a known insecure placeholder', () => {
      const env = {
        ...validProdEnv,
        JWT_SECRET: 'replace_with_a_cryptographically_secure_random_string_in_production',
      };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('insecure example placeholder')])
        );
      }
    });

    it('should fail when AEGIS_DB_PATH is missing in production', () => {
      const env = { ...validProdEnv, AEGIS_DB_PATH: '' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('AEGIS_DB_PATH is REQUIRED')])
        );
      }
    });

    it('should fail when AEGIS_DB_PATH is :memory: in production', () => {
      const env = { ...validProdEnv, AEGIS_DB_PATH: ':memory:' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining("cannot be ':memory:'")])
        );
      }
    });

    it('should fail when CORS_ORIGIN is missing in production', () => {
      const env = { ...validProdEnv, CORS_ORIGIN: '' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('CORS_ORIGIN is REQUIRED')])
        );
      }
    });

    it('should fail when CORS_ORIGIN is wildcard * in production', () => {
      const env = { ...validProdEnv, CORS_ORIGIN: '*' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining("wildcard '*'")])
        );
      }
    });

    it('should fail when CORS_ORIGIN contains localhost in production', () => {
      const env = { ...validProdEnv, CORS_ORIGIN: 'http://localhost:3000' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining("'localhost'")])
        );
      }
    });

    it('should fail when ALLOW_DEV_TEST_TOKENS is true in production', () => {
      const env = { ...validProdEnv, ALLOW_DEV_TEST_TOKENS: 'true' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('ALLOW_DEV_TEST_TOKENS MUST NOT be true')])
        );
      }
    });

    it('should fail when ALLOW_HEADER_AUTH is true in production', () => {
      const env = { ...validProdEnv, ALLOW_HEADER_AUTH: 'true' };
      expect(() => validateConfig(env)).toThrow(ConfigurationError);
      try {
        validateConfig(env);
      } catch (err: any) {
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.stringContaining('ALLOW_HEADER_AUTH MUST NOT be true')])
        );
      }
    });

    it('should accumulate multiple errors in ConfigurationError for clear developer feedback', () => {
      const brokenEnv = {
        NODE_ENV: 'production',
        AEGIS_DB_PATH: ':memory:',
        JWT_SECRET: 'short',
        CORS_ORIGIN: '*',
        ALLOW_DEV_TEST_TOKENS: 'true',
      };
      try {
        validateConfig(brokenEnv);
        expect.unreachable('Should have thrown ConfigurationError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConfigurationError);
        expect(err.errors.length).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe('getConfig Singleton Caching', () => {
    it('should cache configuration on subsequent calls and reset on resetConfigCache', () => {
      process.env.PORT = '3005';
      const c1 = getConfig();
      expect(c1.port).toBe(3005);

      process.env.PORT = '3006';
      const c2 = getConfig();
      expect(c2.port).toBe(3005); // Cached

      resetConfigCache();
      const c3 = getConfig();
      expect(c3.port).toBe(3006); // Refreshed
    });
  });

  describe('Process Level Startup Lifecycle Tests', () => {
    it(
      'missing required env in production -> application fails clearly with exit code 1',
      () => {
      const res = spawnSync(
        'npx',
        ['tsx', resolve(__dirname, '../src/index.ts')],
        {
          env: {
            ...process.env,
            PATH: process.env.PATH,
            NODE_ENV: 'production',
            SKIP_DOTENV: 'true',
            AEGIS_DB_PATH: '',
            JWT_SECRET: '',
            CORS_ORIGIN: '',
          },
          encoding: 'utf-8',
          shell: true,
          timeout: 60000,
        }
      );

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FATAL: AegisPulse Configuration Validation Failed');
      expect(res.stderr).toContain('AEGIS_DB_PATH is REQUIRED in production/staging');
      expect(res.stderr).toContain('JWT_SECRET is REQUIRED in production/staging');
      expect(res.stderr).toContain('CORS_ORIGIN is REQUIRED in production/staging');
    }, 70000);

    it('valid env in production -> passes configuration validation and initializes cleanly', () => {
      const validEnv = {
        NODE_ENV: 'production',
        PORT: '3000',
        AEGIS_DB_PATH: '/data/aegispulse.db',
        JWT_SECRET: 'iev5sSTUfkPtzwWZQ5kZJQtq1vVECTIedVU38A_E4PY',
        CORS_ORIGIN: 'https://aegispulse.hospital.org',
        ALLOW_DEV_TEST_TOKENS: 'false',
        ALLOW_HEADER_AUTH: 'false',
      };

      const config = validateConfig(validEnv);
      expect(config.nodeEnv).toBe('production');
      expect(config.port).toBe(3000);
      expect(config.dbPath).toBe('/data/aegispulse.db');
      expect(config.jwtSecret).toBe('iev5sSTUfkPtzwWZQ5kZJQtq1vVECTIedVU38A_E4PY');
      expect(config.corsOrigins).toEqual(['https://aegispulse.hospital.org']);
    });

    it(
      'valid env in production -> application starts, binds to port, and serves health check',
      async () => {
        const testPort = 3995;
        const child = spawn(
          'npx',
          ['tsx', resolve(__dirname, '../src/index.ts')],
          {
            env: {
              ...process.env,
              NODE_ENV: 'production',
              PORT: String(testPort),
              HOST: '127.0.0.1',
              AEGIS_DB_PATH: resolve(__dirname, '../../../data/test-startup-check.db'),
              JWT_SECRET: 'iev5sSTUfkPtzwWZQ5kZJQtq1vVECTIedVU38A_E4PY',
              CORS_ORIGIN: 'https://aegispulse.hospital.org',
              ALLOW_DEV_TEST_TOKENS: 'false',
              ALLOW_HEADER_AUTH: 'false',
            },
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        try {
          await new Promise<void>((resolvePromise, rejectPromise) => {
            let resolved = false;
            const start = Date.now();

            const checkHealth = () => {
              if (resolved) return;
              if (Date.now() - start > 35000) {
                return rejectPromise(new Error('Server startup timed out after 35s'));
              }
              const req = http.get(`http://127.0.0.1:${testPort}/health`, (res) => {
                if (res.statusCode === 200) {
                  resolved = true;
                  let body = '';
                  res.on('data', (chunk) => (body += chunk));
                  res.on('end', () => {
                    const json = JSON.parse(body);
                    expect(json.status).toBe('ok');
                    expect(json.environment).toBe('production');
                    resolvePromise();
                  });
                } else {
                  setTimeout(checkHealth, 300);
                }
              });
              req.on('error', () => {
                setTimeout(checkHealth, 300);
              });
            };

            setTimeout(checkHealth, 500);

            child.on('error', (err) => {
              if (!resolved) rejectPromise(err);
            });
            child.on('exit', (code) => {
              if (!resolved && code !== null && code !== 0) {
                rejectPromise(new Error(`Server exited unexpectedly with code ${code}`));
              }
            });
          });
        } finally {
          if (child.pid) {
            spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { shell: true });
          }
        }
      },
      45000
    );
  });
});
