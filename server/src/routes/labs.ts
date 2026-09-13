import { Router } from 'express';
import { db } from '../db.js';

export const labsRouter = Router();

// Update lab biomarkers for patient
labsRouter.post('/:id', (req, res) => {
  try {
    const patientId = req.params.id;
    const labs = req.body;
    const updated = db.updateLabs(patientId, labs);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
