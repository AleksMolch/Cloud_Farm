import type { AnalyticsEvent, AnalyticsTransport } from './AnalyticsTransport';

const METRICA_SCRIPT = 'https://mc.yandex.ru/metrika/tag.js';

function defaultCounterId(): number {
  const value = Number(import.meta.env.VITE_YANDEX_METRICA_COUNTER_ID ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class YandexMetricaTransport implements AnalyticsTransport {
  readonly kind = 'yandex' as const;
  readonly requiresConsent = true;

  private loading: Promise<void> | null = null;
  private initialized = false;

  constructor(private readonly counterId: number = defaultCounterId()) {}

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      this.counterId > 0
    );
  }

  async send(events: AnalyticsEvent[]): Promise<void> {
    await this.ensureReady();
    for (const event of events) {
      try {
        window.ym?.(this.counterId, 'reachGoal', event.name, event.params);
      } catch (error) {
        console.warn('[YandexMetricaTransport] reachGoal failed', error);
      }
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.initialized) return;
    if (!this.loading) {
      this.loading = this.load();
    }
    try {
      await this.loading;
    } catch (error) {
      this.loading = null;
      throw error;
    }
  }

  private async load(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Yandex Metrica counter is not configured');
    }

    let loadedScript = false;
    if (!window.ym) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = METRICA_SCRIPT;
        script.async = true;
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener(
          'error',
          () => reject(new Error('Failed to load Yandex Metrica')),
          { once: true },
        );
        document.head.appendChild(script);
      });
      loadedScript = true;
    }

    if (!window.ym) {
      throw new Error('Yandex Metrica is unavailable');
    }

    if (loadedScript) {
      window.ym(this.counterId, 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
      });
    }
    this.initialized = true;
  }
}
