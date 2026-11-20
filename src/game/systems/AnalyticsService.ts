import type { AnalyticsEvent, AnalyticsParams, AnalyticsTransport } from '../analytics/AnalyticsTransport';
import type { GameData } from '../types/ConfigTypes';
import type { AnalyticsConsent, GameState } from '../types/GameState';
import type { EventBus } from './EventBus';
import type { TimeService } from './TimeService';

export interface AnalyticsServiceOptions {
  state: GameState;
  data: GameData;
  time: TimeService;
  bus: EventBus;
  transport: AnalyticsTransport;
  queueLimit?: number;
}

function createInstallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export class AnalyticsService {
  private readonly state: GameState;
  private readonly data: GameData;
  private readonly time: TimeService;
  private readonly bus: EventBus;
  private readonly transport: AnalyticsTransport;
  private readonly queueLimit: number;
  private readonly queue: AnalyticsEvent[] = [];
  private readonly pendingFirstEvents = new Set<string>();
  private readonly sessionStartedAt: number;

  constructor(options: AnalyticsServiceOptions) {
    this.state = options.state;
    this.data = options.data;
    this.time = options.time;
    this.bus = options.bus;
    this.transport = options.transport;
    this.queueLimit = options.queueLimit ?? 100;
    this.sessionStartedAt = this.state.stats.sessionStartedAt;

    if (!this.state.analytics.installId) {
      this.state.analytics.installId = createInstallId();
    }

    this.wireEvents();
  }

  requiresConsent(): boolean {
    return this.transport.requiresConsent && this.transport.isAvailable();
  }

  shouldAskConsent(): boolean {
    return (
      this.requiresConsent() &&
      this.state.analytics.consent === 'unknown'
    );
  }

  getConsent(): AnalyticsConsent {
    return this.state.analytics.consent;
  }

  getTransportKind(): AnalyticsTransport['kind'] {
    return this.transport.kind;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  setConsent(consent: AnalyticsConsent): void {
    if (this.state.analytics.consent === consent) return;
    this.state.analytics.consent = consent;
    if (consent === 'granted') {
      this.flush();
      this.track('consent_granted');
    } else if (consent === 'denied') {
      this.queue.length = 0;
      this.pendingFirstEvents.clear();
    }
    this.bus.emit('analytics:consent-changed', { consent });
    this.bus.emit('game:save-requested');
  }

  trackFirstTap(): void {
    this.trackOnce('first_tap');
  }

  track(name: string, params: AnalyticsParams = {}): void {
    this.acceptEvent({
      name,
      params: this.enrich(params),
    });
  }

  private trackOnce(name: string, params: AnalyticsParams = {}): void {
    if (
      this.state.analytics.firstEvents.includes(name) ||
      this.pendingFirstEvents.has(name)
    ) {
      return;
    }
    this.acceptEvent({
      name,
      params: this.enrich(params),
      onceKey: name,
    });
  }

  private acceptEvent(event: AnalyticsEvent): void {
    if (this.canSend()) {
      if (event.onceKey) this.pendingFirstEvents.add(event.onceKey);
      this.dispatch([event]);
      return;
    }
    if (this.shouldQueue() && this.queue.length < this.queueLimit) {
      this.queue.push(event);
      if (event.onceKey) this.pendingFirstEvents.add(event.onceKey);
    }
  }

  private canSend(): boolean {
    return (
      !this.transport.requiresConsent ||
      this.state.analytics.consent === 'granted'
    );
  }

  private shouldQueue(): boolean {
    return (
      this.transport.requiresConsent &&
      this.transport.isAvailable() &&
      this.state.analytics.consent === 'unknown'
    );
  }

  private dispatch(events: AnalyticsEvent[]): void {
    if (!this.transport.isAvailable()) {
      this.clearPending(events);
      return;
    }
    for (const event of events) {
      if (event.onceKey) {
        this.markOnce(event.onceKey);
      }
    }
    this.clearPending(events);
    void this.transport.send(events).catch((error) => {
      console.warn('[AnalyticsService] event delivery failed', error);
    });
  }

  private flush(): void {
    if (!this.canSend() || this.queue.length === 0) return;
    const events = this.queue.splice(0, this.queue.length);
    this.dispatch(events);
  }

  private clearPending(events: AnalyticsEvent[]): void {
    for (const event of events) {
      if (event.onceKey) this.pendingFirstEvents.delete(event.onceKey);
    }
  }

  private markOnce(name: string): void {
    if (this.state.analytics.firstEvents.includes(name)) return;
    this.state.analytics.firstEvents.push(name);
    this.bus.emit('game:save-requested');
  }

  private enrich(params: AnalyticsParams): AnalyticsParams {
    return {
      ...params,
      elapsed_ms: Math.max(0, this.time.now() - this.sessionStartedAt),
    };
  }

  private wireEvents(): void {
    this.bus.on('crop:collected', ({ objectId, auto }) => {
      this.trackOnce('first_harvest', {
        object_id: objectId,
        auto,
      });
    });
    this.bus.on('order:completed', ({ templateId }) => {
      this.trackOnce('first_order', { template_id: templateId });
    });
    this.bus.on('object:upgraded', ({ objectId, level }) => {
      this.trackOnce('first_upgrade', { object_id: objectId, level });
    });
    this.bus.on('object:unlocked', ({ objectId }) => {
      const config = this.data.objects[objectId];
      if (config?.kind === 'animal') {
        this.trackOnce('first_animal', { object_id: objectId });
      }
    });
    this.bus.on('zone:unlocked', ({ zoneId }) => {
      this.trackOnce('first_zone', { zone_id: zoneId });
    });
    this.bus.on('tutorial:step_completed', ({ stepId }) => {
      this.track('tutorial_step', { step: stepId });
    });
    this.bus.on('tutorial:changed', ({ stepId }) => {
      if (stepId === null) this.trackOnce('tutorial_completed');
    });
    this.bus.on('story:beat', ({ beatId }) => {
      this.track('story_beat_shown', { beat_id: beatId });
    });
    this.bus.on('offline:claimed', ({ multiplier, gains }) => {
      this.track('offline_claimed', {
        multiplier,
        total: gains.reduce((sum, amount) => sum + amount.amount, 0),
      });
    });
  }
}
