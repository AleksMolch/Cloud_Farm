import type { PlatformAdapter } from '../types/PlatformTypes';
import type { AnalyticsTransport } from './AnalyticsTransport';
import { LocalAnalyticsTransport } from './AnalyticsTransport';
import { PlaygamaAnalyticsTransport } from './PlaygamaAnalyticsTransport';
import { YandexMetricaTransport } from './YandexMetricaTransport';

export function createAnalyticsTransport(
  platform: PlatformAdapter,
): AnalyticsTransport {
  if (platform.id === 'playgama') {
    const transport = new PlaygamaAnalyticsTransport();
    if (transport.isAvailable()) return transport;
  }

  if (platform.id === 'yandex') {
    const transport = new YandexMetricaTransport();
    if (transport.isAvailable()) return transport;
  }

  return new LocalAnalyticsTransport();
}
