import { describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '../src/game/platform/MockAdapter';
import { createPlatform } from '../src/game/platform/createPlatform';

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('MockAdapter', () => {
  it('persists and restores JSON data', async () => {
    const storage = new MemoryStorage();
    const adapter = new MockAdapter({ storage, language: 'ru-RU' });
    await adapter.init();

    await adapter.saveData('save', { coin: 7 });
    expect(await adapter.loadData('save', null)).toEqual({ coin: 7 });
    expect(await adapter.loadData('missing', { fallback: true })).toEqual({ fallback: true });
    expect(adapter.getLanguage()).toBe('ru-RU');
  });

  it('simulates rewarded ads and reports support', async () => {
    vi.useFakeTimers();
    const adapter = new MockAdapter({
      storage: new MemoryStorage(),
      adDelayMs: 500,
      showAdOverlay: false,
    });
    await adapter.init();

    expect(adapter.isRewardedSupported()).toBe(true);
    expect(adapter.isInterstitialSupported()).toBe(true);

    const promise = adapter.showRewarded('offline_double');
    await vi.advanceTimersByTimeAsync(499);
    let resolved: boolean | null = null;
    void promise.then((value) => {
      resolved = value;
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(await promise).toBe(true);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });

  it('emits pause state changes', async () => {
    const adapter = new MockAdapter({ storage: new MemoryStorage(), showAdOverlay: false });
    await adapter.init();
    const listener = vi.fn();
    adapter.onPauseChanged(listener);

    adapter.setPaused(true);
    adapter.setPaused(false);

    expect(listener.mock.calls).toEqual([[true], [false]]);
  });
});

describe('createPlatform', () => {
  it('falls back to MockAdapter outside a platform environment', async () => {
    const adapter = await createPlatform();
    expect(adapter.id).toBe('mock');
  });
});
