import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { ScenarioId } from '@aegispulse/simulation';
import { wardStateService } from '../../services/ward-state.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

export const simulationRouter = Router();

simulationRouter.use(authenticate({ optional: true }));

const RunScenarioSchema = z
  .object({
    scenarioId: z.enum([
      'NORMAL_SHIFT',
      'SINGLE_PATIENT_DETERIORATION',
      'FALSE_ALARM_SCENARIO',
      'SIGNAL_FAILURE_SCENARIO',
      'MULTIPLE_PATIENT_SCENARIO',
    ]),
  })
  .strict();

const TickClockSchema = z
  .object({
    seconds: z.number().int().min(1).max(86400).default(60),
  })
  .strict();

// 1. List Available Scenarios
simulationRouter.get('/scenarios', (_req: Request, res: Response) => {
  const catalog = wardStateService.getScenarios();
  const scenarios = Object.values(catalog).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }));
  res.status(200).json({ data: scenarios, total: scenarios.length });
});

// 2. Run Scenario (Admin or System only)
simulationRouter.post(
  '/scenarios/run',
  authenticate(),
  requireRole(['ADMIN', 'SYSTEM']),
  validateRequest({ body: RunScenarioSchema }),
  (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof RunScenarioSchema>;
    wardStateService.runScenario(body.scenarioId as ScenarioId);

    res.status(200).json({
      message: `Simulation scenario '${body.scenarioId}' activated successfully.`,
      status: wardStateService.getSimulationStatus(),
    });
  }
);

// 3. Advance Clock Tick
simulationRouter.post(
  '/tick',
  authenticate(),
  requireRole(['ADMIN', 'SYSTEM']),
  validateRequest({ body: TickClockSchema }),
  (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof TickClockSchema>;
    const seconds = body.seconds || 60;
    const newTime = wardStateService.tickSimulation(seconds);

    res.status(200).json({
      message: `Simulation advanced by ${seconds} seconds.`,
      newTimestamp: newTime,
      status: wardStateService.getSimulationStatus(),
    });
  }
);

// 4. Current Simulation Status
simulationRouter.get('/status', (_req: Request, res: Response) => {
  res.status(200).json({
    data: wardStateService.getSimulationStatus(),
  });
});
