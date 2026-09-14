import type {
  SensorProvider,
  SensorReading,
  SensorStatus,
  Unsubscribe,
} from '@aegispulse/types';

/**
 * SensorHub
 * Agnostic aggregation registry for ward sensor providers.
 * Decouples the clinical platform from underlying hardware/simulation mechanisms.
 * Supports hot-swapping and concurrent operation of simulators, webcams, wearables, and bedside monitors.
 */
export class SensorHub {
  private providers: Map<string, SensorProvider> = new Map();
  private readingListeners: Set<(reading: SensorReading) => void> = new Set();
  private statusListeners: Set<(status: SensorStatus) => void> = new Set();
  private providerUnsubscribers: Map<string, Unsubscribe[]> = new Map();

  /**
   * Registers a sensor provider and binds its event streams.
   */
  public registerProvider(provider: SensorProvider): void {
    const id = provider.getProviderId();
    if (this.providers.has(id)) {
      this.unregisterProvider(id);
    }

    this.providers.set(id, provider);

    const unsubs: Unsubscribe[] = [];

    // Forward readings
    const unsubReading = provider.onReading((reading) => {
      for (const listener of this.readingListeners) {
        try {
          listener(reading);
        } catch (err) {
          console.error(`[SensorHub] Error in reading listener from ${id}:`, err);
        }
      }
    });
    unsubs.push(unsubReading);

    // Forward status changes
    const unsubStatus = provider.onStatusChange((status) => {
      for (const listener of this.statusListeners) {
        try {
          listener(status);
        } catch (err) {
          console.error(`[SensorHub] Error in status listener from ${id}:`, err);
        }
      }
    });
    unsubs.push(unsubStatus);

    this.providerUnsubscribers.set(id, unsubs);
  }

  /**
   * Unregisters a provider and cleans up event listeners.
   */
  public unregisterProvider(providerId: string): void {
    const unsubs = this.providerUnsubscribers.get(providerId);
    if (unsubs) {
      for (const unsub of unsubs) unsub();
      this.providerUnsubscribers.delete(providerId);
    }
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.stop();
      this.providers.delete(providerId);
    }
  }

  public getProvider(providerId: string): SensorProvider | undefined {
    return this.providers.get(providerId);
  }

  public getAllProviders(): SensorProvider[] {
    return Array.from(this.providers.values());
  }

  public onReading(callback: (reading: SensorReading) => void): Unsubscribe {
    this.readingListeners.add(callback);
    return () => this.readingListeners.delete(callback);
  }

  public onStatusChange(callback: (status: SensorStatus) => void): Unsubscribe {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  public async startAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.start();
    }
  }

  public async stopAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      await provider.stop();
    }
  }

  /**
   * Returns current operational status of all registered providers.
   */
  public getAllStatuses(): SensorStatus[] {
    return Array.from(this.providers.values()).map((p) => p.getStatus());
  }
}

export const sensorHub = new SensorHub();
