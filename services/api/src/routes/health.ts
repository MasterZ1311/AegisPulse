import { Router, Request, Response } from 'express';
import type { HealthCheckResponse } from '@aegispulse/types';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const payload: HealthCheckResponse = {
    status: 'ok',
    service: 'aegispulse-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    environment: process.env.NODE_ENV || 'development',
  };

  res.status(200).json(payload);
});
