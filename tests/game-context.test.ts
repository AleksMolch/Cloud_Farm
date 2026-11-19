import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { GameContext } from '../src/game/systems/GameContext';
import { TimeService } from '../src/game/systems/TimeService';
import { FakePlatform } from './fakePlatform';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const platform = new FakePlatform();
  const time = new TimeService(() => NOW);
  state.helpers.cat = true;
  state.lastSaveTimestamp = NOW - 120_000;
  const context = new GameContext({ platform, state, data, time });
  return { context, state, platform };
}

describe('GameContext', () => {
  it('computes a pending offline report and claims it with a multiplier', async () => {
    const { context, state, platform } = setup();
    expect(context.pendingOffline?.gains).toEqual([{ id: 'wheat', amount: 20 }]);

    const claimed = await context.claimOffline(2);

    expect(claimed).toEqual([{ id: 'wheat', amount: 40 }]);
    expect(state.resources.wheat).toBe(40);
    expect(context.pendingOffline).toBeNull();
    expect(platform.saves).toBe(1);
  });

  it('persists an unclaimed offline report across a save and reload', async () => {
    const { context, state, platform } = setup();
    await context.saveService.save(state);

    const loaded = await context.saveService.load();
    expect(loaded?.pendingOffline?.gains).toEqual([{ id: 'wheat', amount: 20 }]);

    const reloaded = new GameContext({
      platform,
      state: loaded!,
      data: loadGameData(),
      time: new TimeService(() => NOW),
    });
    expect(reloaded.pendingOffline?.gains).toEqual([{ id: 'wheat', amount: 20 }]);

    const claimed = await reloaded.claimOffline(1);
    expect(claimed).toEqual([{ id: 'wheat', amount: 20 }]);
    expect(loaded?.pendingOffline).toBeNull();
  });

  it('rebases credited production timers after an offline claim', async () => {
    const { context, state } = setup();
    state.zones.yard.unlocked = true;
    state.objects.chicken.unlocked = true;
    state.objects.chicken.productionStartedAt = NOW - 20_000;
    state.objects.chicken.productionEndsAt = NOW - 1000;
    state.lastSaveTimestamp = NOW - 60_000;
    const reloaded = new GameContext({
      platform: context.platform,
      state,
      data: loadGameData(),
      time: new TimeService(() => NOW),
    });

    await reloaded.claimOffline(1);

    expect(reloaded.production.getStatus('chicken', NOW).kind).toBe('growing');
    expect(reloaded.production.getStatus('plot_wheat', NOW).kind).toBe('growing');
  });

  it('restores the pending report when persisting a claim fails', async () => {
    const { context, state, platform } = setup();
    platform.failSaves = 1;

    await expect(context.claimOffline(1)).rejects.toThrow('save failed');

    expect(context.pendingOffline?.gains).toEqual([{ id: 'wheat', amount: 20 }]);
    expect(state.pendingOffline?.gains).toEqual([{ id: 'wheat', amount: 20 }]);
    expect(state.resources.wheat).toBe(0);
  });

  it('changes language and persists it', () => {
    const { context, state } = setup();
    const listener = vi.fn();
    context.bus.on('settings:changed', listener);

    context.setLanguage('en');

    expect(state.settings.language).toBe('en');
    expect(context.localization.getLanguage()).toBe('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('applies audio state changes to the audio service', () => {
    const { context, platform } = setup();
    const apply = vi.spyOn(context.audio, 'setPlatformAudio');

    platform.emitAudio(false);

    expect(apply).toHaveBeenCalledWith(false);
  });
});
