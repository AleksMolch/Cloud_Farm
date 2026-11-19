import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EconomyService } from '../src/game/systems/EconomyService';
import { EventBus } from '../src/game/systems/EventBus';
import { ProductionService } from '../src/game/systems/ProductionService';
import { UnlockService } from '../src/game/systems/UnlockService';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const economy = new EconomyService(state, bus);
  const production = new ProductionService(state, data, economy, bus);
  const unlocks = new UnlockService(state, data, economy, production, bus);
  return { data, state, bus, economy, unlocks };
}

describe('UnlockService', () => {
  it('unlocks an object in an open zone when the player can pay', () => {
    const { state, bus, economy, unlocks } = setup();
    const listener = vi.fn();
    bus.on('object:unlocked', listener);

    expect(unlocks.unlockObject('plot_carrot')).toBe(false);
    expect(state.objects.plot_carrot.unlocked).toBe(false);

    economy.grant([{ id: 'coin', amount: 20 }]);
    expect(unlocks.unlockObject('plot_carrot')).toBe(true);
    expect(state.objects.plot_carrot.unlocked).toBe(true);
    expect(state.resources.coin).toBe(0);
    expect(listener).toHaveBeenCalledWith({
      objectId: 'plot_carrot',
      cost: [{ id: 'coin', amount: 20 }],
    });
  });

  it('does not unlock an object while its zone is locked', () => {
    const { state, economy, unlocks } = setup();
    economy.grant([{ id: 'coin', amount: 1000 }]);

    expect(unlocks.canUnlockObject('plot_strawberry')).toBe(false);
    expect(unlocks.unlockObject('plot_strawberry')).toBe(false);
    expect(state.objects.plot_strawberry.unlocked).toBe(false);
  });

  it('unlocks a zone and emits the event', () => {
    const { state, bus, economy, unlocks } = setup();
    const listener = vi.fn();
    bus.on('zone:unlocked', listener);
    economy.grant([{ id: 'coin', amount: 80 }]);

    expect(unlocks.unlockZone('terrace')).toBe(true);
    expect(state.zones.terrace.unlocked).toBe(true);
    expect(listener).toHaveBeenCalledWith({
      zoneId: 'terrace',
      cost: [{ id: 'coin', amount: 80 }],
    });
    expect(unlocks.unlockZone('terrace')).toBe(false);
  });

  it('hires helpers with crystals once', () => {
    const { state, bus, economy, unlocks } = setup();
    const listener = vi.fn();
    bus.on('helper:unlocked', listener);
    economy.grant([{ id: 'crystal', amount: 3 }]);

    expect(unlocks.hireHelper('cat')).toBe(true);
    expect(state.helpers.cat).toBe(true);
    expect(state.resources.crystal).toBe(0);
    expect(listener).toHaveBeenCalledWith({
      helperId: 'cat',
      cost: [{ id: 'crystal', amount: 3 }],
    });
    expect(unlocks.hireHelper('cat')).toBe(false);
  });
});
