import type { ResourceAmount } from '../types/GameState';

export interface GameEventMap {
  'resources:changed': { changed: ResourceAmount[] };
  'object:changed': { objectId: string };
  'crop:collected': { objectId: string; output: ResourceAmount[]; auto: boolean };
  'animal:collected': { objectId: string; output: ResourceAmount[] };
  'building:started': {
    objectId: string;
    recipeId: string;
    input: ResourceAmount[];
  };
  'building:collected': { objectId: string; output: ResourceAmount[] };
  'object:upgraded': {
    objectId: string;
    level: number;
    cost: ResourceAmount[];
  };
  'object:unlocked': { objectId: string; cost: ResourceAmount[] };
  'zone:unlocked': { zoneId: string; cost: ResourceAmount[] };
  'helper:unlocked': { helperId: string; cost: ResourceAmount[] };
  'orders:changed': void;
  'order:completed': {
    instanceId: number;
    templateId: string;
    reward: ResourceAmount[];
  };
  'tutorial:changed': { stepId: string | null };
  'tutorial:step_completed': { stepId: string; reward: ResourceAmount[] };
  toast: { key: string; params?: Record<string, string | number> };
  'game:save-requested': void;
  'game:paused': { paused: boolean };
  'settings:changed': void;
  'ad:started': { placement: string; kind: 'rewarded' | 'interstitial' };
  'ad:finished': {
    placement: string;
    kind: 'rewarded' | 'interstitial';
    success: boolean;
  };
  'offline:claimed': { multiplier: number; gains: ResourceAmount[] };
  'goal:changed': void;
  'ui:open-panel': {
    panel: 'orders' | 'shop' | 'object' | 'settings' | 'offline' | 'storage';
    objectId?: string;
  };
}

type Handler<T> = (payload: T) => void;
type EmitArgs<K extends keyof GameEventMap> = GameEventMap[K] extends void
  ? []
  : [GameEventMap[K]];

export class EventBus {
  private readonly listeners = new Map<keyof GameEventMap, Set<Handler<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof GameEventMap>(event: K, ...args: EmitArgs<K>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    const payload = args[0];
    for (const handler of [...handlers]) {
      handler(payload);
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
