import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
      correlationId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    randomUUID();

  req.id = incomingId;
  req.correlationId = incomingId;

  res.setHeader('x-request-id', incomingId);
  res.setHeader('x-correlation-id', incomingId);

  next();
}
