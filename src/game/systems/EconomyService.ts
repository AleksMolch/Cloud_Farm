import type { GameState, ResourceAmount, ResourceId } from '../types/GameState';
import type { EventBus } from './EventBus';

export class EconomyService {
  constructor(
    private readonly state: GameState,
    private readonly bus: EventBus,
  ) {}

  get(id: ResourceId): number {
    return Math.max(0, this.state.resources[id] ?? 0);
  }

  grant(amounts: ResourceAmount[]): ResourceAmount[] {
    const applied: ResourceAmount[] = [];
    for (const amount of amounts) {
      const delta = Math.floor(amount.amount);
      if (delta === 0) continue;
      const current = this.state.resources[amount.id] ?? 0;
      const next = Math.max(0, current + delta);
      const realDelta = next - current;
      if (realDelta === 0) continue;
      this.state.resources[amount.id] = next;
      applied.push({ id: amount.id, amount: realDelta });
    }
    if (applied.length > 0) {
      this.bus.emit('resources:changed', { changed: applied });
    }
    return applied;
  }

  canAfford(amounts: ResourceAmount[]): boolean {
    const totals = this.totals(amounts);
    for (const [id, amount] of totals) {
      if (this.get(id) < amount) return false;
    }
    return true;
  }

  spend(amounts: ResourceAmount[]): boolean {
    if (!this.canAfford(amounts)) return false;
    const totals = this.totals(amounts);
    const changed: ResourceAmount[] = [];
    for (const [id, amount] of totals) {
      if (amount <= 0) continue;
      this.state.resources[id] = this.get(id) - amount;
      changed.push({ id, amount: -amount });
    }
    if (changed.length > 0) {
      this.bus.emit('resources:changed', { changed });
    }
    return true;
  }

  private totals(amounts: ResourceAmount[]): Map<ResourceId, number> {
    const totals = new Map<ResourceId, number>();
    for (const amount of amounts) {
      const value = Math.floor(amount.amount);
      if (value <= 0) continue;
      totals.set(amount.id, (totals.get(amount.id) ?? 0) + value);
    }
    return totals;
  }
}
