import type { PlatformAdapter } from '../types/PlatformTypes';
import { MockAdapter } from './MockAdapter';
import { PlaygamaAdapter } from './PlaygamaAdapter';
import { YandexAdapter } from './YandexAdapter';

function forcedPlatform(): string | null {
  if (typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('platform');
}

function isYandexHost(): boolean {
  if (typeof location === 'undefined') return false;
  const host = location.hostname.toLowerCase();
  return [
    'yandex.ru',
    'yandex.com',
    'yandex.net',
    'yandex.by',
    'yandex.kz',
    'yandex.ua',
    'yandex.com.tr',
  ].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

async function initMock(): Promise<PlatformAdapter> {
  const adapter = new MockAdapter();
  await adapter.init();
  return adapter;
}

export type PlatformChoice = 'mock' | 'playgama' | 'yandex';

export function choosePlatformKind(
  forced: string | null,
  hasBridge: boolean,
  onYandexHost: boolean,
): PlatformChoice {
  if (forced === 'mock') return 'mock';
  if (forced === 'yandex') return 'yandex';
  if (forced === 'playgama') return 'playgama';
  if (hasBridge) return 'playgama';
  if (onYandexHost) return 'yandex';
  return 'mock';
}

export async function createPlatform(): Promise<PlatformAdapter> {
  const forced = forcedPlatform();
  const hasBridge = typeof window !== 'undefined' && Boolean(window.bridge);
  const onYandexHost = isYandexHost();
  const choice = choosePlatformKind(forced, hasBridge, onYandexHost);

  if (choice === 'mock') {
    return initMock();
  }

  if (choice === 'yandex') {
    try {
      const adapter = new YandexAdapter();
      await adapter.init();
      return adapter;
    } catch (error) {
      console.warn('[Platform] Yandex SDK unavailable, falling back to mock', error);
      return initMock();
    }
  }

  try {
    const adapter = new PlaygamaAdapter();
    await adapter.init();
    if (!forced && adapter.getPlatformId() === 'mock') {
      await adapter.ready();
      console.info('[Platform] Playgama is running in mock mode, using local mock adapter');
      return initMock();
    }
    return adapter;
  } catch (error) {
    console.warn('[Platform] Playgama Bridge unavailable', error);
    if (onYandexHost) {
      try {
        const adapter = new YandexAdapter();
        await adapter.init();
        return adapter;
      } catch (yandexError) {
        console.warn('[Platform] Yandex SDK unavailable, falling back to mock', yandexError);
      }
    }
    return initMock();
  }
}
