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
