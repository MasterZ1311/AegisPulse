import { Request, Response, NextFunction } from 'express';
import { GatewayTimeoutError } from './errors';

export interface TimeoutOptions {
  timeoutMs?: number;
}

/**
 * Request timeout middleware. Terminates slow or stalled HTTP requests
 * after a configurable interval (default: 30 seconds).
 */
export function requestTimeout(options?: TimeoutOptions) {
  const timeoutMs = options?.timeoutMs ?? 30000;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip timeout for SSE stream which is meant to be long-lived
    if (req.path.includes('/stream/sse')) {
      return next();
    }

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        next(new GatewayTimeoutError(`Request exceeded maximum timeout duration of ${timeoutMs / 1000}s.`));
      }
    }, timeoutMs);

    // Prevent timer from keeping the event loop alive
    if (timer.unref) {
      timer.unref();
    }

    res.on('finish', () => {
      clearTimeout(timer);
    });

    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
}
