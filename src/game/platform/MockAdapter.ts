import type {
  AudioCallback,
  PauseCallback,
  PlatformAdapter,
} from '../types/PlatformTypes';

export interface KeyValueStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MockAdapterOptions {
  storage?: KeyValueStorageLike;
  language?: string;
  adDelayMs?: number;
  showAdOverlay?: boolean;
  audioEnabled?: boolean;
}

class MemoryStorage implements KeyValueStorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function browserStorage(): KeyValueStorageLike {
  if (typeof localStorage !== 'undefined') return localStorage;
  return new MemoryStorage();
}

export class MockAdapter implements PlatformAdapter {
  readonly id = 'mock' as const;

  private readonly storage: KeyValueStorageLike;
  private readonly language: string;
  private readonly adDelayMs: number;
  private readonly showOverlay: boolean;
  private readonly pauseCallbacks = new Set<PauseCallback>();
  private readonly audioCallbacks = new Set<AudioCallback>();
  private audioEnabled: boolean;
  private paused = false;
  private initialized = false;
  private visibilityBound = false;

  constructor(options: MockAdapterOptions = {}) {
    this.storage = options.storage ?? browserStorage();
    this.language =
      options.language ??
      (typeof navigator !== 'undefined' ? navigator.language : 'en');
    this.adDelayMs = options.adDelayMs ?? 1000;
    this.showOverlay =
      options.showAdOverlay ?? typeof document !== 'undefined';
    this.audioEnabled = options.audioEnabled ?? true;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.bindVisibility();
    console.info('[MockAdapter] initialized');
  }

  async ready(): Promise<void> {
    console.info('[MockAdapter] game_ready');
  }

  async gameplayStart(): Promise<void> {
    console.info('[MockAdapter] gameplay_start');
  }

  async gameplayStop(): Promise<void> {
    console.info('[MockAdapter] gameplay_stop');
  }

  getLanguage(): string {
    return this.language;
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  onPauseChanged(callback: PauseCallback): void {
    this.pauseCallbacks.add(callback);
    this.bindVisibility();
  }

  onAudioChanged(callback: AudioCallback): void {
    this.audioCallbacks.add(callback);
  }

  async showInterstitial(placement?: string): Promise<boolean> {
    return this.playMockAd('interstitial', placement);
  }

  async showRewarded(placement?: string): Promise<boolean> {
    return this.playMockAd('rewarded', placement);
  }

  async saveData(key: string, value: unknown): Promise<void> {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[MockAdapter] save failed', error);
    }
  }

  async loadData<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = this.storage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn('[MockAdapter] load failed', error);
      return fallback;
    }
  }

  isRewardedSupported(): boolean {
    return true;
  }

  isInterstitialSupported(): boolean {
    return true;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const callback of this.pauseCallbacks) {
      callback(paused);
    }
  }

  setAudioEnabled(enabled: boolean): void {
    if (this.audioEnabled === enabled) return;
    this.audioEnabled = enabled;
    for (const callback of this.audioCallbacks) {
      callback(enabled);
    }
  }

  private async playMockAd(
    kind: 'rewarded' | 'interstitial',
    placement?: string,
  ): Promise<boolean> {
    const overlay = this.createOverlay(kind, placement);
    console.info(`[MockAdapter] ${kind} started`, placement ?? '');
    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.adDelayMs);
    });
    overlay?.remove();
    console.info(`[MockAdapter] ${kind} finished`);
    return true;
  }

  private createOverlay(
    kind: 'rewarded' | 'interstitial',
    placement?: string,
  ): HTMLDivElement | null {
    if (!this.showOverlay || typeof document === 'undefined') return null;
    const overlay = document.createElement('div');
    overlay.setAttribute('data-mock-ad', kind);
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(24, 52, 72, 0.72)';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = '"Trebuchet MS", sans-serif';
    overlay.style.fontSize = '22px';
    overlay.style.textAlign = 'center';
    overlay.textContent =
      kind === 'rewarded'
        ? `Тестовая rewarded-реклама${placement ? ` · ${placement}` : ''}`
        : `Тестовый interstitial${placement ? ` · ${placement}` : ''}`;
    document.body.appendChild(overlay);
    return overlay;
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      this.setPaused(document.visibilityState === 'hidden');
    });
  }
}
