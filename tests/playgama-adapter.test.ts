import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaygamaAdapter } from '../src/game/platform/PlaygamaAdapter';

type Handler = (...args: unknown[]) => void;

function setupBridge() {
  const handlers = new Map<string, Handler[]>();
  const sent: string[] = [];
  const storage = new Map<string, unknown>();

  const on = (event: string, handler: Handler): void => {
    const list = handlers.get(event) ?? [];
    list.push(handler);
    handlers.set(event, list);
  };

  const bridge = {
    initialize: vi.fn(async () => undefined),
    platform: {
      language: 'ru-RU',
      id: 'playgama',
      isAudioEnabled: true,
      sendMessage: vi.fn(async (message: string) => {
        sent.push(message);
      }),
      on,
    },
    storage: {
      get: vi.fn(async (key: string | string[]) => {
        if (Array.isArray(key)) return key.map((item) => storage.get(item) ?? null);
        return storage.get(key) ?? null;
      }),
      set: vi.fn(async (key: string | string[], value: unknown) => {
        if (Array.isArray(key)) {
          key.forEach((item, index) => storage.set(item, (value as unknown[])[index]));
        } else {
          storage.set(key, value);
        }
      }),
    },
    advertisement: {
      isRewardedSupported: true,
      isInterstitialSupported: true,
      rewardedState: '',
      interstitialState: '',
      showRewarded: vi.fn(async () => undefined),
      showInterstitial: vi.fn(async () => undefined),
      on,
    },
    EVENT_NAME: {
      PAUSE_STATE_CHANGED: 'pause',
      AUDIO_STATE_CHANGED: 'audio',
      REWARDED_STATE_CHANGED: 'rewarded',
      INTERSTITIAL_STATE_CHANGED: 'interstitial',
    },
  };

  return { bridge, handlers, sent, storage };
}

async function createAdapter() {
  const context = setupBridge();
  vi.stubGlobal('window', { bridge: context.bridge });
  vi.stubGlobal('navigator', { language: 'en-US' });
  const adapter = new PlaygamaAdapter();
  await adapter.init();
  return { adapter, ...context };
}

function emit(
  handlers: Map<string, Handler[]>,
  event: string,
  ...args: unknown[]
): void {
  for (const handler of handlers.get(event) ?? []) {
    handler(...args);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlaygamaAdapter', () => {
  it('initializes, reads language, sends ready and persists data', async () => {
    const { adapter, sent } = await createAdapter();

    expect(adapter.getLanguage()).toBe('ru-RU');
    await adapter.ready();
    expect(sent).toContain('game_ready');

    await adapter.saveData('save', { coin: 5 });
    expect(await adapter.loadData('save', null)).toEqual({ coin: 5 });
    expect(await adapter.loadData('missing', { fallback: true })).toEqual({
      fallback: true,
    });
  });

  it('grants rewarded only after the rewarded state', async () => {
    const { adapter, handlers } = await createAdapter();

    const success = adapter.showRewarded('offline_double');
    emit(handlers, 'rewarded', 'opened');
    emit(handlers, 'rewarded', 'rewarded');
    emit(handlers, 'rewarded', 'closed');
    expect(await success).toBe(true);

    const cancelled = adapter.showRewarded('speed_up');
    emit(handlers, 'rewarded', 'opened');
    emit(handlers, 'rewarded', 'closed');
    expect(await cancelled).toBe(false);
  });

  it('propagates storage failures to the save layer', async () => {
    const { adapter, bridge } = await createAdapter();
    bridge.storage.get.mockRejectedValueOnce(new Error('storage down'));

    await expect(adapter.loadData('save', null)).rejects.toThrow('storage down');
  });

  it('resolves interstitial from its state event', async () => {
    const { adapter, handlers } = await createAdapter();

    const shown = adapter.showInterstitial('zone_unlocked');
    emit(handlers, 'interstitial', 'closed');
    expect(await shown).toBe(true);
  });

  it('forwards pause and audio state changes', async () => {
    const { adapter, handlers } = await createAdapter();
    const pause = vi.fn();
    const audio = vi.fn();
    adapter.onPauseChanged(pause);
    adapter.onAudioChanged(audio);

    emit(handlers, 'pause', true);
    emit(handlers, 'audio', false);

    expect(pause).toHaveBeenCalledWith(true);
    expect(audio).toHaveBeenCalledWith(false);
    expect(adapter.isAudioEnabled()).toBe(false);
  });
});
