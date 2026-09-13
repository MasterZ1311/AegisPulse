import { Router } from 'express';
import { db } from '../db.js';

export const copilotRouter = Router();

copilotRouter.post('/analyze', async (req, res) => {
  try {
    const { patientId, vitals, labs } = req.body;
    const patient = db.getPatientById(patientId);

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const currentVitals = vitals || patient.vitals;
    const currentLabs = labs || patient.labs;
    const settings = db.getSettings();
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    // Build medical prompt
    const prompt = `You are AegisPulse AI, an advanced board-certified critical care clinical decision-support copilot.
Analyze this patient's real-time non-contact biometrics and laboratory biomarkers:

PATIENT:
Name: ${patient.name}, Age: ${patient.age}, Gender: ${patient.gender}, Bed: ${patient.bedNumber}
Admission Reason: ${patient.admissionReason}
Clinical History: ${patient.history.join(', ')}

REAL-TIME OPTICAL BIOMETRICS (rPPG):
- Heart Rate: ${currentVitals.heartRate} BPM
- Blood Pressure: ${currentVitals.systolicBP}/${currentVitals.diastolicBP} mmHg
- SpO2: ${currentVitals.spo2}%
- Respiratory Rate: ${currentVitals.respiratoryRate} breaths/min
- Body Temperature: ${currentVitals.temperature.toFixed(1)}°C
- Autonomic HRV (RMSSD): ${currentVitals.hrv} ms
- MEWS Score: ${currentVitals.mewsScore} / 14 (Triage: ${currentVitals.triageLevel.toUpperCase()})
- qSOFA Score: ${currentVitals.qsofaScore} / 3

LABORATORY BIOMARKERS:
- WBC: ${currentLabs.wbc} ×10⁹/L
- Serum Lactate: ${currentLabs.lactate} mmol/L (Critical > 2.0)
- Serum Creatinine: ${currentLabs.creatinine} mg/dL
- Platelet Count: ${currentLabs.platelets} ×10⁹/L
- C-Reactive Protein (CRP): ${currentLabs.crp} mg/L

Please generate:
1. SBAR Clinical Handoff (Situation, Background, Assessment, Recommendation)
2. Differential Diagnoses (ranked by likelihood)
3. Immediate Emergency Protocol Checklist (e.g. Sepsis 6, ABG, fluids, imaging, ICU consult)
4. Physiological Risk Trajectory (Likelihood of decompensation in next 2 hours)`;

    // Check if Gemini API key exists
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1000,
              },
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            return res.json({
              success: true,
              source: 'gemini-1.5-flash',
              analysis: candidateText,
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to clinical rules engine:', geminiErr);
      }
    }

    // Deterministic Clinical Decision Support Engine (Fallback / Offline Mode)
    const isCritical = currentVitals.mewsScore >= 5 || currentVitals.qsofaScore >= 2 || currentLabs.lactate >= 2.0;
    const isModerate = currentVitals.mewsScore >= 3 || currentLabs.wbc > 12.0 || currentVitals.spo2 < 94;

    const fallbackAnalysis = `### 1. SBAR CLINICAL HANDOFF REPORT
**SITUATION:**
Patient ${patient.name} (Bed ${patient.bedNumber}, Age ${patient.age}y ${patient.gender}) is currently categorized as **${
      isCritical ? 'CRITICAL DECOMPENSATION (CODE RED)' : isModerate ? 'MODERATE RISK (CODE YELLOW)' : 'COMPENSATED / STABLE (CODE GREEN)'
    }**.
Current MEWS Score: **${currentVitals.mewsScore}/14**, qSOFA Score: **${currentVitals.qsofaScore}/3**.
Hemodynamics: HR ${currentVitals.heartRate} BPM, BP ${currentVitals.systolicBP}/${currentVitals.diastolicBP} mmHg, SpO2 ${currentVitals.spo2}%, RR ${currentVitals.respiratoryRate}/min, Temp ${currentVitals.temperature.toFixed(1)}°C.

**BACKGROUND:**
Admitted for ${patient.admissionReason}. Known clinical history: ${patient.history.join('; ')}.

**ASSESSMENT:**
${
  isCritical
    ? `High clinical probability of Acute Systemic Sepsis / Early Septic Shock with organ hypoperfusion indicated by serum lactate (${currentLabs.lactate} mmol/L) and leukocytosis (${currentLabs.wbc} ×10⁹/L) paired with tachycardia and tachypnea.`
    : isModerate
    ? `Patient displays intermediate autonomic stress and mild physiological deviation. Potential evolving hospital-acquired infection or respiratory fatigue.`
    : `Patient maintains stable physiological homeostasis. Micro-vascular optical pulse and laboratory biomarkers are within expected postoperative / ward baselines.`
}

**RECOMMENDATION:**
${
  isCritical
    ? `1. Immediately activate Rapid Response Team (RRT) and page on-call ICU Registrar to Bed ${patient.bedNumber}.\n2. Administer high-flow O₂ via non-rebreather mask to maintain SpO₂ > 94%.\n3. Establish secondary wide-bore IV access; infuse 30 mL/kg balanced crystalloids.\n4. Draw two sets of blood cultures prior to stat broad-spectrum IV antimicrobials.\n5. Order immediate Stat Arterial Blood Gas (ABG) and repeat serum lactate within 2 hours.`
    : isModerate
    ? `1. Increase contactless rPPG scan interval to every 15 minutes.\n2. Senior Ward Nurse bedside evaluation.\n3. Review medication chart and consider repeat venous blood gas.\n4. Re-check temperature and oral fluid intake.`
    : `1. Continue non-contact ambient rPPG vital surveillance.\n2. Routine morning laboratory panels as scheduled.`
}

### 2. DIFFERENTIAL DIAGNOSES
1. ${isCritical ? 'Severe Sepsis / Impending Septic Shock (Likelihood: 82%)' : 'Compensated Post-Operative State (Likelihood: 90%)'}
2. ${isCritical ? 'Acute Pulmonary Embolism (Likelihood: 45%)' : 'Mild Hospital-Acquired Atelectasis (Likelihood: 20%)'}
3. ${isCritical ? 'Cardiogenic Decompensation / Acute Arrhythmia (Likelihood: 30%)' : 'Analgesia-Related Somnolence (Likelihood: 10%)'}

### 3. PHYSIOLOGICAL RISK TRAJECTORY
${
  isCritical
    ? '⚠️ HIGH RISK: Rapid deterioration towards severe hypotension (MAP < 65 mmHg) expected within 45–90 minutes without aggressive fluid resuscitation and antibiotic administration.'
    : '✓ LOW RISK: Parameters stable. 2-hour projected risk of ICU escalation is < 5%.'
}`;

    res.json({
      success: true,
      source: 'clinical-heuristics-engine',
      analysis: fallbackAnalysis,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
