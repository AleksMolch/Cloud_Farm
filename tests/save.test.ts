import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EventBus } from '../src/game/systems/EventBus';
import { SaveScheduler, SaveService, SAVE_KEY } from '../src/game/systems/SaveService';
import { TimeService } from '../src/game/systems/TimeService';
import type { SaveTransport } from '../src/game/systems/SaveService';

const NOW = 1_700_000_000_000;

class MemoryTransport implements SaveTransport {
  data: unknown = null;
  saves = 0;

  async loadData<T>(_key: string, fallback: T): Promise<T> {
    return (this.data ?? fallback) as T;
  }

  async saveData(_key: string, value: unknown): Promise<void> {
    this.saves += 1;
    this.data = value;
  }
}

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const transport = new MemoryTransport();
  const saveService = new SaveService(transport, data, new TimeService(() => NOW));
  return { data, state, transport, saveService };
}

describe('SaveService', () => {
  it('saves and restores progress with a version and timestamp', async () => {
    const { state, transport, saveService } = setup();
    state.resources.coin = 123;
    state.objects.plot_wheat.level = 3;

    await saveService.save(state);
    expect(state.lastSaveTimestamp).toBe(NOW);
    expect(transport.data).toMatchObject({ version: 1, resources: { coin: 123 } });

    const loaded = await saveService.load();
    expect(loaded?.resources.coin).toBe(123);
    expect(loaded?.objects.plot_wheat.level).toBe(3);
  });

  it('returns null for corrupted or non-object saves', async () => {
    const { transport, saveService } = setup();
    transport.data = '{not valid';
    expect(await saveService.load()).toBeNull();

    transport.data = null;
    expect(await saveService.load()).toBeNull();
  });

  it('returns null for a save from a newer version', async () => {
    const { transport, saveService } = setup();
    transport.data = { version: 999, resources: { coin: 1 } };
    expect(await saveService.load()).toBeNull();
  });

  it('normalizes a valid but incomplete save', async () => {
    const { transport, saveService } = setup();
    transport.data = {
      version: 1,
      resources: { coin: 9 },
      objects: { plot_wheat: { unlocked: true, level: 2 } },
      zones: { meadow: { unlocked: true } },
      settings: {},
      stats: {},
      lastSaveTimestamp: NOW - 1000,
    };

    const loaded = await saveService.load();
    expect(loaded?.resources.coin).toBe(9);
    expect(loaded?.objects.plot_wheat.level).toBe(2);
    expect(loaded?.objects.chicken).toBeDefined();
    expect(loaded?.objects.chicken.unlocked).toBe(false);
    expect(loaded?.settings.music).toBe(true);
  });

  it('uses the configured save key', async () => {
    const { saveService } = setup();
    const loadSpy = vi.spyOn(MemoryTransport.prototype, 'loadData');
    await saveService.load();
    expect(loadSpy).toHaveBeenCalledWith(SAVE_KEY, null);
    loadSpy.mockRestore();
  });
});

describe('SaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosaves after the interval and on request', async () => {
    const { state, transport, saveService } = setup();
    const bus = new EventBus();
    const scheduler = new SaveScheduler(saveService, state, bus, 20_000);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(transport.saves).toBe(1);

    bus.emit('game:save-requested');
    await vi.advanceTimersByTimeAsync(300);
    expect(transport.saves).toBe(2);

    scheduler.dispose();
  });
});
