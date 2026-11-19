import type {
  AudioCallback,
  PauseCallback,
  PlatformAdapter,
} from '../src/game/types/PlatformTypes';

export class FakePlatform implements PlatformAdapter {
  readonly id = 'mock' as const;
  language = 'ru';
  audioEnabled = true;
  rewardedSupported = true;
  interstitialSupported = true;
  rewardedResult = true;
  interstitialResult = true;
  gameplayStarts = 0;
  gameplayStops = 0;
  rewardedCalls: Array<string | undefined> = [];
  interstitialCalls: Array<string | undefined> = [];
  saves = 0;
  failSaves = 0;
  private readonly store = new Map<string, unknown>();
  private readonly pauseCallbacks = new Set<PauseCallback>();
  private readonly audioCallbacks = new Set<AudioCallback>();

  async init(): Promise<void> {}

  async ready(): Promise<void> {}

  async gameplayStart(): Promise<void> {
    this.gameplayStarts += 1;
  }

  async gameplayStop(): Promise<void> {
    this.gameplayStops += 1;
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

  emitPause(paused: boolean): void {
    for (const callback of this.pauseCallbacks) callback(paused);
  }

  emitAudio(enabled: boolean): void {
    this.audioEnabled = enabled;
    for (const callback of this.audioCallbacks) callback(enabled);
  }

  async showInterstitial(placement?: string): Promise<boolean> {
    this.interstitialCalls.push(placement);
    return this.interstitialResult;
  }

  async showRewarded(placement?: string): Promise<boolean> {
    this.rewardedCalls.push(placement);
    return this.rewardedResult;
  }

  async saveData(key: string, value: unknown): Promise<void> {
    if (this.failSaves > 0) {
      this.failSaves -= 1;
      throw new Error('save failed');
    }
    this.saves += 1;
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }

  async loadData<T>(key: string, fallback: T): Promise<T> {
    return this.store.has(key) ? (this.store.get(key) as T) : fallback;
  }

  isRewardedSupported(): boolean {
    return this.rewardedSupported;
  }

  isInterstitialSupported(): boolean {
    return this.interstitialSupported;
  }
}
