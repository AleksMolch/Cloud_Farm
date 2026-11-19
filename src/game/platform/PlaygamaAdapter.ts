import type {
  AudioCallback,
  PauseCallback,
  PlatformAdapter,
} from '../types/PlatformTypes';

const BRIDGE_TIMEOUT_MS = 8000;
const AD_TIMEOUT_MS = 90_000;

function waitForBridge(timeoutMs: number): Promise<PlaygamaBridgeLike> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Playgama Bridge requires a browser environment'));
  }
  if (window.bridge) return Promise.resolve(window.bridge);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (window.bridge) {
        clearInterval(timer);
        resolve(window.bridge);
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('Playgama Bridge script did not load'));
      }
    }, 50);
  });
}

export class PlaygamaAdapter implements PlatformAdapter {
  readonly id = 'playgama' as const;

  private bridge: PlaygamaBridgeLike | null = null;
  private language = 'en';
  private audioEnabled = true;
  private rewardedSupported = false;
  private interstitialSupported = false;
  private initialized = false;
  private hasStartedGameplay = false;
  private readonly pauseCallbacks = new Set<PauseCallback>();
  private readonly audioCallbacks = new Set<AudioCallback>();

  async init(): Promise<void> {
    if (this.initialized) return;

    const bridge = await waitForBridge(BRIDGE_TIMEOUT_MS);
    await bridge.initialize();
    this.bridge = bridge;

    this.language =
      bridge.platform.language ||
      (typeof navigator !== 'undefined' ? navigator.language : 'en');
    this.audioEnabled = bridge.platform.isAudioEnabled !== false;
    this.rewardedSupported = Boolean(bridge.advertisement.isRewardedSupported);
    this.interstitialSupported = Boolean(
      bridge.advertisement.isInterstitialSupported,
    );

    bridge.platform.on(
      bridge.EVENT_NAME.PAUSE_STATE_CHANGED,
      (...args: unknown[]) => {
        const paused = Boolean(args[0]);
        for (const callback of this.pauseCallbacks) {
          callback(paused);
        }
      },
    );

    bridge.platform.on(
      bridge.EVENT_NAME.AUDIO_STATE_CHANGED,
      (...args: unknown[]) => {
        this.audioEnabled = Boolean(args[0]);
        for (const callback of this.audioCallbacks) {
          callback(this.audioEnabled);
        }
      },
    );

    this.initialized = true;
    console.info('[PlaygamaAdapter] initialized', this.getPlatformId());
  }

  async ready(): Promise<void> {
    await this.sendMessage('game_ready');
  }

  async gameplayStart(): Promise<void> {
    await this.sendMessage(this.hasStartedGameplay ? 'level_resumed' : 'level_started');
    this.hasStartedGameplay = true;
  }

  async gameplayStop(): Promise<void> {
    await this.sendMessage('level_paused');
  }

  getLanguage(): string {
    return this.language;
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  onPauseChanged(callback: PauseCallback): void {
    this.pauseCallbacks.add(callback);
  }

  onAudioChanged(callback: AudioCallback): void {
    this.audioCallbacks.add(callback);
  }

  async showInterstitial(placement?: string): Promise<boolean> {
    const bridge = this.bridge;
    if (!bridge || !this.interstitialSupported) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const event = bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED;
      const handler = (...args: unknown[]): void => {
        const state = String(args[0] ?? '');
        if (state === 'closed') finish(true);
        if (state === 'failed') finish(false);
      };
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        bridge.advertisement.off?.(event, handler);
        resolve(value);
      };

      bridge.advertisement.on(event, handler);
      timer = setTimeout(() => finish(false), AD_TIMEOUT_MS);

      Promise.resolve(bridge.advertisement.showInterstitial(placement)).catch(
        (error) => {
          console.warn('[PlaygamaAdapter] interstitial error', error);
          finish(false);
        },
      );
    });
  }

  async showRewarded(placement?: string): Promise<boolean> {
    const bridge = this.bridge;
    if (!bridge || !this.rewardedSupported) return false;

    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const event = bridge.EVENT_NAME.REWARDED_STATE_CHANGED;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        bridge.advertisement.off?.(event, handler);
        resolve(value);
      };
      const handler = (...args: unknown[]): void => {
        const state = String(args[0] ?? '');
        if (state === 'rewarded') rewarded = true;
        if (state === 'closed') finish(rewarded);
        if (state === 'failed') finish(false);
      };

      bridge.advertisement.on(event, handler);
      timer = setTimeout(() => finish(rewarded), AD_TIMEOUT_MS);

      Promise.resolve(bridge.advertisement.showRewarded(placement)).catch(
        (error) => {
          console.warn('[PlaygamaAdapter] rewarded error', error);
          finish(false);
        },
      );
    });
  }

  async saveData(key: string, value: unknown): Promise<void> {
    if (!this.bridge) throw new Error('Playgama Bridge is not initialized');
    await this.bridge.storage.set(key, JSON.stringify(value));
  }

  async loadData<T>(key: string, fallback: T): Promise<T> {
    if (!this.bridge) throw new Error('Playgama Bridge is not initialized');
    const raw = await this.bridge.storage.get(key);
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as T;
  }

  isRewardedSupported(): boolean {
    return this.rewardedSupported;
  }

  isInterstitialSupported(): boolean {
    return this.interstitialSupported;
  }

  getPlatformId(): string {
    return this.bridge?.platform.id ?? 'unknown';
  }

  private async sendMessage(message: string): Promise<void> {
    try {
      await this.bridge?.platform.sendMessage(message);
    } catch (error) {
      console.warn('[PlaygamaAdapter] sendMessage failed', message, error);
    }
  }
}
