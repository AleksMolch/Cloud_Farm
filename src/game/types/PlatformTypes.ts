export type PlatformId = 'mock' | 'playgama' | 'yandex';

export type PauseCallback = (paused: boolean) => void;
export type AudioCallback = (enabled: boolean) => void;

export interface PlatformAdapter {
  readonly id: PlatformId;
  init(): Promise<void>;
  ready(): Promise<void>;
  gameplayStart(): Promise<void>;
  gameplayStop(): Promise<void>;
  getLanguage(): string;
  isAudioEnabled(): boolean;
  onPauseChanged(callback: PauseCallback): void;
  onAudioChanged(callback: AudioCallback): void;
  showInterstitial(placement?: string): Promise<boolean>;
  showRewarded(placement?: string): Promise<boolean>;
  saveData(key: string, value: unknown): Promise<void>;
  loadData<T>(key: string, fallback: T): Promise<T>;
  isRewardedSupported(): boolean;
  isInterstitialSupported(): boolean;
}
