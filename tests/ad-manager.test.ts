import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { AdManager } from '../src/game/systems/AdManager';
import { EventBus } from '../src/game/systems/EventBus';
import { TimeService } from '../src/game/systems/TimeService';
import { FakePlatform } from './fakePlatform';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const platform = new FakePlatform();
  const bus = new EventBus();
  const time = new TimeService(() => NOW);
  const ads = new AdManager(platform, state, bus, time);
  return { state, platform, bus, ads };
}

describe('AdManager rewarded', () => {
  it('pauses gameplay, grants stats and requests a save on success', async () => {
    const { state, platform, bus, ads } = setup();
    const saveRequested = vi.fn();
    bus.on('game:save-requested', saveRequested);

    const result = await ads.showRewarded('offline_double');

    expect(result).toBe(true);
    expect(platform.gameplayStops).toBe(1);
    expect(platform.gameplayStarts).toBe(1);
    expect(platform.rewardedCalls).toEqual(['offline_double']);
    expect(state.stats.adsWatched).toBe(1);
    expect(saveRequested).toHaveBeenCalledTimes(1);
  });

  it('does not grant stats when the ad is cancelled', async () => {
    const { state, platform, bus, ads } = setup();
    platform.rewardedResult = false;
    const saveRequested = vi.fn();
    bus.on('game:save-requested', saveRequested);

    const result = await ads.showRewarded('speed_up');

    expect(result).toBe(false);
    expect(state.stats.adsWatched).toBe(0);
    expect(saveRequested).not.toHaveBeenCalled();
    expect(platform.gameplayStarts).toBe(1);
  });

  it('skips the platform call when rewarded ads are unsupported', async () => {
    const { platform, ads } = setup();
    platform.rewardedSupported = false;

    expect(await ads.showRewarded('offline_double')).toBe(false);
    expect(platform.rewardedCalls).toEqual([]);
  });
});

describe('AdManager interstitial', () => {
  it('is blocked during the first three minutes', async () => {
    const { state, platform, ads } = setup();
    state.stats.sessionStartedAt = NOW - 120_000;

    expect(await ads.showInterstitial('zone_unlocked')).toBe(false);
    expect(platform.interstitialCalls).toEqual([]);
  });

  it('runs after the three-minute mark', async () => {
    const { state, platform, ads } = setup();
    state.stats.sessionStartedAt = NOW - 181_000;

    expect(await ads.showInterstitial('zone_unlocked')).toBe(true);
    expect(platform.interstitialCalls).toEqual(['zone_unlocked']);
    expect(platform.gameplayStops).toBe(1);
    expect(platform.gameplayStarts).toBe(1);
  });
});
