import type { PlatformAdapter } from '../types/PlatformTypes';

export class GameplayLifecycle {
  private started = false;
  private readonly reasons = new Set<string>();

  constructor(private readonly platform: PlatformAdapter) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.reasons.size === 0) {
      void this.platform.gameplayStart().catch((error) => {
        console.warn('[GameplayLifecycle] gameplayStart failed', error);
      });
    }
  }

  pause(reason: string): void {
    if (this.reasons.has(reason)) return;
    this.reasons.add(reason);
    if (this.started && this.reasons.size === 1) {
      void this.platform.gameplayStop().catch((error) => {
        console.warn('[GameplayLifecycle] gameplayStop failed', error);
      });
    }
  }

  resume(reason: string): void {
    if (!this.reasons.delete(reason)) return;
    if (this.started && this.reasons.size === 0) {
      void this.platform.gameplayStart().catch((error) => {
        console.warn('[GameplayLifecycle] gameplayStart failed', error);
      });
    }
  }

  isPaused(): boolean {
    return this.reasons.size > 0;
  }

  getReasons(): string[] {
    return [...this.reasons];
  }
}
