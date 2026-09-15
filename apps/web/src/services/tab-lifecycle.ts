/**
 * Tab Lifecycle & Session Inactivity Manager:
 * Handles Page Visibility API, tab suspension, long-running shift memory protection,
 * and automatic synchronization upon browser wake-up.
 */

export interface TabLifecycleOptions {
  onSuspended?: () => void;
  onResume?: (elapsedMs: number) => void;
  staleThresholdMs?: number;
}

export class TabLifecycleManager {
  private lastVisibleTimestamp: number = Date.now();
  private isTabSuspended: boolean = false;
  private staleThresholdMs: number;
  private onSuspended?: () => void;
  private onResume?: (elapsedMs: number) => void;
  private listenerAttached: boolean = false;

  constructor(options: TabLifecycleOptions = {}) {
    this.staleThresholdMs = options.staleThresholdMs ?? 15000;
    this.onSuspended = options.onSuspended;
    this.onResume = options.onResume;
  }

  public init(): () => void {
    if (typeof document === 'undefined' || this.listenerAttached) {
      return () => {};
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab has entered background or suspended state
        this.isTabSuspended = true;
        this.lastVisibleTimestamp = Date.now();
        if (this.onSuspended) {
          this.onSuspended();
        }
      } else {
        // Tab returned to active foreground
        const elapsed = Date.now() - this.lastVisibleTimestamp;
        this.isTabSuspended = false;
        this.lastVisibleTimestamp = Date.now();

        if (this.onResume) {
          this.onResume(elapsed);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.listenerAttached = true;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      this.listenerAttached = false;
    };
  }

  public isSuspended(): boolean {
    return this.isTabSuspended;
  }

  public getLastActive(): number {
    return this.lastVisibleTimestamp;
  }

  public getStaleThresholdMs(): number {
    return this.staleThresholdMs;
  }
}
