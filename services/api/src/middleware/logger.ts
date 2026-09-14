import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';

export function structuredLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    metricsService.recordApiRequest(durationMs);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      clientIp: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    if (process.env.NODE_ENV !== 'test' && !process.env.SILENT_LOGS) {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}
