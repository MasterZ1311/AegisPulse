import { Router } from 'express';
import { healthRouter } from './health';
import { wardsRouter } from './wards';
import { bedsRouter } from './beds';
import { patientsRouter } from './patients';
import { observationsRouter } from './observations';
import { labsRouter } from './labs';
import { timelineRouter } from './timeline';
import { attentionPriorityRouter } from './attention-priority';
import { acknowledgementsRouter } from './acknowledgements';
import { clinicalActionsRouter } from './clinical-actions';
import { simulationRouter } from './simulation';
import { sseRouter } from '../../stream/sse-handler';

export const v1Router = Router();

// 1. Health & Readiness
v1Router.use('/', healthRouter);

// 1.1 Real-Time SSE Stream
v1Router.use('/', sseRouter);

// 2. Wards & Beds
v1Router.use('/wards', wardsRouter);
v1Router.use('/beds', bedsRouter);

// 3. Patients Registry
v1Router.use('/patients', patientsRouter);

// 4. Nested Patient Resources
v1Router.use('/patients/:patientId/observations', observationsRouter);
v1Router.use('/patients/:patientId/labs', labsRouter);
v1Router.use('/patients/:patientId/timeline', timelineRouter);
v1Router.use('/patients/:patientId/acknowledgements', acknowledgementsRouter);
v1Router.use('/patients/:patientId/actions', clinicalActionsRouter);

// 5. Attention Priorities & Ward Radar
v1Router.use('/', attentionPriorityRouter);

// 6. Simulation Scenarios
v1Router.use('/simulation', simulationRouter);
