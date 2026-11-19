import { RESOURCE_IDS, SAVE_VERSION } from '../types/GameState';
import type {
  FarmObjectState,
  GameState,
  GameSettings,
  GameStats,
  ResourceAmount,
  ResourceId,
  SupportedLanguage,
} from '../types/GameState';
import type { FarmObjectConfig, GameData, ObjectBaseConfig } from '../types/ConfigTypes';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['ru', 'en'];

function emptyResources(): Record<ResourceId, number> {
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0])) as Record<ResourceId, number>;
}

function defaultObjectState(config: ObjectBaseConfig): FarmObjectState {
  return {
    id: config.id,
    unlocked: config.unlockedByDefault === true,
    level: 1,
    productionStartedAt: null,
    productionEndsAt: null,
    recipeId: null,
  };
}

function makeInitialObjectState(config: FarmObjectConfig, now: number): FarmObjectState {
  const state = defaultObjectState(config);

  if (state.unlocked) {
    const levelConfig = config.levels[0];
    if (config.kind === 'crop') {
      state.productionStartedAt = now - levelConfig.seconds * 1000;
      state.productionEndsAt = now;
    } else if (config.kind === 'animal') {
      state.productionStartedAt = now;
      state.productionEndsAt = now + levelConfig.seconds * 1000;
    }
  }

  return state;
}

