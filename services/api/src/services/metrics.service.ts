export interface LatencyHistogram {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  samples: number[];
}

function createHistogram(): LatencyHistogram {
  return {
    count: 0,
    totalMs: 0,
    minMs: Number.MAX_SAFE_INTEGER,
    maxMs: 0,
    avgMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    samples: [],
  };
}

function updateHistogram(h: LatencyHistogram, durationMs: number): void {
  h.count += 1;
  h.totalMs += durationMs;
  if (durationMs < h.minMs) h.minMs = durationMs;
  if (durationMs > h.maxMs) h.maxMs = durationMs;
  h.avgMs = Number((h.totalMs / h.count).toFixed(2));

  // Maintain sliding reservoir of 500 samples for percentile calculations
  h.samples.push(durationMs);
  if (h.samples.length > 500) {
    h.samples.shift();
  }

  const sorted = [...h.samples].sort((a, b) => a - b);
  h.p50Ms = sorted[Math.floor(sorted.length * 0.5)] || 0;
  h.p95Ms = sorted[Math.floor(sorted.length * 0.95)] || 0;
  h.p99Ms = sorted[Math.floor(sorted.length * 0.99)] || 0;
}

export class MetricsService {
  private startTime = Date.now();

  // Counters
  public observationsTotal = {
    BEDSIDE_DEVICE: 0,
    MANUAL_VERIFIED: 0,
    RPPG_CAMERA: 0,
    SIMULATED: 0,
    OTHER: 0,
  };

  public signalFailuresTotal = {
    MOTION_ARTIFACT: 0,
    POOR_LIGHTING: 0,
    FACE_OCCLUSION: 0,
    OTHER: 0,
  };

  public apsEvaluationsTotal = {
    CRITICAL_REVIEW: 0,
    EVALUATE: 0,
    WATCH: 0,
    LOW: 0,
  };

  public priorityRankChangesTotal = 0;
  public realtimeMessagesBroadcastTotal = 0;
  public realtimeActiveConnections = 0;
  public offlineSyncBatchesTotal = 0;
  public offlineSyncItemsTotal = 0;
  public clinicalActionsAcknowledgedTotal = 0;
  public clinicalRrtEscalationsTotal = 0;
  public databaseOperationsTotal = { read: 0, write: 0, errors: 0 };

  // Latency Histograms
  public apsCalculationLatency = createHistogram();
  public dbQueryLatency = createHistogram();
  public apiRequestLatency = createHistogram();

  public recordApsDuration(durationMs: number, category?: string): void {
    updateHistogram(this.apsCalculationLatency, durationMs);
    if (category && category in this.apsEvaluationsTotal) {
      (this.apsEvaluationsTotal as any)[category] += 1;
    }
  }

  public recordDbQuery(op: 'read' | 'write', durationMs: number): void {
    this.databaseOperationsTotal[op] += 1;
    updateHistogram(this.dbQueryLatency, durationMs);
  }

  public recordDbError(): void {
    this.databaseOperationsTotal.errors += 1;
  }

  public recordApiRequest(durationMs: number): void {
    updateHistogram(this.apiRequestLatency, durationMs);
  }

  public recordObservation(source: string): void {
    if (source in this.observationsTotal) {
      (this.observationsTotal as any)[source] += 1;
    } else {
      this.observationsTotal.OTHER += 1;
    }
  }

  public recordSignalFailure(reason: string): void {
    if (reason.toLowerCase().includes('motion')) {
      this.signalFailuresTotal.MOTION_ARTIFACT += 1;
    } else if (reason.toLowerCase().includes('light')) {
      this.signalFailuresTotal.POOR_LIGHTING += 1;
    } else if (reason.toLowerCase().includes('face') || reason.toLowerCase().includes('occlusion')) {
      this.signalFailuresTotal.FACE_OCCLUSION += 1;
    } else {
      this.signalFailuresTotal.OTHER += 1;
    }
  }

  public recordPriorityRankChange(): void {
    this.priorityRankChangesTotal += 1;
  }

  public recordBroadcast(): void {
    this.realtimeMessagesBroadcastTotal += 1;
  }

  public setRealtimeConnections(count: number): void {
    this.realtimeActiveConnections = count;
  }

  public recordSyncBatch(itemCount: number): void {
    this.offlineSyncBatchesTotal += 1;
    this.offlineSyncItemsTotal += itemCount;
  }

  public recordActionAcknowledged(): void {
    this.clinicalActionsAcknowledgedTotal += 1;
  }

  public recordRrtEscalation(): void {
    this.clinicalRrtEscalationsTotal += 1;
  }

