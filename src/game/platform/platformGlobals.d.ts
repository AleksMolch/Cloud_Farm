interface PlaygamaBridgeLike {
  initialize(): Promise<void>;
  platform: {
    language: string;
    id: string;
    isAudioEnabled: boolean;
    sendMessage(message: string, data?: Record<string, unknown>): Promise<void> | void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off?(event: string, callback: (...args: unknown[]) => void): void;
  };
  storage: {
    get(key: string | string[]): Promise<unknown>;
    set(key: string | string[], value: unknown): Promise<void>;
  };
  advertisement: {
    isRewardedSupported: boolean;
    isInterstitialSupported: boolean;
    rewardedState: string;
    interstitialState: string;
    showRewarded(placement?: string): Promise<void> | void;
    showInterstitial(placement?: string): Promise<void> | void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off?(event: string, callback: (...args: unknown[]) => void): void;
  };
  EVENT_NAME: {
    PAUSE_STATE_CHANGED: string;
    AUDIO_STATE_CHANGED: string;
    REWARDED_STATE_CHANGED: string;
    INTERSTITIAL_STATE_CHANGED: string;
  };
}

interface YandexStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface YandexSDKLike {
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
  features?: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(options: {
      callbacks?: {
        onOpen?(): void;
        onClose?(wasShown: boolean): void;
        onError?(error: unknown): void;
      };
    }): void;
    showRewardedVideo(options: {
      callbacks?: {
        onOpen?(): void;
        onRewarded?(): void;
        onClose?(wasShown: boolean): void;
        onError?(error: unknown): void;
      };
    }): void;
  };
  getStorage?(): Promise<YandexStorageLike>;
  getPlayer?(): Promise<unknown>;
}

interface Window {
  bridge?: PlaygamaBridgeLike;
  YaGames?: {
    init(options?: Record<string, unknown>): Promise<YandexSDKLike>;
  };
}