export function createInitialState(data: GameData, now: number): GameState {
  const objects: Record<string, FarmObjectState> = {};
  for (const config of data.objectList) {
    objects[config.id] = makeInitialObjectState(config, now);
  }

  const zones: Record<string, { unlocked: boolean }> = {};
  for (const zone of data.zones) {
    zones[zone.id] = { unlocked: zone.defaultUnlocked };
  }

  const helpers: Record<string, boolean> = {};
  for (const helper of data.helpers) {
    helpers[helper.id] = false;
  }

  return {
    version: SAVE_VERSION,
    resources: emptyResources(),
    objects,
    zones,
    helpers,
    orders: [],
    completedTutorialSteps: [],
    pendingOffline: null,
    settings: {
      music: true,
      sfx: true,
      language: null,
    },
    stats: {
      ordersCompleted: 0,
      adsWatched: 0,
      totalCollected: 0,
      totalPlaySeconds: 0,
      sessionStartedAt: now,
    },
    lastSaveTimestamp: now,
    nextOrderId: 1,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeAmounts(value: unknown, known: Set<string>): ResourceAmount[] {
  if (!Array.isArray(value)) return [];
  const result: ResourceAmount[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const amount = entry as { id?: unknown; amount?: unknown };
    if (typeof amount.id !== 'string' || !known.has(amount.id)) continue;
    const quantity = numberOr(amount.amount, 0);
    if (quantity > 0) {
      result.push({ id: amount.id as ResourceId, amount: Math.floor(quantity) });
    }
  }
  return result;
}

function sanitizeObject(
  config: FarmObjectConfig,
  raw: unknown,
): FarmObjectState {
  const fallback = defaultObjectState(config);
  if (!raw || typeof raw !== 'object') return fallback;
  const source = raw as Partial<FarmObjectState>;

  const unlocked = typeof source.unlocked === 'boolean' ? source.unlocked : fallback.unlocked;
  const maxLevel = config.upgrade.maxLevel;
  const level = Math.min(maxLevel, Math.max(1, Math.floor(numberOr(source.level, 1))));
  const startedAt = typeof source.productionStartedAt === 'number' ? source.productionStartedAt : null;
  const endsAt = typeof source.productionEndsAt === 'number' ? source.productionEndsAt : null;

  let recipeId: string | null = null;
  if (config.kind === 'building' && typeof source.recipeId === 'string') {
    recipeId = config.recipes.some((recipe) => recipe.id === source.recipeId) ? source.recipeId : null;
  }

  return {
    id: config.id,
    unlocked,
    level,
    productionStartedAt: startedAt,
    productionEndsAt: endsAt,
    recipeId,
  };
}

export function normalizeState(raw: unknown, data: GameData, now: number): GameState {
  if (!raw || typeof raw !== 'object') {
    return createInitialState(data, now);
  }

  const source = raw as Partial<GameState>;
  const resources = emptyResources();
  const rawResources = (source.resources ?? {}) as Record<string, unknown>;
  for (const id of RESOURCE_IDS) {
    resources[id] = Math.max(0, Math.floor(numberOr(rawResources[id], 0)));
  }

  const objects: Record<string, FarmObjectState> = {};
  const rawObjects = (source.objects ?? {}) as Record<string, unknown>;
  for (const config of data.objectList) {
    objects[config.id] = sanitizeObject(config, rawObjects[config.id]);
  }

  const zones: Record<string, { unlocked: boolean }> = {};
  const rawZones = (source.zones ?? {}) as Record<string, unknown>;
  for (const zone of data.zones) {
    const stored = rawZones[zone.id] as { unlocked?: unknown } | undefined;
    const unlocked =
      zone.defaultUnlocked || (stored && typeof stored.unlocked === 'boolean' ? stored.unlocked : false);
    zones[zone.id] = { unlocked };
  }

  const helpers: Record<string, boolean> = {};
  const rawHelpers = (source.helpers ?? {}) as Record<string, unknown>;
  for (const helper of data.helpers) {
    helpers[helper.id] = rawHelpers[helper.id] === true;
  }

  const knownResources = new Set<string>(RESOURCE_IDS);
  const knownTemplates = new Set(data.orderTemplates.map((template) => template.id));
  const orders = Array.isArray(source.orders)
    ? source.orders
        .filter((order): order is NonNullable<typeof order> => Boolean(order && typeof order === 'object'))
        .map((order) => {
          const requires = sanitizeAmounts(order.requires, knownResources);
          const reward = sanitizeAmounts(order.reward, knownResources);
          return {
            instanceId: Math.floor(numberOr(order.instanceId, 0)),
            templateId: String(order.templateId ?? ''),
            requires,
            reward,
            createdAt: numberOr(order.createdAt, now),
            expiresAt: numberOr(order.expiresAt, now + 900_000),
          };
        })
        .filter(
          (order) =>
            order.instanceId > 0 &&
            knownTemplates.has(order.templateId) &&
            order.requires.length > 0 &&
            order.reward.length > 0,
        )
    : [];

  const pendingOffline = sanitizeOfflineReport(source.pendingOffline, knownResources);

  const knownSteps = new Set(data.tutorial.map((step) => step.id));
  const completedTutorialSteps = Array.isArray(source.completedTutorialSteps)
    ? source.completedTutorialSteps.filter(
        (id): id is string => typeof id === 'string' && knownSteps.has(id),
      )
    : [];

  const rawSettings = (source.settings ?? {}) as Partial<GameSettings>;
  const language = rawSettings.language;
  const settings = {
    music: typeof rawSettings.music === 'boolean' ? rawSettings.music : true,
    sfx: typeof rawSettings.sfx === 'boolean' ? rawSettings.sfx : true,
    language:
      typeof language === 'string' && SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
        ? (language as SupportedLanguage)
        : null,
  };

  const rawStats = (source.stats ?? {}) as Partial<GameStats>;
  const stats = {
    ordersCompleted: Math.max(0, Math.floor(numberOr(rawStats.ordersCompleted, 0))),
    adsWatched: Math.max(0, Math.floor(numberOr(rawStats.adsWatched, 0))),
    totalCollected: Math.max(0, Math.floor(numberOr(rawStats.totalCollected, 0))),
    totalPlaySeconds: Math.max(0, numberOr(rawStats.totalPlaySeconds, 0)),
    sessionStartedAt: now,
  };

  const nextOrderId = Math.max(
    1,
    Math.floor(numberOr(source.nextOrderId, 1)),
    ...orders.map((order) => order.instanceId + 1),
  );

  return {
    version: SAVE_VERSION,
    resources,
    objects,
    zones,
    helpers,
    orders,
    completedTutorialSteps,
    pendingOffline,
    settings,
    stats,
    lastSaveTimestamp: numberOr(source.lastSaveTimestamp, now),
    nextOrderId,
  };
}

function sanitizeOfflineReport(
  raw: unknown,
  knownResources: Set<string>,
): GameState['pendingOffline'] {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as { elapsedSeconds?: unknown; creditedSeconds?: unknown; gains?: unknown };
  const gains = sanitizeAmounts(source.gains, knownResources);
  if (gains.length === 0) return null;
  return {
    elapsedSeconds: Math.max(0, Math.floor(numberOr(source.elapsedSeconds, 0))),
    creditedSeconds: Math.max(0, Math.floor(numberOr(source.creditedSeconds, 0))),
    gains,
  };
}
