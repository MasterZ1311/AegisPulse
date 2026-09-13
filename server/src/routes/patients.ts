import { Router } from 'express';
import { db } from '../db.js';

export const patientsRouter = Router();

// GET all active patients
patientsRouter.get('/', (req, res) => {
  try {
    const patients = db.getPatients();
    res.json({ success: true, data: patients });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single patient
patientsRouter.get('/:id', (req, res) => {
  try {
    const patient = db.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST new patient
patientsRouter.post('/', (req, res) => {
  try {
    const { name, age, gender, bedNumber, admissionReason, history, notes } = req.body;
    if (!name || !bedNumber) {
      return res.status(400).json({ success: false, error: 'Name and Bed Number are required' });
    }

    const newPatient = db.addPatient({
      name,
      age: Number(age) || 30,
      gender: gender || 'Other',
      bedNumber,
      admissionReason: admissionReason || 'Admitted for Observation',
      history: Array.isArray(history) ? history : [history || 'No significant history'],
      notes: Array.isArray(notes) ? notes : [notes || 'Initial nursing intake complete'],
      status: 'active',
      vitals: {
        heartRate: 72,
        respiratoryRate: 16,
        hrv: 45,
        spo2: 98,
        temperature: 36.8,
        systolicBP: 120,
        diastolicBP: 80,
        mewsScore: 0,
        qsofaScore: 0,
        triageLevel: 'green',
        signalQuality: 90,
        timestamp: Date.now(),
      },
      labs: {
        wbc: 7.0,
        creatinine: 1.0,
        lactate: 1.0,
        platelets: 250,
        crp: 3.0,
      },
    });

    res.status(201).json({ success: true, data: newPatient });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE (Discharge) patient
patientsRouter.delete('/:id', (req, res) => {
  try {
    const success = db.deletePatient(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    res.json({ success: true, message: 'Patient discharged successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
