import { useEffect, useState, useCallback } from 'react';
import type { HealthCheckResponse, TelemetryStreamEnvelope } from '@aegispulse/types';
import {
  AegisPulseStreamClient,
  type StreamConnectionStatus,
} from './services/stream-client';
import { WardHeader } from './components/WardHeader';
import { AttentionQueue } from './components/AttentionQueue';
import { PatientDetailModal } from './components/PatientDetailModal';
import { INITIAL_WARD_PATIENTS } from './data/ward-simulated-data';
import type { WardPatientRadarState } from './types/radar';

export default function App() {
  const [patients, setPatients] = useState<WardPatientRadarState[]>(INITIAL_WARD_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [focusedPatientIndex, setFocusedPatientIndex] = useState<number>(0);
  const [activeScenario, setActiveScenario] = useState<string>('SINGLE_PATIENT_DETERIORATION');
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>('CONNECTING');
  const [streamSeq, setStreamSeq] = useState<number>(0);
  const [_recentEvents, setRecentEvents] = useState<TelemetryStreamEnvelope[]>([]);
  const [_health, setHealth] = useState<HealthCheckResponse | null>(null);

  // Derive counts for ward header
  const criticalCount = patients.filter((p) => p.category === 'CRITICAL_REVIEW').length;
  const evaluateCount = patients.filter((p) => p.category === 'EVALUATE').length;
  const watchCount = patients.filter((p) => p.category === 'WATCH').length;
  const lowCount = patients.filter((p) => p.category === 'LOW').length;

  const selectedPatient = patients.find((p) => p.patientId === selectedPatientId) || null;

  // 1. Health Probe Polling & Real-Time Telemetry Stream Client
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        if (res.ok) {
          const data: HealthCheckResponse = await res.json();
          setHealth(data);
        }
      } catch {
        // Silently handled
      }
    };
    checkHealth();
    const healthInterval = setInterval(checkHealth, 10000);

    // Initialize Stream Client (WebSocket with SSE fallback)
    const client = new AegisPulseStreamClient({
      wardId: 'WARD-4B',
      heartbeatIntervalMs: 15000,
    });

    client.onStatusChange((status) => {
      setStreamStatus(status);
      setStreamSeq(client.getLastSequenceNumber());
    });

    client.onSnapshot((snapshot) => {
      if (snapshot.radar && Array.isArray(snapshot.radar)) {
        setPatients((prev) =>
          prev.map((p) => {
            const found = snapshot.radar.find((r: any) => r.patientId === p.patientId);
            return found
              ? {
                  ...p,
                  apsScore: found.apsScore ?? p.apsScore,
                  category: found.category ?? p.category,
                  whyNowSummary: found.topReason ?? p.whyNowSummary,
                }
              : p;
          })
        );
      }
    });

    client.on('OBSERVATION_UPDATED', (env) => {
      setStreamSeq(env.seq);
      setRecentEvents((prev) => [env, ...prev].slice(0, 10));

      const data = env.data;
      if (data && data.patientId) {
        setPatients((prev) =>
          prev.map((item) =>
            item.patientId === data.patientId
              ? {
                  ...item,
                  vitals: {
                    ...item.vitals,
                    heartRate: data.heartRate ?? item.vitals.heartRate,
                    respiratoryRate: data.respiratoryRate ?? item.vitals.respiratoryRate,
                    spo2: data.spo2 ?? item.vitals.spo2,
                    systolicBP: data.systolicBP ?? item.vitals.systolicBP,
                    diastolicBP: data.diastolicBP ?? item.vitals.diastolicBP,
                  },
                  lastTrustedObservationIso: new Date().toISOString(),
                  lastTrustedElapsedMinutes: 0,
                  isStale: false,
                }
              : item
          )
        );
      }
    });

    client.on('APS_UPDATED', (env) => {
      setStreamSeq(env.seq);
      setRecentEvents((prev) => [env, ...prev].slice(0, 10));

      const data = env.data;
      if (data && data.patientId) {
        setPatients((prev) =>
          prev.map((item) =>
            item.patientId === data.patientId
              ? {
                  ...item,
                  apsScore: data.apsScore ?? item.apsScore,
                  category: data.category ?? item.category,
                  whyNowSummary: data.topReason ?? item.whyNowSummary,
                }
              : item
          )
        );
      }
    });

    client.on('SIGNAL_STATUS_CHANGED', (env) => {
      setStreamSeq(env.seq);
      setRecentEvents((prev) => [env, ...prev].slice(0, 10));

      const data = env.data;
      if (data && data.patientId) {
        setPatients((prev) =>
          prev.map((item) =>
            item.patientId === data.patientId
              ? {
                  ...item,
                  signalQuality: {
                    ...item.signalQuality,
                    confidencePercent: data.confidencePercent ?? item.signalQuality.confidencePercent,
                    motionDetected: data.motionDetected ?? item.signalQuality.motionDetected,
                  },
                }
              : item
          )
        );
      }
    });

    client.on('ACTION_ACKNOWLEDGED', (env) => {
      setStreamSeq(env.seq);
      setRecentEvents((prev) => [env, ...prev].slice(0, 10));

      const data = env.data;
      if (data && data.patientId) {
        setPatients((prev) =>
          prev.map((item) =>
            item.patientId === data.patientId
              ? {
                  ...item,
                  isAcknowledged: true,
                  lastAcknowledgedAt: new Date().toISOString(),
                  lastAcknowledgedBy: data.acknowledgedBy || 'RN Rachel Hayes',
                }
              : item
          )
        );
      }
    });

    client.connect();

    return () => {
      clearInterval(healthInterval);
      client.disconnect();
    };
  }, []);

  // 2. Action Handlers
  const handleAcknowledge = useCallback((patientId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setPatients((prev) =>
      prev.map((p) =>
        p.patientId === patientId
          ? {
              ...p,
              isAcknowledged: true,
              lastAcknowledgedAt: new Date().toISOString(),
              lastAcknowledgedBy: 'RN Rachel Hayes',
              timeline: [
                {
                  id: `TL-ACK-${Date.now()}`,
                  patientId,
                  timestamp: Date.now(),
                  eventType: 'ACKNOWLEDGEMENT',
                  title: 'Priority Alert Acknowledged by Primary Nurse',
                  description: 'Nurse Rachel Hayes, RN reviewed radar alert at bedside station.',
                  severity: 'INFO',
                  source: 'NURSE_MANUAL',
                  isTrusted: true,
                },
                ...p.timeline,
              ],
            }
          : p
      )
    );
  }, []);

  const handleLogAssessment = useCallback((patientId: string, note: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.patientId === patientId
          ? {
              ...p,
              lastTrustedElapsedMinutes: 0,
              lastTrustedObservationIso: new Date().toISOString(),
              timeline: [
                {
                  id: `TL-ASSESS-${Date.now()}`,
                  patientId,
                  timestamp: Date.now(),
                  eventType: 'MANUAL_OBSERVATION',
                  title: 'Bedside Physical Assessment Logged',
                  description: note,
                  severity: 'INFO',
                  source: 'NURSE_MANUAL',
                  isTrusted: true,
                },
                ...p.timeline,
              ],
            }
          : p
      )
    );
  }, []);

  const handleEscalate = useCallback((patientId: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.patientId === patientId
          ? {
              ...p,
              timeline: [
                {
                  id: `TL-RRT-${Date.now()}`,
                  patientId,
                  timestamp: Date.now(),
                  eventType: 'RECOMMENDED_ACTION',
                  title: 'Rapid Response Team (RRT) Activated',
                  description:
                    'Medical Emergency Team paged for immediate bedside critical care consultation.',
                  severity: 'CRITICAL',
                  source: 'NURSE_MANUAL',
                  isTrusted: true,
                },
                ...p.timeline,
              ],
            }
          : p
      )
    );
  }, []);

  const handleScenarioChange = useCallback((scenario: string) => {
    setActiveScenario(scenario);

    // Apply scenario changes to patients state for interactive demonstration
    if (scenario === 'NORMAL_SHIFT') {
      setPatients((prev) =>
        prev.map((p) => ({
          ...p,
          apsScore: Math.min(p.apsScore, 24),
          category: 'LOW',
          trendDirection: 'STEADY',
          trendVelocityPointsPerHour: 0.1,
          whyNowSummary: 'Ward stabilized. All vitals within normal postoperative parameters.',
        }))
      );
    } else if (scenario === 'MULTIPLE_PATIENT_SCENARIO') {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.patientId === 'P003') {
            return { ...p, apsScore: 92, category: 'CRITICAL_REVIEW' };
          }
          if (p.patientId === 'P006') {
            return { ...p, apsScore: 84, category: 'CRITICAL_REVIEW', trendDirection: 'RAPIDLY_RISING' };
          }
          return p;
        })
      );
    } else if (scenario === 'SIGNAL_FAILURE_SCENARIO') {
      setPatients((prev) =>
        prev.map((p) =>
          p.patientId === 'P005'
            ? {
                ...p,
                signalQuality: {
                  ...p.signalQuality,
                  confidencePercent: 28,
                  motionDetected: true,
                  motionMagnitude: 0.88,
                },
                isStale: true,
                whyNowSummary: 'Severe optical signal obstruction. rPPG readings suppressed.',
              }
            : p
        )
      );
    } else {
      // Default: restore INITIAL_WARD_PATIENTS
      setPatients(INITIAL_WARD_PATIENTS);
    }
  }, []);

  // 3. Accessible Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, let Escape close it
      if (selectedPatientId) {
        if (e.key === 'Escape') {
          setSelectedPatientId(null);
        }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedPatientIndex((prev) => (prev + 1) % patients.length);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedPatientIndex((prev) => (prev - 1 + patients.length) % patients.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const sorted = [...patients].sort((a, b) => b.apsScore - a.apsScore);
        const target = sorted[focusedPatientIndex];
        if (target) setSelectedPatientId(target.patientId);
      } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const bedIndex = parseInt(e.key, 10) - 1;
        if (patients[bedIndex]) {
          setSelectedPatientId(patients[bedIndex].patientId);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        const sorted = [...patients].sort((a, b) => b.apsScore - a.apsScore);
        const target = sorted[focusedPatientIndex];
        if (target) handleAcknowledge(target.patientId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPatientId, focusedPatientIndex, patients, handleAcknowledge]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-cyan-500 selection:text-black">
      {/* Header */}
      <WardHeader
        wardName="Ward 4B — Acute Surgical & Step-Down"
        shiftLead="Nurse Rachel Hayes, RN"
        shiftHours="Day Shift 07:00 - 19:00"
        streamStatus={streamStatus}
        streamSeq={streamSeq}
        totalPatients={patients.length}
        criticalCount={criticalCount}
        evaluateCount={evaluateCount}
        watchCount={watchCount}
        lowCount={lowCount}
        activeScenario={activeScenario}
        onScenarioChange={handleScenarioChange}
      />

      {/* Main Operational Screen */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <AttentionQueue
          patients={patients}
          selectedPatientId={selectedPatientId}
          focusedPatientIndex={focusedPatientIndex}
          onSelectPatient={(p) => setSelectedPatientId(p.patientId)}
          onAcknowledgePatient={handleAcknowledge}
        />
      </main>

      {/* Slide-over / Modal for Patient Attention Detail */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={() => setSelectedPatientId(null)}
          onAcknowledge={handleAcknowledge}
          onLogAssessment={handleLogAssessment}
          onEscalate={handleEscalate}
        />
      )}
    </div>
  );
}
