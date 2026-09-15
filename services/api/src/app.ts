import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/request-id';
import { structuredLogger } from './middleware/logger';
import { errorHandler, NotFoundError } from './middleware/errors';
import { requestTimeout } from './middleware/timeout';
import { createRateLimiter } from './middleware/rate-limiter';
import { v1Router } from './routes/v1';
import { healthRouter } from './routes/v1/health';
import { metricsRouter } from './routes/v1/metrics';
import { docsRouter } from './routes/docs';

import { enforcePrivacyInvariants } from './middleware/privacy';

import { getConfig } from './config/env';

export function createApp(): Express {
  const config = getConfig();
  const app = express();

  // 1. Comprehensive Production Security Headers
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';"
    );
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });

  // 2. Strict Origin-Validated CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, internal server-to-server)
        if (!origin) return callback(null, true);
        if (config.nodeEnv !== 'production' || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error(`Origin '${origin}' is not allowed by CORS policy.`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        'x-request-id',
        'x-correlation-id',
        'x-user-role',
        'x-user-id',
        'x-user-wards',
      ],
      exposedHeaders: [
        'x-request-id',
        'x-correlation-id',
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
      ],
      maxAge: 86400,
    })
  );

  // 3. Strict Request Size Limits & Privacy Invariant Inspection
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(enforcePrivacyInvariants);

  // 4. Request Timeout Protection
  app.use(requestTimeout({ timeoutMs: config.requestTimeoutMs }));

  // 5. Global Rate Limiter
  const globalRateLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  });
  app.use(globalRateLimiter);

  // 6. Telemetry & Tracking Middleware
  app.use(requestIdMiddleware);
  app.use(structuredLogger);

  // 7. Root Liveness & Readiness Probes (Infra / Kubernetes / LB)
  app.use('/', healthRouter);

  // 7.1 Root Prometheus / JSON Metrics Probe
  app.use('/metrics', metricsRouter);

  // 8. Documentation Endpoints
  app.use('/api/docs', docsRouter);
  app.use('/docs', docsRouter);

  // 9. API Versioning (Primary: /api/v1, Backwards-compatible: /api)
  app.use('/api/v1', v1Router);
  app.use('/api', v1Router);

  // 10. 404 Handler
  app.use((req: Request, _res: Response, next) => {
    next(new NotFoundError(`The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this AegisPulse service.`));
  });

  // 11. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

