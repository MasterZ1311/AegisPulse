import { Router } from 'express';
import { db } from '../db.js';

export const alertsRouter = Router();

// GET all active and historical alerts
alertsRouter.get('/', (req, res) => {
  try {
    const alerts = db.getAlerts();
    res.json({ success: true, data: alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resolve an alert
alertsRouter.post('/:id/resolve', (req, res) => {
  try {
    const success = db.resolveAlert(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, message: 'Alert resolved successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
