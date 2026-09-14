import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/request-id';
import { structuredLogger } from './middleware/logger';
import { errorHandler, NotFoundError } from './middleware/errors';
import { v1Router } from './routes/v1';
import { healthRouter } from './routes/v1/health';
import { docsRouter } from './routes/docs';

export function createApp(): Express {
  const app = express();

  // 1. Core Security & Parsing Middleware
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id', 'x-user-role', 'x-user-id'],
      exposedHeaders: ['x-request-id', 'x-correlation-id', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'],
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // 2. Telemetry & Tracking Middleware
  app.use(requestIdMiddleware);
  app.use(structuredLogger);

  // 3. Root Liveness & Readiness Probes (Infra / Kubernetes / LB)
  app.use('/', healthRouter);

  // 4. API Versioning (Primary: /api/v1, Backwards-compatible: /api)
  app.use('/api/v1', v1Router);
  app.use('/api', v1Router);

  // 5. Documentation Endpoints
  app.use('/api/docs', docsRouter);
  app.use('/docs', docsRouter);

  // 6. 404 Handler
  app.use((req: Request, _res: Response, next) => {
    next(new NotFoundError(`The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this AegisPulse service.`));
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
