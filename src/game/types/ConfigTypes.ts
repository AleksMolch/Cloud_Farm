import type { ResourceAmount, ResourceId } from './GameState';

export type ObjectKind = 'crop' | 'animal' | 'building';

export type HelperEffect = 'auto_collect' | 'animal_speed';

export interface PositionConfig {
  x: number;
  y: number;
}

export interface LevelConfig {
  level: number;
  seconds: number;
  yield: number;
}

export interface UpgradeConfig {
  baseCost: ResourceAmount[];
  growth: number;
  maxLevel: number;
}

export interface ObjectBaseConfig {
  id: string;
  kind: ObjectKind;
  zoneId: string;
  nameKey: string;
  icon: string;
  position: PositionConfig;
  unlockedByDefault?: boolean;
  unlockCost: ResourceAmount[];
  upgrade: UpgradeConfig;
  levels: LevelConfig[];
}

export interface CropConfig extends ObjectBaseConfig {
  kind: 'crop';
  resourceId: ResourceId;
}

export interface AnimalConfig extends ObjectBaseConfig {
  kind: 'animal';
  resourceId: ResourceId;
}

export interface RecipeConfig {
  id: string;
  nameKey: string;
  input: ResourceAmount[];
  output: ResourceAmount[];
}

export interface BuildingConfig extends ObjectBaseConfig {
  kind: 'building';
  recipes: RecipeConfig[];
}

export type FarmObjectConfig = CropConfig | AnimalConfig | BuildingConfig;

export interface ZoneConfig {
  id: string;
  nameKey: string;
  unlockCost: ResourceAmount[];
  defaultUnlocked: boolean;
  labelPosition?: PositionConfig;
}

export interface HelperConfig {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  cost: ResourceAmount[];
  effect: HelperEffect;
  value?: number;
  targetObjectId?: string;
  position: PositionConfig;
}

export interface OrderTemplateConfig {
  id: string;
  requires: ResourceAmount[];
  reward: ResourceAmount[];
  expiresSeconds: number;
  minOrdersCompleted?: number;
  weight?: number;
}

export interface TutorialHighlight {
  kind: 'object' | 'button';
  id: string;
}

export type TutorialGoal =
  | { type: 'collect'; objectId?: string }
  | { type: 'order_completed' }
  | { type: 'upgrade'; objectId?: string };

export interface TutorialStepConfig {
  id: string;
  textKey: string;
  highlight?: TutorialHighlight;
  goal: TutorialGoal;
  reward?: ResourceAmount[];
}

export type StoryTrigger =
  | { type: 'order_completed' }
  | { type: 'object_upgraded'; objectId?: string }
  | { type: 'object_unlocked'; objectId?: string }
  | { type: 'animal_unlocked' }
  | { type: 'zone_unlocked' };

export interface StoryBeatConfig {
  id: string;
  trigger: StoryTrigger;
  speakerKey: string;
  textKey: string;
}

export interface GameData {
  crops: CropConfig[];
  animals: AnimalConfig[];
  buildings: BuildingConfig[];
  zones: ZoneConfig[];
  helpers: HelperConfig[];
  orderTemplates: OrderTemplateConfig[];
  tutorial: TutorialStepConfig[];
  story: StoryBeatConfig[];
  objects: Record<string, FarmObjectConfig>;
  objectList: FarmObjectConfig[];
  zoneById: Record<string, ZoneConfig>;
  helperById: Record<string, HelperConfig>;
  producerByResource: Partial<Record<ResourceId, string>>;
}
