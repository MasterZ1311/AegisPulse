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
import type { AppPage } from './components/Navigation';
import { ExecutiveLayout } from './components/ExecutiveLayout';
import { WardRadarPage } from './components/pages/WardRadarPage';
import { PatientWorkstationPage } from './components/pages/PatientWorkstationPage';
import { WardAnalyticsPage } from './components/pages/WardAnalyticsPage';
import { WardAuditPage } from './components/pages/WardAuditPage';
import { SimulationPage } from './components/pages/SimulationPage';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { BedsideCameraModal } from './components/BedsideCameraModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TabLifecycleManager } from './services/tab-lifecycle';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AdminPatientModal } from './components/AdminPatientModal';
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

  // Admin Authentication & Patient CRUD State
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aegis-admin-token') !== null;
    }
    return false;
  });

  const [adminUser, setAdminUser] = useState<{ username: string; fullName: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aegis-admin-user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return null;
  });

  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState<boolean>(false);
  const [isAdminPatientModalOpen, setIsAdminPatientModalOpen] = useState<boolean>(false);
  const [adminPatientModalMode, setAdminPatientModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [patientToEdit, setPatientToEdit] = useState<WardPatientRadarState | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [_recentEvents, setRecentEvents] = useState<TelemetryStreamEnvelope[]>([]);
  const [_health, setHealth] = useState<HealthCheckResponse | null>(null);

  // Active Multi-Page state with URL hash synchronization
  const [activePage, setActivePage] = useState<AppPage>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.toLowerCase().replace('#', '');
      if (hash.startsWith('patient')) return 'PATIENT';
      if (hash === 'analytics') return 'ANALYTICS';
      if (hash === 'audit') return 'AUDIT';
      if (hash === 'simulation') return 'SIMULATION';
    }
    return 'RADAR';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aegispulse-theme') as 'dark' | 'light' | null;
      if (saved) return saved;
    }
    return 'light';
  });

  // Synchronize URL hash with activePage and browser history
  const navigateTo = useCallback((page: AppPage, patientId?: string) => {
    setActivePage(page);
    if (page === 'PATIENT') {
      const pId = patientId || selectedPatientId;
      window.location.hash = `#patient/${pId}`;
    } else if (page === 'RADAR') {
      window.location.hash = '#radar';
    } else if (page === 'ANALYTICS') {
      window.location.hash = '#analytics';
    } else if (page === 'AUDIT') {
      window.location.hash = '#audit';
    } else if (page === 'SIMULATION') {
      window.location.hash = '#simulation';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedPatientId]);

  // Listen to browser Back/Forward hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase().replace('#', '');
      if (hash.startsWith('patient')) {
        setActivePage('PATIENT');
        const parts = hash.split('/');
        if (parts[1]) {
          const matched = patients.find((p) => p.patientId.toLowerCase() === parts[1].toLowerCase());
          if (matched) setSelectedPatientId(matched.patientId);
        }
      } else if (hash === 'analytics') {
        setActivePage('ANALYTICS');
      } else if (hash === 'audit') {
        setActivePage('AUDIT');
      } else if (hash === 'simulation') {
        setActivePage('SIMULATION');
      } else {
        setActivePage('RADAR');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [patients]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('aegispulse-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Derive counts for ward navigation
  const criticalCount = patients.filter((p) => p.category === 'CRITICAL_REVIEW').length;
  const evaluateCount = patients.filter((p) => p.category === 'EVALUATE').length;
  const watchCount = patients.filter((p) => p.category === 'WATCH').length;
  const lowCount = patients.filter((p) => p.category === 'LOW').length;

  // Dynamically sorted queue order
  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => b.apsScore - a.apsScore);
  }, [patients]);

  const selectedPatient = patients.find((p) => p.patientId === selectedPatientId) || sortedPatients[0] || null;

  // Dynamically filtered patients by search query
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.bedNumber.toLowerCase().includes(q) ||
        p.admissionDiagnosis.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);
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

    const tabLifecycle = new TabLifecycleManager({
      onResume: (elapsedMs) => {
        if (elapsedMs > 15000) {
          console.info(
            `[AegisPulse] Tab resumed after ${Math.round(elapsedMs / 1000)}s suspension. Reconciling authoritative snapshot.`
          );
          if (client.getStatus() === 'CONNECTED') {
            client.requestSnapshot();
          }
        }
      },
    });
    const unsubLifecycle = tabLifecycle.init();

    client.connect();

    return () => {
      clearInterval(healthInterval);
      unsubOffline();
      unsubLifecycle();
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

  const handleSpotCheckComplete = useCallback(
    (patientId: string, vitals: { heartRate: number; respiratoryRate?: number | null; confidence: number }) => {
      const rrStr = vitals.respiratoryRate ? `, Respiratory Rate ${vitals.respiratoryRate} /min` : '';
      offlineSyncQueue.enqueueClinicalAction(
        patientId,
        'MANUAL_OBSERVATION',
        '15-Second Guided Optical Spot-Check Logged',
        `Contactless optical rPPG: Heart Rate ${vitals.heartRate} bpm${rrStr} (SQI ${vitals.confidence}%).`,
        'INFO'
      );

      setPatients((prev) =>
        prev.map((p) =>
          p.patientId === patientId
            ? {
                ...p,
                vitals: {
                  ...p.vitals,
                  heartRate: vitals.heartRate,
                  ...(vitals.respiratoryRate ? { respiratoryRate: vitals.respiratoryRate } : {}),
                },
                signalQuality: {
                  ...p.signalQuality,
                  confidencePercent: vitals.confidence,
                  motionDetected: false,
                },
                lastTrustedObservationIso: new Date().toISOString(),
                lastTrustedElapsedMinutes: 0,
                isStale: false,
                timeline: [
                  {
                    id: `TL-RPPG-${Date.now()}`,
                    patientId,
                    timestamp: Date.now(),
                    eventType: 'MANUAL_OBSERVATION',
                    title: 'Contactless Optical Spot-Check Verified',
                    description: `Guided 15s rPPG: HR ${vitals.heartRate} bpm, RR ${vitals.respiratoryRate} /min (Confidence ${vitals.confidence}%). Zero raw video stored.`,
                    severity: 'INFO',
                    source: 'OPTICAL_RPPG',
                    isTrusted: true,
                  },
                  ...p.timeline,
                ],
              }
            : p
        )
      );
    },
    []
  );

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

  // Admin Patient CRUD Handlers
  const handleOpenAdmitPatient = useCallback(() => {
    setAdminPatientModalMode('CREATE');
    setPatientToEdit(null);
    setIsAdminPatientModalOpen(true);
  }, []);

  const handleOpenEditPatient = useCallback((patient: WardPatientRadarState) => {
    setAdminPatientModalMode('EDIT');
    setPatientToEdit(patient);
    setIsAdminPatientModalOpen(true);
  }, []);

  const handlePatientSaved = useCallback((savedPatient: WardPatientRadarState) => {
    setPatients((prev) => {
      const idx = prev.findIndex((p) => p.patientId === savedPatient.patientId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = savedPatient;
        return updated;
      }
      return [savedPatient, ...prev];
    });
    setSelectedPatientId(savedPatient.patientId);
  }, []);

  const handlePatientDeleted = useCallback((patientId: string) => {
    setPatients((prev) => {
      const remaining = prev.filter((p) => p.patientId !== patientId);
      if (selectedPatientId === patientId && remaining.length > 0) {
        setSelectedPatientId(remaining[0].patientId);
      }
      return remaining;
    });
    navigateTo('RADAR');
  }, [selectedPatientId, navigateTo]);

  // 3. Accessible Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }

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
          navigateTo('PATIENT', sortedPatients[bedIndex].patientId);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        const target = sortedPatients[focusedPatientIndex] || selectedPatient;
        if (target) handleAcknowledge(target.patientId);
      } else if (e.key === 'd' || e.key === 'D') {
        setIsDiagnosticsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && activePage === 'PATIENT') {
        navigateTo('RADAR');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedPatientIndex, sortedPatients, selectedPatient, handleAcknowledge, activePage, navigateTo]);

  return (
    <div className="min-h-screen bg-[#DCE6DC] antialiased">
      <ExecutiveLayout
        activePage={activePage}
        onNavigate={(page) => navigateTo(page)}
        wardName="Ward 4B — Acute Surgical & Step-Down"
        totalPatients={patients.length}
        criticalCount={criticalCount}
        evaluateCount={evaluateCount}
        watchCount={watchCount}
        lowCount={lowCount}
        maxApsScore={Math.max(...patients.map((p) => p.apsScore), 0)}
        streamStatus={streamStatus}
        streamSeq={streamSeq}
        connectivityState={connectivityState}
        pendingSyncCount={pendingSyncCount}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenCamera={() => setIsCameraModalOpen(true)}
        isAdmin={isAdmin}
        adminUser={adminUser}
        onOpenAdminAuth={() => setIsAdminAuthModalOpen(true)}
        onOpenAdmitPatient={handleOpenAdmitPatient}
        theme={theme}
        onToggleTheme={toggleTheme}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {/* Realtime Telemetry Interruption / Reconnecting Clinical Banner */}
        {streamStatus === 'RECONNECTING' && (
          <div className="bg-amber-500/10 border border-amber-300 px-4 py-2.5 rounded-2xl text-amber-800 text-xs font-mono flex items-center justify-between mb-4 animate-pulse">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>REALTIME TELEMETRY INTERRUPTED:</strong> Reconnecting to Ward 4B telemetry broker... Bedside vitals frozen at sequence #{streamSeq}.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] uppercase tracking-wider font-bold">
              Anti-Rollback Active
            </span>
          </div>
        )}
        {streamStatus === 'DISCONNECTED' && (
          <div className="bg-rose-500/10 border border-rose-300 px-4 py-2.5 rounded-2xl text-rose-800 text-xs font-mono flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                <strong>TELEMETRY OFFLINE:</strong> Realtime stream connection lost. Clinical actions will queue locally in edge storage.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] uppercase tracking-wider font-bold">
              Edge Queue Buffered
            </span>
          </div>
        )}

        <ErrorBoundary fallbackTitle="Clinical View Exception Guard" isRoot={false}>
          {activePage === 'RADAR' && (
            <WardRadarPage
              patients={filteredPatients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
              }}
              onAcknowledgePatient={handleAcknowledge}
              onNavigateToPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
                navigateTo('PATIENT', p.patientId);
              }}
            />
          )}

          {activePage === 'PATIENT' && (
            <PatientWorkstationPage
              patients={filteredPatients}
              selectedPatient={selectedPatient}
              onSelectPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
                navigateTo('PATIENT', p.patientId);
              }}
              onBackToRadar={() => navigateTo('RADAR')}
              onAcknowledge={handleAcknowledge}
              onLogAssessment={handleLogAssessment}
              onEscalate={handleEscalate}
              onSpotCheckComplete={handleSpotCheckComplete}
              onOpenCamera={() => setIsCameraModalOpen(true)}
              isAdmin={isAdmin}
              onEditPatient={handleOpenEditPatient}
            />
          )}

          {activePage === 'ANALYTICS' && (
            <WardAnalyticsPage
              patients={filteredPatients}
              onNavigateToPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
                navigateTo('PATIENT', p.patientId);
              }}
            />
          )}

          {activePage === 'AUDIT' && (
            <WardAuditPage
              patients={filteredPatients}
              onNavigateToPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
                navigateTo('PATIENT', p.patientId);
              }}
            />
          )}

          {activePage === 'SIMULATION' && (
            <SimulationPage
              activeScenario={activeScenario}
              onScenarioChange={handleScenarioChange}
              onApplyStep={(updatedPatients, targetPatientId) => {
                setPatients(updatedPatients);
                if (targetPatientId) {
                  setSelectedPatientId(targetPatientId);
                  const idx = updatedPatients.findIndex((p) => p.patientId === targetPatientId);
                  if (idx !== -1) setFocusedPatientIndex(idx);
                }
              }}
              onNavigateToPatient={(p) => {
                setSelectedPatientId(p.patientId);
                const idx = sortedPatients.findIndex((sp) => sp.patientId === p.patientId);
                if (idx !== -1) setFocusedPatientIndex(idx);
                navigateTo('PATIENT', p.patientId);
              }}
              patients={filteredPatients}
            />
          )}
        </ErrorBoundary>
      </ExecutiveLayout>

      {/* Diagnostics Telemetry Modal */}
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

      {/* Admin Authentication & Mock Credentials Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        isAdmin={isAdmin}
        currentAdmin={adminUser}
        onLoginSuccess={(admin) => {
          setIsAdmin(true);
          setAdminUser({ username: admin.username, fullName: admin.fullName });
        }}
        onLogout={() => {
          setIsAdmin(false);
          setAdminUser(null);
        }}
      />

      {/* Admin Patient CRUD (Admit & Edit) Modal */}
      <AdminPatientModal
        isOpen={isAdminPatientModalOpen}
        onClose={() => setIsAdminPatientModalOpen(false)}
        mode={adminPatientModalMode}
        initialPatient={patientToEdit}
        onSuccess={handlePatientSaved}
        onDelete={handlePatientDeleted}
      />
    </div>
  );
}
