import { Router } from 'express';
import { db } from '../db.js';

export const vitalsRouter = Router();

// Log live vitals reading
vitalsRouter.post('/:id', (req, res) => {
  try {
    const patientId = req.params.id;
    const vitals = req.body;
    db.logVitals(patientId, vitals);
    res.json({ success: true, message: 'Vitals logged successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get historical vitals for patient
vitalsRouter.get('/:id/history', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const history = db.getVitalsHistory(req.params.id, limit);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