  public getSnapshot(): Record<string, any> {
    const memory = process.memoryUsage();
    return {
      service: 'aegispulse-api',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
      },
      counters: {
        observations: this.observationsTotal,
        signalFailures: this.signalFailuresTotal,
        apsEvaluations: this.apsEvaluationsTotal,
        priorityRankChanges: this.priorityRankChangesTotal,
        realtimeBroadcasts: this.realtimeMessagesBroadcastTotal,
        activeStreams: this.realtimeActiveConnections,
        offlineSyncBatches: this.offlineSyncBatchesTotal,
        offlineSyncItems: this.offlineSyncItemsTotal,
        actionsAcknowledged: this.clinicalActionsAcknowledgedTotal,
        rrtEscalations: this.clinicalRrtEscalationsTotal,
        databaseOperations: this.databaseOperationsTotal,
      },
      latency: {
        apsCalculation: {
          count: this.apsCalculationLatency.count,
          avgMs: this.apsCalculationLatency.avgMs,
          p50Ms: this.apsCalculationLatency.p50Ms,
          p95Ms: this.apsCalculationLatency.p95Ms,
          p99Ms: this.apsCalculationLatency.p99Ms,
          maxMs: this.apsCalculationLatency.maxMs,
        },
        databaseQueries: {
          count: this.dbQueryLatency.count,
          avgMs: this.dbQueryLatency.avgMs,
          p50Ms: this.dbQueryLatency.p50Ms,
          p95Ms: this.dbQueryLatency.p95Ms,
          p99Ms: this.dbQueryLatency.p99Ms,
          maxMs: this.dbQueryLatency.maxMs,
        },
        apiRequests: {
          count: this.apiRequestLatency.count,
          avgMs: this.apiRequestLatency.avgMs,
          p50Ms: this.apiRequestLatency.p50Ms,
          p95Ms: this.apiRequestLatency.p95Ms,
          p99Ms: this.apiRequestLatency.p99Ms,
          maxMs: this.apiRequestLatency.maxMs,
        },
      },
    };
  }

  public getPrometheusText(): string {
    const s = this.getSnapshot();
    const lines: string[] = [
      '# HELP aegispulse_uptime_seconds Process uptime in seconds',
      '# TYPE aegispulse_uptime_seconds gauge',
      `aegispulse_uptime_seconds ${s.uptimeSeconds}`,
      '',
      '# HELP aegispulse_memory_heap_used_bytes Memory heap used',
      '# TYPE aegispulse_memory_heap_used_bytes gauge',
      `aegispulse_memory_heap_used_bytes ${process.memoryUsage().heapUsed}`,
      '',
      '# HELP aegispulse_aps_evaluations_total Total APS calculations executed',
      '# TYPE aegispulse_aps_evaluations_total counter',
      `aegispulse_aps_evaluations_total{category="CRITICAL_REVIEW"} ${this.apsEvaluationsTotal.CRITICAL_REVIEW}`,
      `aegispulse_aps_evaluations_total{category="EVALUATE"} ${this.apsEvaluationsTotal.EVALUATE}`,
      `aegispulse_aps_evaluations_total{category="WATCH"} ${this.apsEvaluationsTotal.WATCH}`,
      `aegispulse_aps_evaluations_total{category="LOW"} ${this.apsEvaluationsTotal.LOW}`,
      '',
      '# HELP aegispulse_aps_latency_ms Latency of APS computation in ms',
      '# TYPE aegispulse_aps_latency_ms summary',
      `aegispulse_aps_latency_ms{quantile="0.5"} ${this.apsCalculationLatency.p50Ms}`,
      `aegispulse_aps_latency_ms{quantile="0.95"} ${this.apsCalculationLatency.p95Ms}`,
      `aegispulse_aps_latency_ms{quantile="0.99"} ${this.apsCalculationLatency.p99Ms}`,
      `aegispulse_aps_latency_ms_sum ${this.apsCalculationLatency.totalMs}`,
      `aegispulse_aps_latency_ms_count ${this.apsCalculationLatency.count}`,
      '',
      '# HELP aegispulse_realtime_connections Active stream subscribers',
      '# TYPE aegispulse_realtime_connections gauge',
      `aegispulse_realtime_connections ${this.realtimeActiveConnections}`,
      '',
      '# HELP aegispulse_offline_sync_batches_total Total synced offline batches',
      '# TYPE aegispulse_offline_sync_batches_total counter',
      `aegispulse_offline_sync_batches_total ${this.offlineSyncBatchesTotal}`,
    ];
    return lines.join('\n');
  }

  public reset(): void {
    this.startTime = Date.now();
    this.priorityRankChangesTotal = 0;
    this.realtimeMessagesBroadcastTotal = 0;
    this.realtimeActiveConnections = 0;
    this.offlineSyncBatchesTotal = 0;
    this.offlineSyncItemsTotal = 0;
    this.clinicalActionsAcknowledgedTotal = 0;
    this.clinicalRrtEscalationsTotal = 0;
    this.databaseOperationsTotal = { read: 0, write: 0, errors: 0 };
    this.apsCalculationLatency = createHistogram();
    this.dbQueryLatency = createHistogram();
    this.apiRequestLatency = createHistogram();
  }
}

export const metricsService = new MetricsService();
