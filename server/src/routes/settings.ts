import { Router } from 'express';
import { db } from '../db.js';

export const settingsRouter = Router();

// GET settings (masking API key partially for safety)
settingsRouter.get('/', (req, res) => {
  try {
    const settings = db.getSettings();
    const maskedKey = settings.geminiApiKey
      ? `${settings.geminiApiKey.slice(0, 6)}...${settings.geminiApiKey.slice(-4)}`
      : '';
    res.json({
      success: true,
      data: {
        ...settings,
        hasApiKey: Boolean(settings.geminiApiKey),
        maskedApiKey: maskedKey,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST update settings
settingsRouter.post('/', (req, res) => {
  try {
    const { geminiApiKey, hospitalUnit, audioAlerts, alertThresholdMews } = req.body;
    const updates: any = {};
    if (geminiApiKey !== undefined) updates.geminiApiKey = geminiApiKey.trim();
    if (hospitalUnit !== undefined) updates.hospitalUnit = hospitalUnit;
    if (audioAlerts !== undefined) updates.audioAlerts = Boolean(audioAlerts);
    if (alertThresholdMews !== undefined) updates.alertThresholdMews = Number(alertThresholdMews);

    const updated = db.updateSettings(updates);
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        hospitalUnit: updated.hospitalUnit,
        audioAlerts: updated.audioAlerts,
        alertThresholdMews: updated.alertThresholdMews,
        hasApiKey: Boolean(updated.geminiApiKey),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
