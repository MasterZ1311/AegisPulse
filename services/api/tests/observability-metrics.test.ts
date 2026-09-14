import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { metricsService } from '../src/services/metrics.service';

describe('Phase 25: Observability, Metrics & Health Probes Suite', () => {
  const app = createApp();

  beforeEach(() => {
    metricsService.reset();
  });

  it('1. Returns JSON diagnostics snapshot from /api/v1/metrics', async () => {
    metricsService.recordObservation('BEDSIDE_DEVICE');
    metricsService.recordApsDuration(1.2, 'CRITICAL_REVIEW');

    const res = await request(app)
      .get('/api/v1/metrics')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.service).toBe('aegispulse-api');
    expect(res.body.data.counters.observations.BEDSIDE_DEVICE).toBeGreaterThanOrEqual(1);
    expect(res.body.data.counters.apsEvaluations.CRITICAL_REVIEW).toBeGreaterThanOrEqual(1);
    expect(res.body.data.latency.apsCalculation.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it('2. Returns Prometheus format from /metrics', async () => {
    metricsService.recordObservation('RPPG_CAMERA');
    metricsService.recordApsDuration(0.8, 'EVALUATE');

    const res = await request(app)
      .get('/metrics')
      .set('Accept', 'text/plain');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('aegispulse_uptime_seconds');
    expect(res.text).toContain('aegispulse_memory_heap_used_bytes');
    expect(res.text).toContain('aegispulse_aps_evaluations_total');
    expect(res.text).toContain('aegispulse_aps_latency_ms');
  });

  it('3. Liveness probe /health returns 200 with service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('aegispulse-api');
    expect(res.body.uptimeSeconds).toBeDefined();
  });

  it('4. Readiness probe /ready verifies database, simulator and clinical intelligence', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.checks.database).toBe('ONLINE');
    expect(res.body.checks.wardSimulator).toBe('ONLINE');
    expect(res.body.checks.clinicalIntelligence).toBe('ONLINE');
    expect(res.body.checks.activePatients).toBeGreaterThan(0);
  });
});
