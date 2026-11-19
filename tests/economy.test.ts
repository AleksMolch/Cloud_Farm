import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EventBus } from '../src/game/systems/EventBus';
import { TimeService } from '../src/game/systems/TimeService';
import { EconomyService } from '../src/game/systems/EconomyService';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const time = new TimeService(() => NOW);
  const economy = new EconomyService(state, bus);
  return { state, bus, time, economy };
}

describe('TimeService', () => {
  it('uses the injected clock', () => {
    let current = 1000;
    const time = new TimeService(() => current);
    expect(time.now()).toBe(1000);
    current = 2500;
    expect(time.now()).toBe(2500);
  });
});

describe('EventBus', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsubscribe = bus.on('toast', listener);

    bus.emit('toast', { key: 'hello' });
    expect(listener).toHaveBeenCalledWith({ key: 'hello' });

    unsubscribe();
    bus.emit('toast', { key: 'again' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('EconomyService', () => {
  it('grants resources and emits a change event', () => {
    const { state, bus, economy } = setup();
    const listener = vi.fn();
    bus.on('resources:changed', listener);

    economy.grant([{ id: 'coin', amount: 25 }]);

    expect(state.resources.coin).toBe(25);
    expect(listener).toHaveBeenCalledWith({
      changed: [{ id: 'coin', amount: 25 }],
    });
  });

  it('spends resources only when they are sufficient', () => {
    const { state, economy } = setup();
    economy.grant([{ id: 'coin', amount: 10 }]);

    expect(economy.canAfford([{ id: 'coin', amount: 20 }])).toBe(false);
    expect(economy.spend([{ id: 'coin', amount: 20 }])).toBe(false);
    expect(state.resources.coin).toBe(10);

    expect(economy.canAfford([{ id: 'coin', amount: 10 }])).toBe(true);
    expect(economy.spend([{ id: 'coin', amount: 10 }])).toBe(true);
    expect(state.resources.coin).toBe(0);
  });

  it('never stores negative resource amounts', () => {
    const { state, economy } = setup();
    economy.grant([{ id: 'wheat', amount: -5 }]);
    expect(state.resources.wheat).toBe(0);
  });
});
