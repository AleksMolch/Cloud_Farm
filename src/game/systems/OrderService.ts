import type { GameData, OrderTemplateConfig } from '../types/ConfigTypes';
import type { ActiveOrder, GameState, ResourceAmount } from '../types/GameState';
import type { EconomyService } from './EconomyService';
import type { EventBus } from './EventBus';

export interface CompleteOrderResult {
  success: boolean;
  reason?: 'missing' | 'expired' | 'resources';
  order?: ActiveOrder;
  reward?: ResourceAmount[];
}

export const ACTIVE_ORDER_COUNT = 3;

export class OrderService {
  constructor(
    private readonly state: GameState,
    private readonly data: GameData,
    private readonly economy: EconomyService,
    private readonly bus: EventBus,
    private readonly rng: () => number = Math.random,
  ) {}

  getEligibleTemplates(): OrderTemplateConfig[] {
    return this.data.orderTemplates.filter((template) => {
      if ((template.minOrdersCompleted ?? 0) > this.state.stats.ordersCompleted) {
        return false;
      }
      return template.requires.every((required) => {
        const producerId = this.data.producerByResource[required.id];
        if (!producerId) return false;
        const producerConfig = this.data.objects[producerId];
        const producerState = this.state.objects[producerId];
        if (!producerConfig || !producerState) return false;
        return (
          producerState.unlocked &&
          this.state.zones[producerConfig.zoneId]?.unlocked === true
        );
      });
    });
  }

  ensureOrders(now: number): boolean {
    let changed = false;

    const active = this.state.orders.filter((order) => order.expiresAt > now);
    if (active.length !== this.state.orders.length) {
      changed = true;
    }
    if (active.length > ACTIVE_ORDER_COUNT) {
      active.length = ACTIVE_ORDER_COUNT;
      changed = true;
    }

    while (active.length < ACTIVE_ORDER_COUNT) {
      const template = this.pickTemplate(active);
      if (!template) break;
      active.push(this.createOrder(template, now));
      changed = true;
    }

    this.state.orders = active;
    if (changed) {
      this.bus.emit('orders:changed');
    }
    return changed;
  }

  completeOrder(instanceId: number, now: number): CompleteOrderResult {
    const order = this.state.orders.find((item) => item.instanceId === instanceId);
    if (!order) {
      return { success: false, reason: 'missing' };
    }
    if (now >= order.expiresAt) {
      this.ensureOrders(now);
      return { success: false, reason: 'expired', order };
    }
    if (!this.economy.canAfford(order.requires)) {
      return { success: false, reason: 'resources', order };
    }
    if (!this.economy.spend(order.requires)) {
      return { success: false, reason: 'resources', order };
    }

    this.economy.grant(order.reward);
    this.state.stats.ordersCompleted += 1;
    this.state.orders = this.state.orders.filter((item) => item.instanceId !== instanceId);

    this.bus.emit('order:completed', {
      instanceId: order.instanceId,
      templateId: order.templateId,
      reward: order.reward,
    });
    this.ensureOrders(now);

    return { success: true, order, reward: order.reward };
  }

  private pickTemplate(active: ActiveOrder[]): OrderTemplateConfig | null {
    const eligible = this.getEligibleTemplates();
    if (eligible.length === 0) return null;

    if (this.state.stats.ordersCompleted === 0 && active.length === 0) {
      const firstOrder = eligible.find((template) => template.id === 'order_wheat_2');
      if (firstOrder) return firstOrder;
    }

    const used = new Set(active.map((order) => order.templateId));
    let candidates = eligible.filter((template) => !used.has(template.id));
    if (candidates.length === 0) {
      candidates = eligible;
    }

    const totalWeight = candidates.reduce(
      (sum, template) => sum + Math.max(1, template.weight ?? 1),
      0,
    );
    let roll = this.rng() * totalWeight;
    for (const template of candidates) {
      roll -= Math.max(1, template.weight ?? 1);
      if (roll < 0) return template;
    }
    return candidates[candidates.length - 1] ?? null;
  }

  private createOrder(template: OrderTemplateConfig, now: number): ActiveOrder {
    return {
      instanceId: this.state.nextOrderId++,
      templateId: template.id,
      requires: template.requires.map((amount) => ({ ...amount })),
      reward: template.reward.map((amount) => ({ ...amount })),
      createdAt: now,
      expiresAt: now + template.expiresSeconds * 1000,
    };
  }
}
