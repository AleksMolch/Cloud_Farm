import type { GameData } from '../types/ConfigTypes';
import type { GameState } from '../types/GameState';
import type { EconomyService } from './EconomyService';
import type { EventBus } from './EventBus';
import type { ProductionService } from './ProductionService';
import { TimeService } from './TimeService';

export class UnlockService {
  constructor(
    private readonly state: GameState,
    private readonly data: GameData,
    private readonly economy: EconomyService,
    private readonly production: ProductionService,
    private readonly bus: EventBus,
    private readonly time: TimeService = new TimeService(),
  ) {}

  canUnlockZone(zoneId: string): boolean {
    const zone = this.data.zoneById[zoneId];
    if (!zone || this.state.zones[zoneId]?.unlocked) return false;
    return this.economy.canAfford(zone.unlockCost);
  }

  unlockZone(zoneId: string): boolean {
    const zone = this.data.zoneById[zoneId];
    if (!zone || !this.canUnlockZone(zoneId)) return false;
    if (!this.economy.spend(zone.unlockCost)) return false;

    this.state.zones[zoneId].unlocked = true;
    this.bus.emit('zone:unlocked', { zoneId, cost: zone.unlockCost });
    return true;
  }

  canUnlockObject(objectId: string): boolean {
    const config = this.data.objects[objectId];
    const objectState = this.state.objects[objectId];
    if (!config || !objectState) return false;
    if (objectState.unlocked) return false;
    if (this.state.zones[config.zoneId]?.unlocked !== true) return false;
    return this.economy.canAfford(config.unlockCost);
  }

  unlockObject(objectId: string): boolean {
    const config = this.data.objects[objectId];
    const objectState = this.state.objects[objectId];
    if (!config || !objectState || !this.canUnlockObject(objectId)) return false;
    if (!this.economy.spend(config.unlockCost)) return false;

    objectState.unlocked = true;
    this.production.onObjectUnlocked(objectId, this.time.now());
    this.bus.emit('object:unlocked', { objectId, cost: config.unlockCost });
    this.bus.emit('object:changed', { objectId });
    return true;
  }

  canHireHelper(helperId: string): boolean {
    const helper = this.data.helperById[helperId];
    if (!helper || this.state.helpers[helperId]) return false;
    return this.economy.canAfford(helper.cost);
  }

  hireHelper(helperId: string): boolean {
    const helper = this.data.helperById[helperId];
    if (!helper || !this.canHireHelper(helperId)) return false;
    if (!this.economy.spend(helper.cost)) return false;

    this.state.helpers[helperId] = true;
    this.bus.emit('helper:unlocked', { helperId, cost: helper.cost });
    return true;
  }
}
