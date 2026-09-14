import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { syncService, type SyncBatchRequest } from '../../services/sync.service';
import { validateRequest } from '../../middleware/validator';
import { authenticate } from '../../middleware/auth';
import { requireRole, requireWardAccess } from '../../middleware/rbac';
import { createRateLimiter } from '../../middleware/rate-limiter';

export const syncRouter = Router();

syncRouter.use(authenticate({ optional: true }));

const syncRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
});

const SyncItemSchema = z
  .object({
    idempotencyKey: z.string().min(4).max(128),
    itemType: z.enum(['OBSERVATION', 'ACKNOWLEDGEMENT', 'CLINICAL_ACTION']),
    timestamp: z.number().int().min(0),
    patientId: z.string().min(1).max(64),
    payload: z.record(z.string(), z.any()),
  })
  .strict();

const SyncBatchSchema = z
  .object({
    clientSyncId: z.string().min(4).max(128),
    clientId: z.string().min(1).max(128),
    wardId: z.string().optional(),
    lastServerSeq: z.number().int().min(0).optional(),
    items: z.array(SyncItemSchema).max(500),
  })
  .strict();

/**
 * POST /api/v1/sync
 * Idempotent batch synchronization endpoint for offline edge devices
 */
syncRouter.post(
  '/',
  requireRole(['WARD_NURSE', 'CHARGE_NURSE', 'RESIDENT_PHYSICIAN', 'ATTENDING_PHYSICIAN', 'ADMIN', 'SYSTEM']),
  requireWardAccess((req) => req.body?.wardId),
  syncRateLimiter,
  validateRequest({ body: SyncBatchSchema }),
  (req: Request, res: Response) => {
    const batch = req.body as SyncBatchRequest;
    const result = syncService.processSyncBatch(batch);

    res.status(200).json({
      message: 'Offline synchronization batch processed successfully.',
      data: result,
    });
  }
);
