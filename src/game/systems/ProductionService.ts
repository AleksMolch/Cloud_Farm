import type {
  FarmObjectConfig,
  GameData,
  LevelConfig,
  RecipeConfig,
} from '../types/ConfigTypes';
import type {
  FarmObjectState,
  GameState,
  ObjectStatus,
  ResourceAmount,
} from '../types/GameState';
import type { EconomyService } from './EconomyService';
import type { EventBus } from './EventBus';

export interface InteractionResult {
  action: 'none' | 'locked' | 'collect' | 'plant';
  output: ResourceAmount[];
}

export interface AutoCollectResult {
  objectId: string;
  output: ResourceAmount[];
}

export class ProductionService {
  constructor(
    private readonly state: GameState,
    private readonly data: GameData,
    private readonly economy: EconomyService,
    private readonly bus: EventBus,
  ) {}

  getObjectConfig(objectId: string): FarmObjectConfig {
    const config = this.data.objects[objectId];
    if (!config) throw new Error(`Unknown farm object: ${objectId}`);
    return config;
  }

  getObjectState(objectId: string): FarmObjectState {
    const state = this.state.objects[objectId];
    if (!state) throw new Error(`Missing farm object state: ${objectId}`);
    return state;
  }

  getLevelConfig(objectId: string): LevelConfig {
    const config = this.getObjectConfig(objectId);
    const state = this.getObjectState(objectId);
    return config.levels.find((level) => level.level === state.level) ?? config.levels[0];
  }

  isObjectUnlocked(objectId: string): boolean {
    const config = this.getObjectConfig(objectId);
    const state = this.getObjectState(objectId);
    return state.unlocked && this.state.zones[config.zoneId]?.unlocked === true;
  }

  getStatus(objectId: string, now: number): ObjectStatus {
    if (!this.isObjectUnlocked(objectId)) {
      return { kind: 'locked', progress: 0, remainingSeconds: 0, recipeId: null };
    }

    const config = this.getObjectConfig(objectId);
    const state = this.getObjectState(objectId);
    const recipeId = config.kind === 'building' ? state.recipeId : null;

    if (state.productionEndsAt === null) {
      return {
        kind: config.kind === 'crop' ? 'empty' : 'idle',
        progress: 0,
        remainingSeconds: 0,
        recipeId,
      };
    }

    if (now < state.productionEndsAt) {
      const totalMs =
        state.productionStartedAt !== null
          ? Math.max(1, state.productionEndsAt - state.productionStartedAt)
          : Math.max(1, this.durationMs(objectId));
      const remainingMs = state.productionEndsAt - now;
      return {
        kind: config.kind === 'building' ? 'producing' : 'growing',
        progress: Math.min(1, Math.max(0, 1 - remainingMs / totalMs)),
        remainingSeconds: Math.ceil(remainingMs / 1000),
        recipeId,
      };
    }

    return { kind: 'ready', progress: 1, remainingSeconds: 0, recipeId };
  }

  interact(objectId: string, now: number): InteractionResult {
    if (!this.isObjectUnlocked(objectId)) {
      return { action: 'locked', output: [] };
    }

    const config = this.getObjectConfig(objectId);
    if (config.kind === 'building') {
      if (this.getStatus(objectId, now).kind === 'ready') {
        return { action: 'collect', output: this.collect(objectId, now) ?? [] };
      }
      return { action: 'none', output: [] };
    }

    const status = this.getStatus(objectId, now);
    if (status.kind === 'ready') {
      return { action: 'collect', output: this.collect(objectId, now) ?? [] };
    }
    if (config.kind === 'crop' && status.kind === 'empty') {
      return { action: 'plant', output: this.plant(objectId, now) ? [] : [] };
    }
    if (config.kind === 'animal' && status.kind === 'idle') {
      this.onObjectUnlocked(objectId, now);
    }
    return { action: 'none', output: [] };
  }

  plant(objectId: string, now: number): boolean {
    const config = this.getObjectConfig(objectId);
    const state = this.getObjectState(objectId);
    if (config.kind !== 'crop' || !this.isObjectUnlocked(objectId)) return false;
    if (state.productionEndsAt !== null) return false;

    state.productionStartedAt = now;
    state.productionEndsAt = now + this.durationMs(objectId);
    this.bus.emit('object:changed', { objectId });
    return true;
  }

