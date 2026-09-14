import { Router, Request, Response } from 'express';
import type { HealthCheckResponse } from '@aegispulse/types';
import { wardStateService } from '../../services/ward-state.service';
import { timelineService } from '../../services/timeline.service';

export const healthRouter = Router();

const startTime = Date.now();

// Liveness Probe
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

// Readiness Probe (Evaluates clinical & simulation engines)
healthRouter.get('/ready', (_req: Request, res: Response) => {
  try {
    const simStatus = wardStateService.getSimulationStatus();
    const patientCount = wardStateService.getPatients().length;
    const timelinePatientCount = timelineService.getRepository().getAllPatientIds().length;

    const isReady = patientCount > 0 && simStatus.patientCount > 0;

    if (!isReady) {
      res.status(503).json({
        status: 'degraded',
        service: 'aegispulse-api',
        ready: false,
        message: 'Ward state or simulation engine is still initializing.',
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      service: 'aegispulse-api',
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {
        wardSimulator: 'ONLINE',
        clinicalIntelligence: 'ONLINE',
        timelineRepository: 'ONLINE',
        activePatients: patientCount,
        indexedTimelinePatients: timelinePatientCount,
        simulationClock: simStatus.clock,
      },
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      service: 'aegispulse-api',
      ready: false,
      error: err?.message || 'Readiness evaluation failed.',
    });
  }
});
