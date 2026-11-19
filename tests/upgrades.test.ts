import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EconomyService } from '../src/game/systems/EconomyService';
import { EventBus } from '../src/game/systems/EventBus';
import { UpgradeService } from '../src/game/systems/UpgradeService';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const economy = new EconomyService(state, bus);
  const upgrades = new UpgradeService(state, data, economy, bus);
  return { state, bus, economy, upgrades };
}

describe('UpgradeService', () => {
  it('grows the price exponentially', () => {
    const { state, economy, upgrades } = setup();
    expect(upgrades.getUpgradeCost('plot_wheat')).toEqual([{ id: 'coin', amount: 20 }]);

    economy.grant([{ id: 'coin', amount: 20 }]);
    expect(upgrades.upgrade('plot_wheat')).toBe(true);
    expect(state.objects.plot_wheat.level).toBe(2);
    expect(upgrades.getUpgradeCost('plot_wheat')).toEqual([{ id: 'coin', amount: 28 }]);
  });

  it('does not upgrade without enough coins', () => {
    const { state, economy, upgrades } = setup();
    economy.grant([{ id: 'coin', amount: 10 }]);

    expect(upgrades.canUpgrade('plot_wheat')).toBe(false);
    expect(upgrades.upgrade('plot_wheat')).toBe(false);
    expect(state.objects.plot_wheat.level).toBe(1);
  });

  it('stops at the maximum level', () => {
    const { state, upgrades } = setup();
    state.objects.plot_wheat.level = 5;

    expect(upgrades.getUpgradeCost('plot_wheat')).toEqual([]);
    expect(upgrades.canUpgrade('plot_wheat')).toBe(false);
    expect(upgrades.upgrade('plot_wheat')).toBe(false);
  });

  it('does not upgrade locked objects', () => {
    const { upgrades } = setup();
    expect(upgrades.canUpgrade('plot_carrot')).toBe(false);
    expect(upgrades.upgrade('plot_carrot')).toBe(false);
  });
});
