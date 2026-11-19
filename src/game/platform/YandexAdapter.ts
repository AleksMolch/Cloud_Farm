import type {
  AudioCallback,
  PauseCallback,
  PlatformAdapter,
} from '../types/PlatformTypes';

const SDK_TIMEOUT_MS = 12_000;
const AD_TIMEOUT_MS = 90_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class YandexAdapter implements PlatformAdapter {
  readonly id = 'yandex' as const;

  private ysdk: YandexSDKLike | null = null;
  private storage: YandexStorageLike | null = null;
  private language = 'en';
  private initialized = false;
  private readySent = false;
  private visibilityBound = false;
  private readonly pauseCallbacks = new Set<PauseCallback>();
  private readonly audioCallbacks = new Set<AudioCallback>();

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.ensureSdk();
    const factory = window.YaGames;
    if (!factory) throw new Error('YaGames SDK is not available');

    this.ysdk = await factory.init();
    this.language =
      typeof navigator !== 'undefined' ? navigator.language : 'en';

    try {
      this.storage = (await this.ysdk.getStorage?.()) ?? null;
    } catch (error) {
      console.warn('[YandexAdapter] safe storage unavailable, using localStorage', error);
    }

    this.bindVisibility();
    this.initialized = true;
    console.info('[YandexAdapter] initialized');
  }

  async ready(): Promise<void> {
    if (this.readySent) return;
    this.readySent = true;
    this.ysdk?.features?.LoadingAPI?.ready();
  }

  async gameplayStart(): Promise<void> {
    this.ysdk?.features?.GameplayAPI?.start();
  }

  async gameplayStop(): Promise<void> {
    this.ysdk?.features?.GameplayAPI?.stop();
  }

  getLanguage(): string {
    return this.language;
  }

  isAudioEnabled(): boolean {
    return true;
  }

  onPauseChanged(callback: PauseCallback): void {
    this.pauseCallbacks.add(callback);
    this.bindVisibility();
  }

  onAudioChanged(callback: AudioCallback): void {
    this.audioCallbacks.add(callback);
  }

  async showInterstitial(placement?: string): Promise<boolean> {
    void placement;
    const ysdk = this.ysdk;
    if (!ysdk) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        resolve(value);
      };

      timer = setTimeout(() => finish(false), AD_TIMEOUT_MS);
      try {
        ysdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown: boolean) => finish(Boolean(wasShown)),
            onError: (error: unknown) => {
              console.warn('[YandexAdapter] fullscreen ad error', error);
              finish(false);
            },
          },
        });
      } catch (error) {
        console.warn('[YandexAdapter] fullscreen ad call failed', error);
        finish(false);
      }
    });
  }

  async showRewarded(placement?: string): Promise<boolean> {
    void placement;
    const ysdk = this.ysdk;
    if (!ysdk) return false;

    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        resolve(value);
      };

      timer = setTimeout(() => finish(false), AD_TIMEOUT_MS);
      try {
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(rewarded),
            onError: (error: unknown) => {
              console.warn('[YandexAdapter] rewarded ad error', error);
              finish(false);
            },
          },
        });
      } catch (error) {
        console.warn('[YandexAdapter] rewarded ad call failed', error);
        finish(false);
      }
    });
  }

  async saveData(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.storage) {
      this.storage.setItem(key, serialized);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    }
  }

  async loadData<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = this.storage
        ? this.storage.getItem(key)
        : typeof localStorage !== 'undefined'
          ? localStorage.getItem(key)
          : null;
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn('[YandexAdapter] load failed', error);
      return fallback;
    }
  }

  isRewardedSupported(): boolean {
    return true;
  }

  isInterstitialSupported(): boolean {
    return true;
  }

  private async ensureSdk(): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Yandex Games SDK requires a browser environment');
    }
    if (!window.YaGames) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          'script[data-yandex-sdk]',
        );
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener(
            'error',
            () => reject(new Error('Failed to load /sdk.js')),
            { once: true },
          );
          return;
        }

        const script = document.createElement('script');
        script.src = '/sdk.js';
        script.async = true;
        script.dataset.yandexSdk = 'true';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener(
          'error',
          () => reject(new Error('Failed to load /sdk.js')),
          { once: true },
        );
        document.head.appendChild(script);
      });
    }

    const startedAt = Date.now();
    while (!window.YaGames) {
      if (Date.now() - startedAt >= SDK_TIMEOUT_MS) {
        throw new Error('Timed out waiting for YaGames SDK');
      }
      await delay(50);
    }
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      const paused = document.visibilityState === 'hidden';
      for (const callback of this.pauseCallbacks) {
        callback(paused);
      }
    });
  }
}
