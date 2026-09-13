import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health endpoint', () => {
  const app = createApp();

  it('returns 200 OK with valid HealthCheckResponse structure', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'aegispulse-api');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });

  it('also serves health check on /api/health', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('handles 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/unknown-endpoint-404');
    expect(res.status).toBe(404);
  });
});