  collect(objectId: string, now: number): ResourceAmount[] | null {
    const config = this.getObjectConfig(objectId);
    if (config.kind === 'building') {
      return this.collectBuilding(objectId, now);
    }
    if (this.getStatus(objectId, now).kind !== 'ready') return null;
    if (config.kind === 'crop') {
      return this.collectCrop(objectId, now, false);
    }
    return this.collectAnimal(objectId, now);
  }

  onObjectUnlocked(objectId: string, now: number): void {
    const config = this.getObjectConfig(objectId);
    const state = this.getObjectState(objectId);
    if (config.kind !== 'animal') return;
    if (!this.isObjectUnlocked(objectId)) return;
    if (state.productionEndsAt !== null) return;

    state.productionStartedAt = now;
    state.productionEndsAt = now + this.durationMs(objectId);
    this.bus.emit('object:changed', { objectId });
  }

  startBuilding(objectId: string, recipeId: string, now: number): boolean {
    const config = this.getObjectConfig(objectId);
    const state = this.getObjectState(objectId);
    if (config.kind !== 'building' || !this.isObjectUnlocked(objectId)) return false;
    if (state.productionEndsAt !== null) return false;

    const recipe = config.recipes.find((item) => item.id === recipeId);
    if (!recipe) return false;
    if (!this.economy.spend(recipe.input)) return false;

    state.recipeId = recipe.id;
    state.productionStartedAt = now;
    state.productionEndsAt = now + this.durationMs(objectId);
    this.bus.emit('building:started', {
      objectId,
      recipeId: recipe.id,
      input: recipe.input,
    });
    this.bus.emit('object:changed', { objectId });
    return true;
  }

  collectBuilding(objectId: string, now: number): ResourceAmount[] | null {
    const config = this.getObjectConfig(objectId);
    if (config.kind !== 'building') return null;
    if (this.getStatus(objectId, now).kind !== 'ready') return null;

    const state = this.getObjectState(objectId);
    const recipe =
      config.recipes.find((item) => item.id === state.recipeId) ?? config.recipes[0];
    if (!recipe) return null;

    const output = this.recipeOutput(objectId, recipe);
    this.economy.grant(output);
    this.addCollectedStats(output);

    state.productionStartedAt = null;
    state.productionEndsAt = null;
    this.bus.emit('building:collected', { objectId, output });
    this.bus.emit('object:changed', { objectId });
    return output;
  }

  speedUp(objectId: string, seconds: number, now: number): boolean {
    if (!this.isObjectUnlocked(objectId)) return false;
    const state = this.getObjectState(objectId);
    if (state.productionEndsAt === null || state.productionEndsAt <= now) return false;

    state.productionEndsAt = Math.max(now, state.productionEndsAt - seconds * 1000);
    this.bus.emit('object:changed', { objectId });
    return true;
  }

  tickAutoCollect(now: number): AutoCollectResult[] {
    const results: AutoCollectResult[] = [];
    for (const crop of this.data.crops) {
      if (!this.isAutoCollected(crop.id) || !this.isObjectUnlocked(crop.id)) continue;
      const state = this.getObjectState(crop.id);
      const status = this.getStatus(crop.id, now);
      if (status.kind === 'empty') {
        this.plant(crop.id, now);
        continue;
      }
      if (status.kind !== 'ready') continue;

      const duration = this.durationMs(crop.id);
      const readyAt = state.productionEndsAt ?? now;
      const rawCycles = 1 + Math.max(0, Math.floor((now - readyAt) / duration));
      const cycles = Math.min(60, rawCycles);
      const level = this.getLevelConfig(crop.id);
      const output: ResourceAmount[] = [
        { id: crop.resourceId, amount: level.yield * cycles },
      ];
      this.economy.grant(output);
      this.addCollectedStats(output);

      const nextEnd =
        rawCycles > 60 ? now + duration : readyAt + cycles * duration;
      state.productionStartedAt = nextEnd - duration;
      state.productionEndsAt = nextEnd;

      this.bus.emit('crop:collected', { objectId: crop.id, output, auto: true });
      this.bus.emit('object:changed', { objectId: crop.id });
      results.push({ objectId: crop.id, output });
    }
    return results;
  }

