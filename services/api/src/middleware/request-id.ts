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
  const incoming =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string);

  // Validate incoming ID: strictly alphanumeric, hyphen, underscore; 8 to 64 chars
  const isValid = typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming.trim());
  const correlationId = isValid ? incoming.trim() : randomUUID();

  req.id = correlationId;
  req.correlationId = correlationId;

  res.setHeader('x-request-id', correlationId);
  res.setHeader('x-correlation-id', correlationId);

  next();
}

