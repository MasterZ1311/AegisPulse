import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from './errors';

interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(options?: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
}) {
  const windowMs = options?.windowMs ?? 60 * 1000; // 1 minute default
  const maxRequests = options?.maxRequests ?? 100;
  const keyGen = options?.keyGenerator ?? ((req) => req.user?.userId || req.ip || 'anonymous');

  const records = new Map<string, RateLimitRecord>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyGen(req);

    let record = records.get(key);
    if (!record) {
      record = { timestamps: [] };
      records.set(key, record);
    }

    // Filter timestamps within sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const resetTimeSeconds = Math.max(1, Math.ceil((windowMs - (now - (record.timestamps[0] ?? now))) / 1000));
      res.setHeader('x-ratelimit-limit', String(maxRequests));
      res.setHeader('x-ratelimit-remaining', '0');
      res.setHeader('x-ratelimit-reset', String(now + resetTimeSeconds * 1000));
      return next(
        new RateLimitError(
          `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000}s.`,
          resetTimeSeconds
        )
      );
    }

    record.timestamps.push(now);
    const remaining = Math.max(0, maxRequests - record.timestamps.length);
    res.setHeader('x-ratelimit-limit', String(maxRequests));
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(now + windowMs));

    next();
  };
}