  rebaseOffline(now: number): void {
    for (const animal of this.data.animals) {
      if (!this.isObjectUnlocked(animal.id)) continue;
      const state = this.getObjectState(animal.id);
      state.productionStartedAt = now;
      state.productionEndsAt = now + this.durationMs(animal.id);
      this.bus.emit('object:changed', { objectId: animal.id });
    }
    for (const crop of this.data.crops) {
      if (!this.isAutoCollected(crop.id) || !this.isObjectUnlocked(crop.id)) continue;
      const state = this.getObjectState(crop.id);
      state.productionStartedAt = now;
      state.productionEndsAt = now + this.durationMs(crop.id);
      this.bus.emit('object:changed', { objectId: crop.id });
    }
  }

  getRecipeOutput(objectId: string, recipeId: string): ResourceAmount[] {
    const config = this.getObjectConfig(objectId);
    if (config.kind !== 'building') return [];
    const recipe = config.recipes.find((item) => item.id === recipeId);
    return recipe ? this.recipeOutput(objectId, recipe) : [];
  }

  getRecipe(objectId: string, recipeId: string | null): RecipeConfig | null {
    const config = this.getObjectConfig(objectId);
    if (config.kind !== 'building') return null;
    return config.recipes.find((item) => item.id === recipeId) ?? config.recipes[0] ?? null;
  }

  getResourceOutput(objectId: string): ResourceAmount[] {
    const config = this.getObjectConfig(objectId);
    const level = this.getLevelConfig(objectId);
    if (config.kind === 'crop' || config.kind === 'animal') {
      return [{ id: config.resourceId, amount: level.yield }];
    }
    return [];
  }

  private collectCrop(objectId: string, now: number, auto: boolean): ResourceAmount[] | null {
    void now;
    const config = this.getObjectConfig(objectId);
    if (config.kind !== 'crop') return null;
    const state = this.getObjectState(objectId);
    const output = this.getResourceOutput(objectId);
    this.economy.grant(output);
    this.addCollectedStats(output);

    state.productionStartedAt = null;
    state.productionEndsAt = null;
    this.bus.emit('crop:collected', { objectId, output, auto });
    this.bus.emit('object:changed', { objectId });
    return output;
  }

  private collectAnimal(objectId: string, now: number): ResourceAmount[] | null {
    const config = this.getObjectConfig(objectId);
    if (config.kind !== 'animal') return null;
    const state = this.getObjectState(objectId);
    const output = this.getResourceOutput(objectId);
    this.economy.grant(output);
    this.addCollectedStats(output);

    state.productionStartedAt = now;
    state.productionEndsAt = now + this.durationMs(objectId);
    this.bus.emit('animal:collected', { objectId, output });
    this.bus.emit('object:changed', { objectId });
    return output;
  }

  private recipeOutput(objectId: string, recipe: RecipeConfig): ResourceAmount[] {
    const level = this.getLevelConfig(objectId);
    return recipe.output.map((amount) => ({
      id: amount.id,
      amount: amount.amount * level.yield,
    }));
  }

  private durationMs(objectId: string): number {
    const config = this.getObjectConfig(objectId);
    const level = this.getLevelConfig(objectId);
    const base = level.seconds * 1000;
    if (config.kind !== 'animal') return base;
    return Math.round(base * this.animalSpeedFactor());
  }

  private animalSpeedFactor(): number {
    let reduction = 0;
    for (const helper of this.data.helpers) {
      if (helper.effect !== 'animal_speed' || !this.state.helpers[helper.id]) continue;
      reduction += helper.value ?? 0.2;
    }
    return 1 - Math.min(0.8, Math.max(0, reduction));
  }

  private isAutoCollected(objectId: string): boolean {
    return this.data.helpers.some(
      (helper) =>
        helper.effect === 'auto_collect' &&
        helper.targetObjectId === objectId &&
        this.state.helpers[helper.id] === true,
    );
  }

  private addCollectedStats(output: ResourceAmount[]): void {
    const total = output.reduce((sum, amount) => sum + amount.amount, 0);
    this.state.stats.totalCollected += total;
  }
}
