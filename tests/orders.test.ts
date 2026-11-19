import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EconomyService } from '../src/game/systems/EconomyService';
import { EventBus } from '../src/game/systems/EventBus';
import { OrderService } from '../src/game/systems/OrderService';

const NOW = 1_700_000_000_000;

function setup(rng: () => number = () => 0) {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const economy = new EconomyService(state, bus);
  const orders = new OrderService(state, data, economy, bus, rng);
  orders.ensureOrders(NOW);
  return { data, state, bus, economy, orders };
}

describe('OrderService', () => {
  it('starts with the wheat tutorial order and two more orders', () => {
    const { state, orders } = setup();
    expect(state.orders).toHaveLength(3);
    expect(state.orders[0].templateId).toBe('order_wheat_2');
    expect(state.orders[0].requires).toEqual([{ id: 'wheat', amount: 2 }]);
    expect(state.orders[0].reward).toEqual([{ id: 'coin', amount: 20 }]);
    expect(orders.getEligibleTemplates().map((template) => template.id)).toContain(
      'order_wheat_2',
    );
  });

  it('does not spend resources when the player cannot afford an order', () => {
    const { state, orders } = setup();
    const result = orders.completeOrder(state.orders[0].instanceId, NOW);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('resources');
    expect(state.resources.wheat).toBe(0);
    expect(state.stats.ordersCompleted).toBe(0);
  });

  it('spends required resources, grants the reward and refills orders', () => {
    const { state, economy, orders } = setup();
    economy.grant([{ id: 'wheat', amount: 2 }]);

    const result = orders.completeOrder(state.orders[0].instanceId, NOW);

    expect(result.success).toBe(true);
    expect(state.resources.wheat).toBe(0);
    expect(state.resources.coin).toBe(20);
    expect(state.stats.ordersCompleted).toBe(1);
    expect(state.orders).toHaveLength(3);
    expect(state.orders.some((order) => order.instanceId === result.order?.instanceId)).toBe(
      false,
    );
  });

  it('replaces expired orders automatically', () => {
    const { state, orders } = setup();
    const oldIds = state.orders.map((order) => order.instanceId);

    expect(orders.ensureOrders(NOW + 901_000)).toBe(true);
    expect(state.orders).toHaveLength(3);
    expect(state.orders.every((order) => !oldIds.includes(order.instanceId))).toBe(true);
  });

  it('excludes recipes whose producer is locked', () => {
    const { orders } = setup();
    const ids = orders.getEligibleTemplates().map((template) => template.id);
    expect(ids).not.toContain('order_flour_2');
    expect(ids).not.toContain('order_pie_1');
    expect(ids).not.toContain('order_cream_1');
  });

  it('includes flour orders after the mill is unlocked', () => {
    const { state, orders } = setup();
    state.zones.mill.unlocked = true;
    state.objects.mill.unlocked = true;

    expect(orders.getEligibleTemplates().map((template) => template.id)).toContain(
      'order_flour_2',
    );
  });

  it('does not offer composite orders until all ingredients are producible', () => {
    const { state, orders } = setup();
    state.zones.mill.unlocked = true;
    state.objects.mill.unlocked = true;
    state.objects.bakery.unlocked = true;

    let ids = orders.getEligibleTemplates().map((template) => template.id);
    expect(ids).not.toContain('order_pie_1');
    expect(ids).not.toContain('order_cream_1');

    state.zones.yard.unlocked = true;
    state.objects.chicken.unlocked = true;
    state.objects.cow.unlocked = true;
    state.objects.dairy.unlocked = true;

    ids = orders.getEligibleTemplates().map((template) => template.id);
    expect(ids).toContain('order_pie_1');
    expect(ids).toContain('order_cream_1');
  });

  it('returns an expired reason for an expired order', () => {
    const { state, orders } = setup();
    const id = state.orders[0].instanceId;
    const result = orders.completeOrder(id, NOW + 901_000);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('expired');
  });
});
