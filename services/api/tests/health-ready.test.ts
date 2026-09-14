import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('System Telemetry & Health Probes', () => {
  const app = createApp();

  it('serves liveness probe on /health with valid telemetry', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('aegispulse-api');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.headers).toHaveProperty('x-request-id');
  });

  it('serves readiness probe on /ready evaluating simulation & clinical engines', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.ready).toBe(true);
    expect(res.body.checks.wardSimulator).toBe('ONLINE');
    expect(res.body.checks.clinicalIntelligence).toBe('ONLINE');
    expect(res.body.checks.timelineRepository).toBe('ONLINE');
    expect(res.body.checks.database).toBe('ONLINE');
    expect(res.body.checks.activePatients).toBeGreaterThan(0);
  });

  it('serves versioned health probe on /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('serves versioned readiness probe on /api/v1/ready', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('propagates incoming x-request-id header across request lifecycle', async () => {
    const customId = 'req-trace-test-999';
    const res = await request(app).get('/health').set('x-request-id', customId);
    expect(res.headers['x-request-id']).toBe(customId);
    expect(res.headers['x-correlation-id']).toBe(customId);
  });

  it('returns RFC 7807 problem details on 404 Not Found', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('type');
    expect(res.body).toHaveProperty('title', 'NotFound');
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('instance');
  });

  it('serves valid OpenAPI 3.0.3 specification on /api/docs/openapi.json', async () => {
    const res = await request(app).get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toContain('AegisPulse');
    expect(res.body).toHaveProperty('paths');
  });

  it('serves interactive Swagger UI HTML documentation on /api/docs', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('swagger-ui');
  });
});

