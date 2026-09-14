import { Router, Request, Response } from 'express';
import { metricsService } from '../../services/metrics.service';

export const metricsRouter = Router();

/**
 * GET /api/v1/metrics
 * Returns Prometheus text metrics or structured JSON snapshot
 */
metricsRouter.get('/', (req: Request, res: Response) => {
  const acceptHeader = req.headers['accept'] || '';
  const format = req.query.format as string | undefined;

  if (format === 'prometheus' || acceptHeader.includes('text/plain')) {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(metricsService.getPrometheusText());
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'ok',
    data: metricsService.getSnapshot(),
  });
});
