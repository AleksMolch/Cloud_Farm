import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaygamaAnalyticsTransport } from '../src/game/analytics/PlaygamaAnalyticsTransport';
import { LocalAnalyticsTransport } from '../src/game/analytics/AnalyticsTransport';
import { YandexMetricaTransport } from '../src/game/analytics/YandexMetricaTransport';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Analytics transports', () => {
  it('forwards Playgama events through bridge.analytics.send', async () => {
    const send = vi.fn();
    vi.stubGlobal('window', {
      bridge: {
        analytics: { send },
      },
    });
    const transport = new PlaygamaAnalyticsTransport();

    expect(transport.isAvailable()).toBe(true);
    await transport.send([
      { name: 'first_harvest', params: { object_id: 'plot_wheat' } },
    ]);

    expect(send).toHaveBeenCalledWith('first_harvest', {
      object_id: 'plot_wheat',
    });
  });

  it('forwards Yandex goals through window.ym', async () => {
    const ym = vi.fn();
    vi.stubGlobal('window', { ym });
    vi.stubGlobal('document', {});
    const transport = new YandexMetricaTransport(123456);

    expect(transport.isAvailable()).toBe(true);
    await transport.send([
      { name: 'first_order', params: { template_id: 'order_wheat_2' } },
    ]);

    expect(ym).toHaveBeenCalledWith(123456, 'reachGoal', 'first_order', {
      template_id: 'order_wheat_2',
    });
  });

  it('keeps local events in a bounded debug log', async () => {
    const transport = new LocalAnalyticsTransport();
    await transport.send([
      { name: 'first_tap', params: { elapsed_ms: 1 } },
      { name: 'first_harvest', params: { elapsed_ms: 2 } },
    ]);
    expect(transport.getLog().map((event) => event.name)).toEqual([
      'first_tap',
      'first_harvest',
    ]);
  });
});
