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

export async function createPlatform(): Promise<PlatformAdapter> {
  const forced = forcedPlatform();

  if (forced === 'mock') {
    return initMock();
  }

  if (forced === 'yandex' || (!forced && isYandexHost())) {
    try {
      const adapter = new YandexAdapter();
      await adapter.init();
      return adapter;
    } catch (error) {
      console.warn('[Platform] Yandex SDK unavailable, falling back to mock', error);
    }
  }

  const hasBridge = typeof window !== 'undefined' && Boolean(window.bridge);
  if (forced === 'playgama' || (!forced && hasBridge)) {
    try {
      const adapter = new PlaygamaAdapter();
      await adapter.init();
      if (!forced && adapter.getPlatformId() === 'mock') {
        console.info('[Platform] Playgama is running in mock mode, using local mock adapter');
        return initMock();
      }
      return adapter;
    } catch (error) {
      console.warn('[Platform] Playgama Bridge unavailable, falling back to mock', error);
    }
  }

  return initMock();
}
