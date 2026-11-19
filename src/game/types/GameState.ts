export const RESOURCE_IDS = [
  'coin',
  'crystal',
  'wheat',
  'carrot',
  'strawberry',
  'cloudberry',
  'egg',
  'milk',
  'wool',
  'flour',
  'pie',
  'cream',
] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export type SupportedLanguage = 'ru' | 'en';

export const SAVE_VERSION = 1;

export interface ResourceAmount {
  id: ResourceId;
  amount: number;
}

export interface FarmObjectState {
  id: string;
  unlocked: boolean;
  level: number;
  productionStartedAt: number | null;
  productionEndsAt: number | null;
  recipeId: string | null;
}

export interface ZoneState {
  unlocked: boolean;
}

export interface ActiveOrder {
  instanceId: number;
  templateId: string;
  requires: ResourceAmount[];
  reward: ResourceAmount[];
  createdAt: number;
  expiresAt: number;
}

export interface GameSettings {
  music: boolean;
  sfx: boolean;
  language: SupportedLanguage | null;
}

export interface GameStats {
  ordersCompleted: number;
  adsWatched: number;
  totalCollected: number;
  totalPlaySeconds: number;
  sessionStartedAt: number;
}

export interface GameState {
  version: number;
  resources: Record<ResourceId, number>;
  objects: Record<string, FarmObjectState>;
  zones: Record<string, ZoneState>;
  helpers: Record<string, boolean>;
  orders: ActiveOrder[];
  completedTutorialSteps: string[];
  pendingOffline: OfflineReport | null;
  settings: GameSettings;
  stats: GameStats;
  lastSaveTimestamp: number;
  nextOrderId: number;
}

export interface OfflineReport {
  elapsedSeconds: number;
  creditedSeconds: number;
  gains: ResourceAmount[];
}

export interface ObjectStatus {
  kind: 'locked' | 'empty' | 'idle' | 'growing' | 'ready' | 'producing';
  progress: number;
  remainingSeconds: number;
  recipeId: string | null;
}
