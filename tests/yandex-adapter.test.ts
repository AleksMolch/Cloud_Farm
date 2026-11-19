import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveYandexLanguage,
  YandexAdapter,
} from '../src/game/platform/YandexAdapter';

type CallbackSet = {
  onOpen?(): void;
  onRewarded?(): void;
  onClose?(wasShown: boolean): void;
  onError?(error: unknown): void;
};

function setupSdk(storageError = false) {
  const calls = { ready: 0, start: 0, stop: 0, rewarded: 0, fullscreen: 0 };
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  const ysdk = {
    environment: { i18n: { lang: 'ru' } },
    features: {
      LoadingAPI: { ready: () => (calls.ready += 1) },
      GameplayAPI: {
        start: () => (calls.start += 1),
        stop: () => (calls.stop += 1),
      },
    },
    adv: {
      showFullscreenAdv: ({ callbacks }: { callbacks?: CallbackSet }) => {
        calls.fullscreen += 1;
        callbacks?.onClose?.(true);
      },
      showRewardedVideo: ({ callbacks }: { callbacks?: CallbackSet }) => {
        calls.rewarded += 1;
        callbacks?.onRewarded?.();
        callbacks?.onClose?.(true);
      },
    },
    getStorage: async () => {
      if (storageError) throw new Error('safe storage unavailable');
      return storage;
    },
  };

  return { ysdk, calls, values };
}

async function createAdapter(storageError = false) {
  const context = setupSdk(storageError);
  vi.stubGlobal('window', {
    YaGames: { init: async () => context.ysdk },
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
  });
  vi.stubGlobal('navigator', { language: 'en-US' });
  const adapter = new YandexAdapter();
  await adapter.init();
  return { adapter, ...context };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('YandexAdapter', () => {
  it('uses Yandex i18n language before navigator.language', () => {
    expect(resolveYandexLanguage('ru', 'en-US')).toBe('ru');
    expect(resolveYandexLanguage(undefined, 'en-US')).toBe('en-US');
    expect(resolveYandexLanguage(undefined, undefined)).toBe('en');
  });

  it('reports lifecycle, language, storage and ads', async () => {
    const { adapter, calls } = await createAdapter();

    expect(adapter.getLanguage()).toBe('ru');
    await adapter.ready();
    await adapter.gameplayStart();
    await adapter.gameplayStop();
    await adapter.saveData('save', { coin: 7 });
    expect(await adapter.loadData('save', null)).toEqual({ coin: 7 });
    expect(await adapter.showRewarded()).toBe(true);
    expect(await adapter.showInterstitial()).toBe(true);

    expect(calls).toMatchObject({
      ready: 1,
      start: 1,
      stop: 1,
      rewarded: 1,
      fullscreen: 1,
    });
  });

  it('does not fall back to localStorage when safe storage is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: vi.fn() });
    const { adapter } = await createAdapter(true);

    await expect(adapter.saveData('save', { coin: 1 })).rejects.toThrow(
      'safe storage unavailable',
    );
    await expect(adapter.loadData('save', null)).rejects.toThrow(
      'safe storage unavailable',
    );
    expect(setItem).not.toHaveBeenCalled();
  });
});
