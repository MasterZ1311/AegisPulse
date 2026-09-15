import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from './errors';

interface RateLimitRecord {
  timestamps: number[];
  lastSeen: number;
}

export function createRateLimiter(options?: {
  windowMs?: number;
  maxRequests?: number;
  maxKeys?: number;
  keyGenerator?: (req: Request) => string;
}) {
  const windowMs = options?.windowMs ?? 60 * 1000; // 1 minute default
  const maxRequests = options?.maxRequests ?? 100;
  const maxKeys = options?.maxKeys ?? 10000; // Max 10,000 tracked keys to prevent heap exhaustion
  const keyGen = options?.keyGenerator ?? ((req) => req.user?.userId || req.ip || 'anonymous');

  const records = new Map<string, RateLimitRecord>();

  // Periodically sweep expired keys every 60s to prevent memory leaks
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of records.entries()) {
      if (now - record.lastSeen > windowMs) {
        records.delete(key);
      }
    }
  }, Math.min(windowMs, 60000));

  // Ensure timer does not prevent process exit
  if (sweepInterval.unref) {
    sweepInterval.unref();
  }

  const limiter = (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyGen(req);

    let record = records.get(key);
    if (!record) {
      // LRU eviction if maximum capacity reached
      if (records.size >= maxKeys) {
        const oldestKey = records.keys().next().value;
        if (oldestKey) records.delete(oldestKey);
      }
      record = { timestamps: [], lastSeen: now };
      records.set(key, record);
    }

    record.lastSeen = now;

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

  limiter.reset = () => {
    records.clear();
  };

  limiter.destroy = () => {
    clearInterval(sweepInterval);
    records.clear();
  };

  return limiter;
}

