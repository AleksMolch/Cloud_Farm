import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import type {
  AnalyticsEvent,
  AnalyticsTransport,
} from '../src/game/analytics/AnalyticsTransport';
import { AnalyticsService } from '../src/game/systems/AnalyticsService';
import { EventBus } from '../src/game/systems/EventBus';
import { TimeService } from '../src/game/systems/TimeService';
import { FakePlatform } from './fakePlatform';

const NOW = 1_700_000_000_000;

class FakeTransport implements AnalyticsTransport {
  readonly kind = 'playgama' as const;
  readonly requiresConsent = true;
  sent: AnalyticsEvent[] = [];

  isAvailable(): boolean {
    return true;
  }

  async send(events: AnalyticsEvent[]): Promise<void> {
    this.sent.push(...events);
  }
}

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const time = new TimeService(() => NOW + 5000);
  const transport = new FakeTransport();
  const analytics = new AnalyticsService({
    state,
    data,
    time,
    bus,
    transport,
  });
  return { data, state, bus, time, transport, analytics };
}

describe('AnalyticsService', () => {
  it('buffers first events and flushes them after consent', async () => {
    const { analytics, transport, state } = setup();

    analytics.trackFirstTap();
    analytics.trackFirstTap();
    expect(analytics.getQueueSize()).toBe(1);
    expect(transport.sent).toEqual([]);

    analytics.setConsent('granted');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.analytics.consent).toBe('granted');
    expect(analytics.getQueueSize()).toBe(0);
    expect(transport.sent.map((event) => event.name)).toEqual([
      'first_tap',
      'consent_granted',
    ]);
    expect(transport.sent[0].params.elapsed_ms).toBe(5000);
    expect(state.analytics.installId.length).toBeGreaterThan(0);
  });

  it('does not duplicate first events after consent', async () => {
    const { analytics, transport } = setup();
    analytics.trackFirstTap();
    analytics.setConsent('granted');
    await new Promise((resolve) => setTimeout(resolve, 0));

    analytics.trackFirstTap();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      transport.sent.filter((event) => event.name === 'first_tap'),
    ).toHaveLength(1);
  });

  it('clears the buffer when consent is denied', async () => {
    const { analytics, transport } = setup();
    analytics.trackFirstTap();
    analytics.setConsent('denied');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(analytics.getQueueSize()).toBe(0);
    expect(transport.sent).toEqual([]);
  });

  it('maps gameplay events to first-session events', async () => {
    const { analytics, transport, bus } = setup();
    analytics.setConsent('granted');
    await new Promise((resolve) => setTimeout(resolve, 0));

    bus.emit('crop:collected', {
      objectId: 'plot_wheat',
      output: [{ id: 'wheat', amount: 1 }],
      auto: false,
    });
    bus.emit('order:completed', {
      instanceId: 1,
      templateId: 'order_wheat_2',
      reward: [{ id: 'coin', amount: 20 }],
    });
    bus.emit('object:upgraded', {
      objectId: 'plot_wheat',
      level: 2,
      cost: [{ id: 'coin', amount: 20 }],
    });
    bus.emit('object:unlocked', {
      objectId: 'chicken',
      cost: [{ id: 'coin', amount: 100 }],
    });
    bus.emit('zone:unlocked', {
      zoneId: 'terrace',
      cost: [{ id: 'coin', amount: 80 }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(transport.sent.map((event) => event.name)).toEqual([
      'consent_granted',
      'first_harvest',
      'first_order',
      'first_upgrade',
      'first_animal',
      'first_zone',
    ]);
  });

  it('tracks story and tutorial events without PII', async () => {
    const { analytics, transport, bus, state } = setup();
    analytics.setConsent('granted');
    await new Promise((resolve) => setTimeout(resolve, 0));

    bus.emit('tutorial:step_completed', {
      stepId: 'collect_wheat',
      reward: [],
    });
    bus.emit('story:beat', {
      beatId: 'first_order',
      speakerKey: 'story.speaker.keeper',
      textKey: 'story.first_order',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(transport.sent.map((event) => event.name)).toEqual([
      'consent_granted',
      'tutorial_step',
      'story_beat_shown',
    ]);
    expect(JSON.stringify(transport.sent)).not.toContain(
      state.analytics.installId,
    );
    expect(JSON.stringify(transport.sent)).not.toContain('@');
  });

  it('supports local transport without a consent prompt', async () => {
    const data = loadGameData();
    const state = createInitialState(data, NOW);
    const bus = new EventBus();
    const time = new TimeService(() => NOW);
    const analytics = new AnalyticsService({
      state,
      data,
      time,
      bus,
      transport: {
        kind: 'local',
        requiresConsent: false,
        isAvailable: () => true,
        send: async () => undefined,
      },
    });

    expect(analytics.requiresConsent()).toBe(false);
    expect(analytics.shouldAskConsent()).toBe(false);
    expect(new FakePlatform().id).toBe('mock');
  });
});
