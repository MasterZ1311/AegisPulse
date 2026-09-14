import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { errorHandler } from '../src/middleware/errors';

describe('Rate Limiting Middleware', () => {
  const app = express();
  const testLimiter = createRateLimiter({
    windowMs: 10000,
    maxRequests: 3,
    keyGenerator: () => 'test-ip',
  });

  app.get('/limited-route', testLimiter, (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use(errorHandler);

  it('allows requests within limit and exposes rate limit headers', async () => {
    const res1 = await request(app).get('/limited-route');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-ratelimit-limit']).toBe('3');
    expect(res1.headers['x-ratelimit-remaining']).toBe('2');

    const res2 = await request(app).get('/limited-route');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('1');
  });

  it('rejects subsequent requests with 429 and Retry-After header when threshold exceeded', async () => {
    const res3 = await request(app).get('/limited-route');
    expect(res3.status).toBe(200);

    const res4 = await request(app).get('/limited-route');
    expect(res4.status).toBe(429);
    expect(res4.headers).toHaveProperty('retry-after');
    expect(res4.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
