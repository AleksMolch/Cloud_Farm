import { normalizeState } from '../data/createInitialState';
import type { GameData } from '../types/ConfigTypes';
import { SAVE_VERSION } from '../types/GameState';
import type { GameState } from '../types/GameState';
import type { EventBus } from './EventBus';
import type { TimeService } from './TimeService';

export const SAVE_KEY = 'cloud_farm_save';
export const SAVE_INTERVAL_MS = 20_000;
export const SAVE_DEBOUNCE_MS = 250;

export interface SaveTransport {
  loadData<T>(key: string, fallback: T): Promise<T>;
  saveData(key: string, value: unknown): Promise<void>;
}

export class SaveService {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly transport: SaveTransport,
    private readonly data: GameData,
    private readonly time: TimeService,
  ) {}

  async load(): Promise<GameState | null> {
    const raw = await this.transport.loadData<unknown>(SAVE_KEY, null);
    if (!raw || typeof raw !== 'object') return null;
    const version = (raw as { version?: unknown }).version;
    if (typeof version !== 'number' || version < 1 || version > SAVE_VERSION) {
      return null;
    }
    try {
      return normalizeState(raw, this.data, this.time.now());
    } catch (error) {
      console.warn('Failed to normalize save data', error);
      return null;
    }
  }

  save(state: GameState): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
    snapshot.version = SAVE_VERSION;
    snapshot.lastSaveTimestamp = this.time.now();

    const write = async (): Promise<void> => {
      await this.transport.saveData(SAVE_KEY, snapshot);
      state.lastSaveTimestamp = Math.max(
        state.lastSaveTimestamp,
        snapshot.lastSaveTimestamp,
      );
    };

    const result = this.writeChain.then(write, write);
    this.writeChain = result.catch(() => undefined);
    return result;
  }

  async reset(): Promise<void> {
    await this.transport.saveData(SAVE_KEY, null);
  }
}

export class SaveScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private debounceId: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;

  private readonly onPageHide = (): void => {
    void this.saveNow();
  };

  private readonly onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void this.saveNow();
    }
  };

  constructor(
    private readonly saveService: SaveService,
    private readonly state: GameState,
    private readonly bus: EventBus,
    private readonly intervalMs: number = SAVE_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      void this.saveNow();
    }, this.intervalMs);
    this.unsubscribe = this.bus.on('game:save-requested', () => this.requestSave());
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  requestSave(): void {
    if (this.debounceId !== null) {
      clearTimeout(this.debounceId);
    }
    this.debounceId = setTimeout(() => {
      this.debounceId = null;
      void this.saveNow();
    }, SAVE_DEBOUNCE_MS);
  }

  async saveNow(): Promise<void> {
    try {
      await this.saveService.save(this.state);
    } catch (error) {
      console.warn('Failed to save game state', error);
    }
  }

  dispose(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.debounceId !== null) {
      clearTimeout(this.debounceId);
      this.debounceId = null;
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }
}
