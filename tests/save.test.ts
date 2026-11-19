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
  failLoads = 0;
  failSaves = 0;

  async loadData<T>(_key: string, fallback: T): Promise<T> {
    if (this.failLoads > 0) {
      this.failLoads -= 1;
      throw new Error('load failed');
    }
    return (this.data ?? fallback) as T;
  }

  async saveData(_key: string, value: unknown): Promise<void> {
    if (this.failSaves > 0) {
      this.failSaves -= 1;
      throw new Error('save failed');
    }
    this.saves += 1;
    this.data = value;
  }
}

class ControlledTransport implements SaveTransport {
  data: unknown = null;
  private readonly pending: Array<() => void> = [];

  async loadData<T>(_key: string, fallback: T): Promise<T> {
    return (this.data ?? fallback) as T;
  }

  saveData(_key: string, value: unknown): Promise<void> {
    return new Promise((resolve) => {
      this.pending.push(() => {
        this.data = value;
        resolve();
      });
    });
  }

  releaseNext(): void {
    const next = this.pending.shift();
    next?.();
  }

  get pendingCount(): number {
    return this.pending.length;
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

  it('propagates transport failures instead of treating them as no save', async () => {
    const { transport, saveService } = setup();
    transport.failLoads = 1;
    await expect(saveService.load()).rejects.toThrow('load failed');
  });

  it('does not advance the save timestamp when a write fails', async () => {
    const { state, transport, saveService } = setup();
    state.lastSaveTimestamp = NOW - 5000;
    transport.failSaves = 1;

    await expect(saveService.save(state)).rejects.toThrow('save failed');
    expect(state.lastSaveTimestamp).toBe(NOW - 5000);

    await saveService.save(state);
    expect(state.lastSaveTimestamp).toBe(NOW);
  });

  it('serializes saves so an older snapshot cannot overwrite a newer one', async () => {
    const { state, transport } = setup();
    const controlled = new ControlledTransport();
    const saveService = new SaveService(controlled, loadGameData(), new TimeService(() => NOW));

    state.resources.coin = 1;
    const first = saveService.save(state);
    state.resources.coin = 2;
    const second = saveService.save(state);

    await Promise.resolve();
    await Promise.resolve();
    expect(controlled.pendingCount).toBe(1);
    controlled.releaseNext();
    await first;
    await Promise.resolve();
    await Promise.resolve();
    expect(controlled.pendingCount).toBe(1);
    controlled.releaseNext();
    await second;

    expect((controlled.data as { resources: { coin: number } }).resources.coin).toBe(2);
    void transport;
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
