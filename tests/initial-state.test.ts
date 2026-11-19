import { describe, expect, it } from 'vitest';
import { createInitialState, normalizeState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { RESOURCE_IDS } from '../src/game/types/GameState';

const NOW = 1_700_000_000_000;

describe('initial game state', () => {
  it('creates zero resources and all configured objects', () => {
    const data = loadGameData();
    const state = createInitialState(data, NOW);

    for (const id of RESOURCE_IDS) {
      expect(state.resources[id]).toBe(0);
    }
    for (const object of data.objectList) {
      expect(state.objects[object.id]).toBeDefined();
    }
  });

  it('starts with the meadow unlocked and a ready wheat plot', () => {
    const data = loadGameData();
    const state = createInitialState(data, NOW);

    expect(state.zones.meadow.unlocked).toBe(true);
    expect(state.zones.terrace.unlocked).toBe(false);
    expect(state.objects.plot_wheat.unlocked).toBe(true);
    expect(state.objects.plot_wheat.productionEndsAt).toBe(NOW);
    expect(state.objects.plot_carrot.unlocked).toBe(false);
    expect(state.objects.chicken.unlocked).toBe(false);
  });

  it('normalizes a partial save without losing valid progress', () => {
    const data = loadGameData();
    const state = normalizeState(
      {
        version: 1,
        resources: { coin: 42, wheat: 3, unknown: 999 },
        objects: { plot_wheat: { unlocked: true, level: 99, productionEndsAt: null } },
        zones: { meadow: { unlocked: true } },
        helpers: { cat: true },
        orders: [],
        completedTutorialSteps: ['collect_wheat', 'removed_step'],
        settings: { music: false },
        stats: { ordersCompleted: 2 },
        lastSaveTimestamp: NOW - 5000,
        nextOrderId: 7,
      },
      data,
      NOW,
    );

    expect(state.resources.coin).toBe(42);
    expect(state.resources.wheat).toBe(3);
    expect(state.resources.carrot).toBe(0);
    expect(state.objects.plot_wheat.level).toBe(5);
    expect(state.objects.chicken).toBeDefined();
    expect(state.objects.chicken.unlocked).toBe(false);
    expect(state.zones.yard.unlocked).toBe(false);
    expect(state.helpers.cat).toBe(true);
    expect(state.helpers.dog).toBe(false);
    expect(state.completedTutorialSteps).toEqual(['collect_wheat']);
    expect(state.settings.music).toBe(false);
    expect(state.settings.sfx).toBe(true);
    expect(state.stats.ordersCompleted).toBe(2);
    expect(state.lastSaveTimestamp).toBe(NOW - 5000);
    expect(state.nextOrderId).toBe(7);
  });
});
