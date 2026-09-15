import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import { Button } from './button';

export type WorkflowState = 'LOADING' | 'SUCCESS' | 'EMPTY' | 'ERROR' | 'DEGRADED' | 'OFFLINE';

interface StateViewProps {
  state: WorkflowState;
  loadingMessage?: string;
  loadingTimeoutMs?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  errorMessage?: string;
  errorDetail?: string;
  onRetry?: () => void;
  degradedReason?: string;
  offlineQueuedCount?: number;
  onForceSync?: () => void;
  children?: React.ReactNode;
}

/**
 * Universal Workflow State Container:
 * Guarantees every major user workflow explicitly handles:
 * LOADING, SUCCESS, EMPTY, ERROR, DEGRADED, OFFLINE
 */
export const WorkflowStateContainer: React.FC<StateViewProps> = ({
  state,
  loadingMessage = 'Loading clinical telemetry...',
  loadingTimeoutMs = 8000,
  emptyTitle = 'No Records Found',
  emptyDescription = 'No patient beds or active telemetry records match the current view.',
  emptyActionLabel,
  onEmptyAction,
  errorMessage = 'Clinical Gateway Request Failed',
  errorDetail,
  onRetry,
  degradedReason,
  offlineQueuedCount = 0,
  onForceSync,
  children,
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (state !== 'LOADING') {
      setIsTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, loadingTimeoutMs);

    return () => clearTimeout(timer);
  }, [state, loadingTimeoutMs]);

  // 1. LOADING State (with Slow Network / Timeout detection)
  if (state === 'LOADING') {
    return (
      <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center neu-flat rounded-2xl animate-in fade-in duration-200">
        <div className="neu-button h-12 w-12 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 mb-4">
          <Activity className="h-6 w-6 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{loadingMessage}</h3>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Synchronizing telemetry vectors and score calculations...
        </p>

        {isTimedOut && (
          <div className="mt-4 p-3 rounded-xl neu-inset-sm max-w-sm text-xs text-amber-600 dark:text-amber-400 border border-amber-500/30 flex flex-col items-center gap-2">
            <span>Network response is taking longer than usual.</span>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 font-mono text-xs">
                <RotateCcw className="h-3 w-3" /> Retry Fetch
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. EMPTY State
  if (state === 'EMPTY') {
    return (
      <div className="w-full min-h-[280px] flex flex-col items-center justify-center p-8 text-center neu-flat rounded-2xl">
        <div className="neu-inset-sm h-12 w-12 rounded-2xl flex items-center justify-center text-muted-foreground mb-3">
          <FolderOpen className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{emptyTitle}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{emptyDescription}</p>
        {emptyActionLabel && onEmptyAction && (
          <Button
            size="sm"
            variant="outline"
            onClick={onEmptyAction}
            className="mt-4 font-mono text-xs gap-1.5"
          >
            <span>{emptyActionLabel}</span>
          </Button>
        )}
      </div>
    );
  }

  // 3. ERROR State
  if (state === 'ERROR') {
    return (
      <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center neu-flat rounded-2xl border border-rose-500/30">
        <div className="neu-button h-12 w-12 rounded-2xl flex items-center justify-center text-rose-500 mb-3">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{errorMessage}</h3>
        {errorDetail && (
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md font-mono">
            {errorDetail}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          {onRetry && (
            <Button
              size="sm"
              variant="default"
              onClick={onRetry}
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Request</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 4. OFFLINE State
  if (state === 'OFFLINE') {
    return (
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              <strong>OFFLINE MODE:</strong> No active network connection.
              {offlineQueuedCount > 0 ? ` ${offlineQueuedCount} action(s) stored in edge queue.` : ' Local mutations will queue automatically.'}
            </span>
          </div>
          {onForceSync && (
            <Button
              size="sm"
              variant="outline"
              onClick={onForceSync}
              className="h-7 text-xs border-rose-500/40 hover:bg-rose-500/10 text-rose-300 font-mono"
            >
              Check Link
            </Button>
          )}
        </div>
        {children}
      </div>
    );
  }

  // 5. DEGRADED State
  if (state === 'DEGRADED') {
    return (
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>DEGRADED TELEMETRY:</strong> {degradedReason || 'Telemetry link undergoing intermittent jitter or sensor quality drop. High-confidence gating active.'}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded neu-inset-sm text-amber-400 uppercase font-bold">
            Guarded
          </span>
        </div>
        {children}
      </div>
    );
  }

  // 6. SUCCESS State
  return <>{children}</>;
};
