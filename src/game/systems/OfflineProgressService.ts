import { RESOURCE_IDS } from '../types/GameState';
import type { GameData } from '../types/ConfigTypes';
import type { GameState, OfflineReport, ResourceAmount, ResourceId } from '../types/GameState';
import type { EconomyService } from './EconomyService';

export const MAX_OFFLINE_SECONDS = 2 * 60 * 60;
export const MAX_OFFLINE_CYCLES_PER_OBJECT = 60;

export class OfflineProgressService {
  constructor(private readonly data: GameData) {}

  compute(state: GameState, now: number): OfflineReport {
    const elapsedSeconds = Math.max(0, Math.floor((now - state.lastSaveTimestamp) / 1000));
    const creditedSeconds = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);
    if (creditedSeconds <= 0) {
      return { elapsedSeconds, creditedSeconds, gains: [] };
    }

    const gains = new Map<ResourceId, number>();

    for (const animal of this.data.animals) {
      const objectState = state.objects[animal.id];
      if (!objectState?.unlocked || state.zones[animal.zoneId]?.unlocked !== true) continue;
      const level = animal.levels.find((item) => item.level === objectState.level) ?? animal.levels[0];
      const seconds = Math.max(1, level.seconds * this.animalSpeedFactor(state));
      const cycles = Math.min(
        MAX_OFFLINE_CYCLES_PER_OBJECT,
        Math.floor(creditedSeconds / seconds),
      );
      if (cycles <= 0) continue;
      this.add(gains, animal.resourceId, cycles * level.yield);
    }

    for (const crop of this.data.crops) {
      if (!this.isAutoCollected(state, crop.id)) continue;
      const objectState = state.objects[crop.id];
      if (!objectState?.unlocked || state.zones[crop.zoneId]?.unlocked !== true) continue;
      if (objectState.productionEndsAt === null) continue;
      const level = crop.levels.find((item) => item.level === objectState.level) ?? crop.levels[0];
      const cycles = Math.min(
        MAX_OFFLINE_CYCLES_PER_OBJECT,
        Math.floor(creditedSeconds / Math.max(1, level.seconds)),
      );
      if (cycles <= 0) continue;
      this.add(gains, crop.resourceId, cycles * level.yield);
    }

    const result = [...gains.entries()]
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => RESOURCE_IDS.indexOf(a.id) - RESOURCE_IDS.indexOf(b.id));

    return { elapsedSeconds, creditedSeconds, gains: result };
  }

  claim(economy: EconomyService, report: OfflineReport, multiplier: number): ResourceAmount[] {
    const safeMultiplier = Math.max(1, Math.floor(multiplier));
    const gains = report.gains.map((amount) => ({
      id: amount.id,
      amount: amount.amount * safeMultiplier,
    }));
    return economy.grant(gains);
  }

  private add(target: Map<ResourceId, number>, id: ResourceId, amount: number): void {
    if (amount <= 0) return;
    target.set(id, (target.get(id) ?? 0) + amount);
  }

  private animalSpeedFactor(state: GameState): number {
    let reduction = 0;
    for (const helper of this.data.helpers) {
      if (helper.effect !== 'animal_speed' || !state.helpers[helper.id]) continue;
      reduction += helper.value ?? 0.2;
    }
    return 1 - Math.min(0.8, Math.max(0, reduction));
  }

  private isAutoCollected(state: GameState, objectId: string): boolean {
    return this.data.helpers.some(
      (helper) =>
        helper.effect === 'auto_collect' &&
        helper.targetObjectId === objectId &&
        state.helpers[helper.id] === true,
    );
  }
}
