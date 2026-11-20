export type AnalyticsValue = string | number | boolean;

export type AnalyticsParams = Record<string, AnalyticsValue>;

export interface AnalyticsEvent {
  name: string;
  params: AnalyticsParams;
  onceKey?: string;
}

export interface AnalyticsTransport {
  readonly kind: 'playgama' | 'yandex' | 'local';
  readonly requiresConsent: boolean;
  isAvailable(): boolean;
  send(events: AnalyticsEvent[]): Promise<void>;
}

export class LocalAnalyticsTransport implements AnalyticsTransport {
  readonly kind = 'local' as const;
  readonly requiresConsent = false;
  private readonly log: AnalyticsEvent[] = [];

  isAvailable(): boolean {
    return true;
  }

  async send(events: AnalyticsEvent[]): Promise<void> {
    this.log.push(...events);
    if (this.log.length > 200) {
      this.log.splice(0, this.log.length - 200);
    }
    for (const event of events) {
      console.debug('[Analytics:local]', event.name, event.params);
    }
  }

  getLog(): AnalyticsEvent[] {
    return [...this.log];
  }
}
