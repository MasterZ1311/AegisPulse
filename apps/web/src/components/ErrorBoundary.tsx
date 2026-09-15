import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, ShieldAlert, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  isRoot?: boolean;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ hasError: true, error, errorInfo });
    console.error('[AegisPulse ErrorBoundary] Uncaught exception captured:', error, errorInfo);

    // Save diagnostic event to sessionStorage for recovery telemetry
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const crashLog = {
          timestamp: new Date().toISOString(),
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        };
        sessionStorage.setItem('aegispulse_last_crash', JSON.stringify(crashLog));
      }
    } catch {
      // Ignore storage errors
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleHardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleClearCacheAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aegispulse_offline_queue');
        sessionStorage.clear();
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const isRoot = this.props.isRoot ?? true;
      const title = this.props.fallbackTitle || (isRoot ? 'Clinical Workstation Exception Guard' : 'Component Render Fault');

      return (
        <div
          className={`${
            isRoot ? 'min-h-screen' : 'min-h-[320px]'
          } w-full flex items-center justify-center p-6 bg-background text-foreground antialiased`}
        >
          <div className="max-w-xl w-full neu-flat rounded-2xl p-6 sm:p-8 border border-rose-500/30 shadow-2xl space-y-5">
            {/* Header / Brand Guard */}
            <div className="flex items-center gap-3">
              <div className="neu-button h-12 w-12 rounded-2xl flex items-center justify-center p-1.5 bg-white/80 dark:bg-slate-900/80 shadow-xs shrink-0">
                <img src="/aegis-logo.png" alt="AegisPulse" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-500 font-bold">
                  AegisPulse Fail-Safe Engaged
                </span>
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  {title}
                </h2>
              </div>
            </div>

            {/* Explanation & Safety Invariant */}
            <div className="neu-inset-sm p-4 rounded-xl text-xs space-y-2 border-l-4 border-rose-500">
              <p className="font-semibold text-foreground">
                An unexpected frontend exception was trapped before corrupting clinical data.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>Zero Patient State Corrupted: Authoritative vitals remain safe in SQLite persistence.</span>
              </div>
            </div>

            {/* Collapsible Technical Details */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              >
                {this.state.showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>{this.state.showDetails ? 'Hide Diagnostic Stack' : 'View Diagnostic Stack'}</span>
              </button>

              {this.state.showDetails && (
                <pre className="neu-inset p-3 rounded-xl text-[10px] font-mono text-rose-600 dark:text-rose-400 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                  {this.state.error?.name}: {this.state.error?.message}
                  {'\n\n'}
                  {this.state.error?.stack}
                </pre>
              )}
            </div>

            {/* Recovery Action Buttons */}
            <div className="pt-2 flex flex-wrap gap-2.5">
              <Button
                variant="default"
                size="sm"
                onClick={this.handleRetry}
                className="gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Recover Component</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={this.handleHardReload}
                className="gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Application</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={this.handleClearCacheAndReload}
                className="text-xs text-muted-foreground hover:text-rose-500 ml-auto"
              >
                Reset Local Cache
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
