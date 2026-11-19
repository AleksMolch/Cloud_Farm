import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EconomyService } from '../src/game/systems/EconomyService';
import { EventBus } from '../src/game/systems/EventBus';
import { ProductionService } from '../src/game/systems/ProductionService';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const economy = new EconomyService(state, bus);
  const production = new ProductionService(state, data, economy, bus);
  return { data, state, bus, economy, production };
}

describe('crop production', () => {
  it('collects a ready crop, then requires planting again', () => {
    const { state, production } = setup();

    expect(production.getStatus('plot_wheat', NOW).kind).toBe('ready');
    const output = production.collect('plot_wheat', NOW);

    expect(output).toEqual([{ id: 'wheat', amount: 1 }]);
    expect(state.resources.wheat).toBe(1);
    expect(production.getStatus('plot_wheat', NOW).kind).toBe('empty');

    expect(production.plant('plot_wheat', NOW)).toBe(true);
    expect(state.objects.plot_wheat.productionEndsAt).toBe(NOW + 6000);
    expect(production.getStatus('plot_wheat', NOW + 3000)).toMatchObject({
      kind: 'growing',
      progress: 0.5,
      remainingSeconds: 3,
    });
    expect(production.getStatus('plot_wheat', NOW + 6000).kind).toBe('ready');
    expect(production.collect('plot_wheat', NOW + 6000)).toEqual([{ id: 'wheat', amount: 1 }]);
  });

  it('does not collect a growing crop', () => {
    const { production } = setup();
    production.collect('plot_wheat', NOW);
    production.plant('plot_wheat', NOW);
    expect(production.collect('plot_wheat', NOW + 1000)).toBeNull();
  });

  it('uses the upgraded yield', () => {
    const { state, production } = setup();
    state.objects.plot_wheat.level = 3;
    const output = production.collect('plot_wheat', NOW);
    expect(output).toEqual([{ id: 'wheat', amount: 3 }]);
  });

  it('replants an empty cat plot after a manual harvest', () => {
    const { state, production } = setup();
    state.helpers.cat = true;

    production.collect('plot_wheat', NOW);
    expect(production.getStatus('plot_wheat', NOW).kind).toBe('empty');

    production.tickAutoCollect(NOW + 500);

    expect(state.objects.plot_wheat.productionEndsAt).toBe(NOW + 6500);
    expect(state.resources.wheat).toBe(1);
  });

  it('catches up missed cat cycles after a long gap', () => {
    const { state, production } = setup();
    state.helpers.cat = true;
    state.objects.plot_wheat.productionStartedAt = NOW - 66_000;
    state.objects.plot_wheat.productionEndsAt = NOW - 60_000;

    const collected = production.tickAutoCollect(NOW);

    expect(collected).toEqual([
      { objectId: 'plot_wheat', output: [{ id: 'wheat', amount: 11 }] },
    ]);
    expect(state.resources.wheat).toBe(11);
    expect(state.objects.plot_wheat.productionEndsAt).toBe(NOW + 6000);
  });

  it('lets the cloud cat auto-collect and replant wheat', () => {
    const { state, bus, production } = setup();
    state.helpers.cat = true;
    const listener = vi.fn();
    bus.on('crop:collected', listener);

    production.collect('plot_wheat', NOW);
    production.plant('plot_wheat', NOW);
    const collected = production.tickAutoCollect(NOW + 6000);

    expect(collected).toEqual([
      { objectId: 'plot_wheat', output: [{ id: 'wheat', amount: 1 }] },
    ]);
    expect(state.resources.wheat).toBe(2);
    expect(state.objects.plot_wheat.productionEndsAt).toBe(NOW + 12_000);
    expect(listener).toHaveBeenCalledWith({
      objectId: 'plot_wheat',
      output: [{ id: 'wheat', amount: 1 }],
      auto: true,
    });
  });
});

describe('animal production', () => {
  it('starts a cycle on unlock and restarts it after collection', () => {
    const { state, production } = setup();
    state.zones.yard.unlocked = true;
    state.objects.chicken.unlocked = true;

    production.onObjectUnlocked('chicken', NOW);
    expect(state.objects.chicken.productionEndsAt).toBe(NOW + 18_000);
    expect(production.getStatus('chicken', NOW + 9000)).toMatchObject({
      kind: 'growing',
      progress: 0.5,
    });
    expect(production.getStatus('chicken', NOW + 18_000).kind).toBe('ready');

    expect(production.collect('chicken', NOW + 18_000)).toEqual([{ id: 'egg', amount: 1 }]);
    expect(state.resources.egg).toBe(1);
    expect(state.objects.chicken.productionEndsAt).toBe(NOW + 36_000);
  });

  it('speeds animals up by 20% when the dog is hired', () => {
    const { state, production } = setup();
    state.zones.yard.unlocked = true;
    state.objects.chicken.unlocked = true;
    state.helpers.dog = true;

    production.onObjectUnlocked('chicken', NOW);
    expect(state.objects.chicken.productionEndsAt! - state.objects.chicken.productionStartedAt!).toBe(
      14_400,
    );
  });
});

describe('building production', () => {
  it('spends inputs when starting and yields output when ready', () => {
    const { state, economy, production } = setup();
    state.zones.mill.unlocked = true;
    state.objects.mill.unlocked = true;
    production.onObjectUnlocked('mill', NOW);

    expect(production.getStatus('mill', NOW).kind).toBe('idle');
    expect(production.startBuilding('mill', 'flour', NOW)).toBe(false);

    economy.grant([{ id: 'wheat', amount: 2 }]);
    expect(production.startBuilding('mill', 'flour', NOW)).toBe(true);
    expect(state.resources.wheat).toBe(0);
    expect(production.getStatus('mill', NOW + 6000)).toMatchObject({
      kind: 'producing',
      progress: 0.5,
    });
    expect(production.startBuilding('mill', 'flour', NOW + 6000)).toBe(false);

    expect(production.getStatus('mill', NOW + 12_000).kind).toBe('ready');
    expect(production.collectBuilding('mill', NOW + 12_000)).toEqual([
      { id: 'flour', amount: 1 },
    ]);
    expect(state.resources.flour).toBe(1);
    expect(production.getStatus('mill', NOW + 12_000).kind).toBe('idle');
  });

  it('applies the building level output multiplier', () => {
    const { state, economy, production } = setup();
    state.zones.mill.unlocked = true;
    state.objects.mill.unlocked = true;
    state.objects.mill.level = 3;
    economy.grant([{ id: 'wheat', amount: 2 }]);

    expect(production.startBuilding('mill', 'flour', NOW)).toBe(true);
    expect(production.collectBuilding('mill', NOW + 10_000)).toEqual([
      { id: 'flour', amount: 2 },
    ]);
  });

  it('speeds up an active cycle', () => {
    const { state, economy, production } = setup();
    state.zones.mill.unlocked = true;
    state.objects.mill.unlocked = true;
    economy.grant([{ id: 'wheat', amount: 2 }]);
    production.startBuilding('mill', 'flour', NOW);

    expect(production.speedUp('mill', 12, NOW)).toBe(true);
    expect(production.getStatus('mill', NOW).kind).toBe('ready');
    expect(production.collectBuilding('mill', NOW)).toEqual([{ id: 'flour', amount: 1 }]);
  });
});
