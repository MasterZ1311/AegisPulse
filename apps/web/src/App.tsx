import { useEffect, useState, useCallback, useMemo } from 'react';
import type { HealthCheckResponse, TelemetryStreamEnvelope } from '@aegispulse/types';
import {
  AegisPulseStreamClient,
  type StreamConnectionStatus,
} from './services/stream-client';
import {
  offlineSyncQueue,
  type WardConnectivityState,
} from './services/offline-sync-queue';
import { WardHeader } from './components/WardHeader';
import { AttentionQueue } from './components/AttentionQueue';
import { PatientDetailPanel } from './components/PatientDetailPanel';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { BedsideCameraModal } from './components/BedsideCameraModal';
import { DemoScrubber } from './components/DemoScrubber';
import { INITIAL_WARD_PATIENTS } from './data/ward-simulated-data';
import type { WardPatientRadarState } from './types/radar';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const [patients, setPatients] = useState<WardPatientRadarState[]>(INITIAL_WARD_PATIENTS);
  // Default to the first (highest priority) patient ID: P003 (Eleanor Vance, Bed 403-A)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('P003');
  const [focusedPatientIndex, setFocusedPatientIndex] = useState<number>(0);
  const [activeScenario, setActiveScenario] = useState<string>('SINGLE_PATIENT_DETERIORATION');
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>('CONNECTING');
  const [streamSeq, setStreamSeq] = useState<number>(0);
  const [connectivityState, setConnectivityState] = useState<WardConnectivityState>('ONLINE');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [_recentEvents, setRecentEvents] = useState<TelemetryStreamEnvelope[]>([]);
  const [_health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [mobileView, setMobileView] = useState<'QUEUE' | 'DETAIL'>('QUEUE');

  // Derive counts for ward header
  const criticalCount = patients.filter((p) => p.category === 'CRITICAL_REVIEW').length;
  const evaluateCount = patients.filter((p) => p.category === 'EVALUATE').length;
  const watchCount = patients.filter((p) => p.category === 'WATCH').length;
  const lowCount = patients.filter((p) => p.category === 'LOW').length;

  // Dynamically sorted queue order
  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => b.apsScore - a.apsScore);
  }, [patients]);

  const selectedPatient = patients.find((p) => p.patientId === selectedPatientId) || sortedPatients[0] || null;

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

    if (typeof window !== 'undefined') {
      (window as any).__aegisStreamClient = client;
    }

    // Offline Sync Queue Subscription
    const unsubOffline = offlineSyncQueue.onStateChange((state, count) => {
      setConnectivityState(state);
      setPendingSyncCount(count);
    });

    client.onStatusChange((status) => {
      setStreamStatus(status);
      setStreamSeq(client.getLastSequenceNumber());
      if (status === 'CONNECTED') {
        offlineSyncQueue.setState('ONLINE');
        offlineSyncQueue.flush(client.getLastSequenceNumber());
      } else if (status === 'RECONNECTING') {
        offlineSyncQueue.setState('DEGRADED');
      } else if (status === 'DISCONNECTED') {
        offlineSyncQueue.setState('OFFLINE');
      }
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
      unsubOffline();
      client.disconnect();
    };
  }, []);

  // 2. Action Handlers
  const handleAcknowledge = useCallback((patientId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    offlineSyncQueue.enqueueAcknowledgement(
      patientId,
      `alert-${patientId}-${Date.now()}`,
      'RN Rachel Hayes',
      'Nurse Rachel Hayes, RN reviewed radar alert at bedside station.'
    );

    setPatients((prev) =>
      prev.map((p) => {
        if (p.patientId !== patientId) return p;
        // Suppress duplicate acknowledgement timeline events within 3 seconds
        const hasRecentAck = p.timeline.some(
          (t) => t.eventType === 'ACKNOWLEDGEMENT' && Date.now() - t.timestamp < 3000
        );
        const newAckEvent = {
          id: `TL-ACK-${Date.now()}`,
          patientId,
          timestamp: Date.now(),
          eventType: 'ACKNOWLEDGEMENT' as const,
          title: 'Priority Alert Acknowledged by Primary Nurse',
          description: 'Nurse Rachel Hayes, RN reviewed radar alert at bedside station.',
          severity: 'INFO' as const,
          source: 'NURSE_MANUAL' as const,
          isTrusted: true,
        };
        const updatedTimeline = hasRecentAck
          ? p.timeline
          : [newAckEvent, ...p.timeline.filter((t) => t.id !== newAckEvent.id)];

        return {
          ...p,
          isAcknowledged: true,
          lastAcknowledgedAt: new Date().toISOString(),
          lastAcknowledgedBy: 'RN Rachel Hayes',
          timeline: updatedTimeline,
        };
      })
    );
  }, []);

  const handleLogAssessment = useCallback((patientId: string, note: string) => {
    offlineSyncQueue.enqueueClinicalAction(
      patientId,
      'MANUAL_OBSERVATION',
      'Bedside Physical Assessment Logged',
      note,
      'INFO'
    );

    const newAssessEvent = {
      id: `TL-ASSESS-${Date.now()}`,
      patientId,
      timestamp: Date.now(),
      eventType: 'MANUAL_OBSERVATION' as const,
      title: 'Bedside Physical Assessment Logged',
      description: note,
      severity: 'INFO' as const,
      source: 'NURSE_MANUAL' as const,
      isTrusted: true,
    };

    setPatients((prev) =>
      prev.map((p) =>
        p.patientId === patientId
          ? {
              ...p,
              lastTrustedElapsedMinutes: 0,
              lastTrustedObservationIso: new Date().toISOString(),
              timeline: [newAssessEvent, ...p.timeline.filter((t) => t.id !== newAssessEvent.id)],
            }
          : p
      )
    );
  }, []);

  const handleEscalate = useCallback((patientId: string) => {
    offlineSyncQueue.enqueueClinicalAction(
      patientId,
      'RECOMMENDED_ACTION',
      'Rapid Response Team (RRT) Activated',
      'Medical Emergency Team paged for immediate bedside critical care consultation.',
      'CRITICAL'
    );

    const newRrtEvent = {
      id: `TL-RRT-${Date.now()}`,
      patientId,
      timestamp: Date.now(),
      eventType: 'RECOMMENDED_ACTION' as const,
      title: 'Rapid Response Team (RRT) Activated',
      description:
        'Medical Emergency Team paged for immediate bedside critical care consultation.',
      severity: 'CRITICAL' as const,
      source: 'NURSE_MANUAL' as const,
      isTrusted: true,
    };

    setPatients((prev) =>
      prev.map((p) =>
        p.patientId === patientId
          ? {
              ...p,
              timeline: [newRrtEvent, ...p.timeline.filter((t) => t.id !== newRrtEvent.id)],
            }
          : p
      )
    );
  }, []);

  const handleScenarioChange = useCallback((scenario: string) => {
    setActiveScenario(scenario);

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
      setPatients(INITIAL_WARD_PATIENTS);
    }
  }, []);

  // 3. Accessible Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = (focusedPatientIndex + 1) % sortedPatients.length;
        setFocusedPatientIndex(nextIdx);
        if (sortedPatients[nextIdx]) {
          setSelectedPatientId(sortedPatients[nextIdx].patientId);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = (focusedPatientIndex - 1 + sortedPatients.length) % sortedPatients.length;
        setFocusedPatientIndex(prevIdx);
        if (sortedPatients[prevIdx]) {
          setSelectedPatientId(sortedPatients[prevIdx].patientId);
        }
      } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const bedIndex = parseInt(e.key, 10) - 1;
        if (sortedPatients[bedIndex]) {
          setFocusedPatientIndex(bedIndex);
          setSelectedPatientId(sortedPatients[bedIndex].patientId);
          setMobileView('DETAIL');
        }
      } else if (e.key === 'a' || e.key === 'A') {
        const target = sortedPatients[focusedPatientIndex];
        if (target) handleAcknowledge(target.patientId);
      } else if (e.key === 'd' || e.key === 'D') {
        setIsDiagnosticsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPatientIndex, sortedPatients, handleAcknowledge]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-cyan-500 selection:text-black">
      {/* Top Command Center Header */}
      <WardHeader
        wardName="Ward 4B — Acute Surgical & Step-Down"
        shiftLead="Nurse Rachel Hayes, RN"
        shiftHours="Day Shift 07:00 - 19:00"
        streamStatus={streamStatus}
        streamSeq={streamSeq}
        connectivityState={connectivityState}
        pendingSyncCount={pendingSyncCount}
        totalPatients={patients.length}
        criticalCount={criticalCount}
        evaluateCount={evaluateCount}
        watchCount={watchCount}
        lowCount={lowCount}
        activeScenario={activeScenario}
        onScenarioChange={handleScenarioChange}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenCamera={() => setIsCameraModalOpen(true)}
      />

      {/* Realtime Telemetry Interruption / Reconnecting Clinical Banner */}
      {streamStatus === 'RECONNECTING' && (
        <div className="bg-amber-950/90 border-b border-amber-600/50 px-6 py-2.5 text-amber-200 text-xs font-mono flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>REALTIME TELEMETRY INTERRUPTED:</strong> Reconnecting to Ward 4B telemetry broker... Bedside vitals frozen at sequence #{streamSeq}. Dead-man watchdog active.
            </span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50 text-[10px] uppercase tracking-wider font-bold">
            Anti-Rollback Engaged
          </span>
        </div>
      )}
      {streamStatus === 'DISCONNECTED' && (
        <div className="bg-rose-950/90 border-b border-rose-600/50 px-6 py-2.5 text-rose-200 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              <strong>TELEMETRY OFFLINE:</strong> Realtime stream connection lost. Clinical actions will queue locally in edge storage.
            </span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50 text-[10px] uppercase tracking-wider font-bold">
            Edge Queue Buffered
          </span>
        </div>
      )}

      {/* Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        streamStatus={streamStatus}
        streamSeq={streamSeq}
        pendingSyncCount={pendingSyncCount}
      />

      {/* Bedside Optical rPPG Camera Modal & DevTools Privacy Inspector */}
      <BedsideCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        patientId={selectedPatient?.patientId}
        bedNumber={selectedPatient?.bedNumber}
        onVitalsDetected={(vitals) => {
          if (selectedPatient) {
            setPatients((prev) =>
              prev.map((p) =>
                p.patientId === selectedPatient.patientId
                  ? {
                      ...p,
                      vitals: {
                        ...p.vitals,
                        heartRate: vitals.heartRate ?? p.vitals.heartRate,
                      },
                      signalQuality: {
                        ...p.signalQuality,
                        sqiScore: Math.round(vitals.signalQuality * 100),
                      },
                    }
                  : p
              )
            );
          }
        }}
      />

      {/* Flagship Deterministic Demo Scrubber */}
      <DemoScrubber
        onApplyStep={(updatedPatients, targetPatientId) => {
          setPatients(updatedPatients);
          if (targetPatientId) {
            setSelectedPatientId(targetPatientId);
            const idx = updatedPatients.findIndex((p) => p.patientId === targetPatientId);
            if (idx !== -1) setFocusedPatientIndex(idx);
          }
        }}
      />

      {/* Mobile/Tablet View Switcher (< lg screens) */}
      <div className="lg:hidden px-4 pt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMobileView('QUEUE')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-colors ${
            mobileView === 'QUEUE'
              ? 'bg-cyan-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          Attention Queue ({patients.length} Beds)
        </button>
        <button
          type="button"
          onClick={() => setMobileView('DETAIL')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-colors ${
            mobileView === 'DETAIL'
              ? 'bg-cyan-600 text-white shadow'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          Bed {selectedPatient?.bedNumber} Detail
        </button>
      </div>

      {/* Main Operational Command Center Grid */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Primary Attention Queue */}
          <div
            className={`lg:col-span-6 xl:col-span-6 space-y-4 ${
              mobileView === 'DETAIL' ? 'hidden lg:block' : 'block'
            }`}
          >
            <AttentionQueue
              patients={patients}
              selectedPatientId={selectedPatientId}
              focusedPatientIndex={focusedPatientIndex}
              onSelectPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
                setMobileView('DETAIL');
              }}
              onAcknowledgePatient={handleAcknowledge}
            />
          </div>

          {/* Right Column: Patient Detail Panel (Docked & Synchronized) */}
          <div
            className={`lg:col-span-6 xl:col-span-6 lg:sticky lg:top-20 lg:h-[calc(100vh-100px)] ${
              mobileView === 'QUEUE' ? 'hidden lg:block' : 'block'
            }`}
          >
            <PatientDetailPanel
              patient={selectedPatient}
              isEmbedded={true}
              onAcknowledge={handleAcknowledge}
              onLogAssessment={handleLogAssessment}
              onEscalate={handleEscalate}
              onOpenCamera={() => setIsCameraModalOpen(true)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
