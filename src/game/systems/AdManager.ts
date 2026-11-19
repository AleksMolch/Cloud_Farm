import type { GameState } from '../types/GameState';
import type { PlatformAdapter } from '../types/PlatformTypes';
import type { EventBus } from './EventBus';
import type { TimeService } from './TimeService';

export const MIN_INTERSTITIAL_SESSION_SECONDS = 180;

export class AdManager {
  constructor(
    private readonly platform: PlatformAdapter,
    private readonly state: GameState,
    private readonly bus: EventBus,
    private readonly time: TimeService,
  ) {}

  isRewardedSupported(): boolean {
    return this.platform.isRewardedSupported();
  }

  isInterstitialSupported(): boolean {
    return this.platform.isInterstitialSupported();
  }

  async showRewarded(placement: string): Promise<boolean> {
    if (!this.isRewardedSupported()) {
      this.bus.emit('toast', { key: 'ad.not_supported' });
      return false;
    }

    await this.stopGameplay();
    this.bus.emit('ad:started', { placement, kind: 'rewarded' });

    let success = false;
    try {
      success = await this.platform.showRewarded(placement);
    } catch (error) {
      console.warn('[AdManager] rewarded ad failed', error);
    }

    await this.startGameplay();
    this.bus.emit('ad:finished', { placement, kind: 'rewarded', success });

    if (success) {
      this.state.stats.adsWatched += 1;
      this.bus.emit('game:save-requested');
    } else {
      this.bus.emit('toast', { key: 'ad.failed' });
    }

    return success;
  }

  async showInterstitial(placement: string): Promise<boolean> {
    if (!this.isInterstitialSupported()) return false;

    const sessionSeconds = (this.time.now() - this.state.stats.sessionStartedAt) / 1000;
    if (sessionSeconds < MIN_INTERSTITIAL_SESSION_SECONDS) return false;

    await this.stopGameplay();
    this.bus.emit('ad:started', { placement, kind: 'interstitial' });

    let shown = false;
    try {
      shown = await this.platform.showInterstitial(placement);
    } catch (error) {
      console.warn('[AdManager] interstitial failed', error);
    }

    await this.startGameplay();
    this.bus.emit('ad:finished', {
      placement,
      kind: 'interstitial',
      success: shown,
    });
    return shown;
  }

  private async stopGameplay(): Promise<void> {
    try {
      await this.platform.gameplayStop();
    } catch (error) {
      console.warn('[AdManager] gameplayStop failed', error);
    }
  }

  private async startGameplay(): Promise<void> {
    try {
      await this.platform.gameplayStart();
    } catch (error) {
      console.warn('[AdManager] gameplayStart failed', error);
    }
  }
}
