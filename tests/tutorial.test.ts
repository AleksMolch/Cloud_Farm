import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EconomyService } from '../src/game/systems/EconomyService';
import { EventBus } from '../src/game/systems/EventBus';
import { OrderService } from '../src/game/systems/OrderService';
import { ProductionService } from '../src/game/systems/ProductionService';
import { TutorialService } from '../src/game/systems/TutorialService';
import { UpgradeService } from '../src/game/systems/UpgradeService';

const NOW = 1_700_000_000_000;

function setup(completed: string[] = []) {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  state.completedTutorialSteps = completed;
  const bus = new EventBus();
  const economy = new EconomyService(state, bus);
  const production = new ProductionService(state, data, economy, bus);
  const orders = new OrderService(state, data, economy, bus, () => 0);
  const upgrades = new UpgradeService(state, data, economy, bus);
  const tutorial = new TutorialService(state, data, economy, bus);
  orders.ensureOrders(NOW);
  return { state, bus, economy, production, orders, upgrades, tutorial };
}

describe('TutorialService', () => {
  it('advances from collecting wheat to the first order', () => {
    const { production, tutorial } = setup();
    expect(tutorial.getCurrentStep()?.id).toBe('collect_wheat');

    production.collect('plot_wheat', NOW);

    expect(tutorial.getCurrentStep()?.id).toBe('first_order');
  });

  it('advances after an order is completed and after the plot upgrade', () => {
    const { state, economy, production, orders, upgrades, tutorial } = setup();
    production.collect('plot_wheat', NOW);
    economy.grant([
      { id: 'wheat', amount: 2 },
      { id: 'coin', amount: 5 },
    ]);

    orders.completeOrder(state.orders[0].instanceId, NOW);
    expect(tutorial.getCurrentStep()?.id).toBe('upgrade_plot');

    expect(upgrades.upgrade('plot_wheat')).toBe(true);
    expect(tutorial.getCurrentStep()).toBeNull();
    expect(state.completedTutorialSteps).toEqual([
      'collect_wheat',
      'first_order',
      'upgrade_plot',
    ]);
    expect(state.resources.crystal).toBe(1);
  });

  it('does not repeat finished steps after loading a save', () => {
    const { tutorial } = setup(['collect_wheat']);
    expect(tutorial.getCurrentStep()?.id).toBe('first_order');
  });

  it('grants the final tutorial reward only once', () => {
    const { state, economy, production, upgrades, tutorial } = setup([
      'collect_wheat',
      'first_order',
    ]);
    economy.grant([{ id: 'coin', amount: 25 }]);

    upgrades.upgrade('plot_wheat');
    expect(state.resources.coin).toBe(20);
    expect(state.resources.crystal).toBe(1);
    expect(tutorial.getCurrentStep()).toBeNull();

    upgrades.upgrade('plot_wheat');
    expect(state.resources.crystal).toBe(1);
    void production;
  });
});
