import type { GameData } from '../types/ConfigTypes';
import type { GameState, ResourceAmount } from '../types/GameState';
import type { EconomyService } from './EconomyService';
import type { EventBus } from './EventBus';

export class UpgradeService {
  constructor(
    private readonly state: GameState,
    private readonly data: GameData,
    private readonly economy: EconomyService,
    private readonly bus: EventBus,
  ) {}

  getUpgradeCost(objectId: string): ResourceAmount[] {
    const config = this.data.objects[objectId];
    if (!config) return [];
    const currentLevel = this.state.objects[objectId]?.level ?? 1;
    if (currentLevel >= config.upgrade.maxLevel) return [];
    const multiplier = Math.pow(config.upgrade.growth, currentLevel - 1);
    return config.upgrade.baseCost.map((cost) => ({
      id: cost.id,
      amount: Math.max(1, Math.round(cost.amount * multiplier)),
    }));
  }

  canUpgrade(objectId: string): boolean {
    const config = this.data.objects[objectId];
    if (!config) return false;
    const objectState = this.state.objects[objectId];
    if (!objectState?.unlocked) return false;
    if (this.state.zones[config.zoneId]?.unlocked !== true) return false;
    if (objectState.level >= config.upgrade.maxLevel) return false;
    return this.economy.canAfford(this.getUpgradeCost(objectId));
  }

  upgrade(objectId: string): boolean {
    const config = this.data.objects[objectId];
    const objectState = this.state.objects[objectId];
    if (!config || !objectState || !this.canUpgrade(objectId)) {
      return false;
    }

    const cost = this.getUpgradeCost(objectId);
    if (!this.economy.spend(cost)) {
      return false;
    }

    objectState.level = Math.min(config.upgrade.maxLevel, objectState.level + 1);
    this.bus.emit('object:upgraded', {
      objectId,
      level: objectState.level,
      cost,
    });
    this.bus.emit('object:changed', { objectId });
    return true;
  }
}
