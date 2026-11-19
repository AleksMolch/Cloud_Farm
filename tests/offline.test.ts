import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EconomyService } from '../src/game/systems/EconomyService';
import { EventBus } from '../src/game/systems/EventBus';
import { OfflineProgressService } from '../src/game/systems/OfflineProgressService';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const economy = new EconomyService(state, bus);
  const offline = new OfflineProgressService(data);
  return { data, state, bus, economy, offline };
}

describe('OfflineProgressService', () => {
  it('gives nothing without animals or helpers', () => {
    const { state, offline } = setup();
    state.lastSaveTimestamp = NOW - 3600_000;

    const report = offline.compute(state, NOW);
    expect(report.elapsedSeconds).toBe(3600);
    expect(report.creditedSeconds).toBe(3600);
    expect(report.gains).toEqual([]);
  });

  it('credits animals and the auto-collecting cat with a per-object cap', () => {
    const { state, offline } = setup();
    state.helpers.cat = true;
    state.zones.yard.unlocked = true;
    state.objects.chicken.unlocked = true;
    state.lastSaveTimestamp = NOW - 3600_000;

    const report = offline.compute(state, NOW);
    expect(report.creditedSeconds).toBe(3600);
    expect(report.gains).toEqual([
      { id: 'wheat', amount: 60 },
      { id: 'egg', amount: 60 },
    ]);
  });

  it('caps offline time at two hours', () => {
    const { state, offline } = setup();
    state.lastSaveTimestamp = NOW - 10 * 3600_000;
    const report = offline.compute(state, NOW);
    expect(report.elapsedSeconds).toBe(36_000);
    expect(report.creditedSeconds).toBe(7200);
  });

  it('lets the dog increase animal cycles during shorter absences', () => {
    const { state, offline } = setup();
    state.zones.yard.unlocked = true;
    state.objects.chicken.unlocked = true;
    state.lastSaveTimestamp = NOW - 100_000;

    const withoutDog = offline.compute(state, NOW);
    state.helpers.dog = true;
    const withDog = offline.compute(state, NOW);

    expect(withoutDog.gains).toEqual([{ id: 'egg', amount: 5 }]);
    expect(withDog.gains).toEqual([{ id: 'egg', amount: 6 }]);
  });

  it('claims the report with a x2 multiplier', () => {
    const { state, economy, offline } = setup();
    state.helpers.cat = true;
    state.lastSaveTimestamp = NOW - 120_000;
    const report = offline.compute(state, NOW);

    const claimed = offline.claim(economy, report, 2);

    expect(claimed).toEqual([{ id: 'wheat', amount: 40 }]);
    expect(state.resources.wheat).toBe(40);
  });
});
