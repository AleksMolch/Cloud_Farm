import type { AnalyticsEvent, AnalyticsTransport } from './AnalyticsTransport';

export class PlaygamaAnalyticsTransport implements AnalyticsTransport {
  readonly kind = 'playgama' as const;
  readonly requiresConsent = true;

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.bridge?.analytics?.send === 'function'
    );
  }

  async send(events: AnalyticsEvent[]): Promise<void> {
    const send = window.bridge?.analytics?.send;
    if (typeof send !== 'function') {
      throw new Error('Playgama analytics is unavailable');
    }
    for (const event of events) {
      await send(event.name, event.params);
    }
  }
}
