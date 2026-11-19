import cropsJson from '../../data/crops.json';
import animalsJson from '../../data/animals.json';
import buildingsJson from '../../data/buildings.json';
import zonesJson from '../../data/zones.json';
import helpersJson from '../../data/helpers.json';
import ordersJson from '../../data/orders.json';
import tutorialJson from '../../data/tutorial.json';
import type { ResourceId } from '../types/GameState';
import type {
  AnimalConfig,
  BuildingConfig,
  CropConfig,
  FarmObjectConfig,
  GameData,
  HelperConfig,
  OrderTemplateConfig,
  TutorialStepConfig,
  ZoneConfig,
} from '../types/ConfigTypes';

let cached: GameData | null = null;

export function loadGameData(): GameData {
  if (cached) return cached;

  const crops = cropsJson as unknown as CropConfig[];
  const animals = animalsJson as unknown as AnimalConfig[];
  const buildings = buildingsJson as unknown as BuildingConfig[];
  const zones = zonesJson as unknown as ZoneConfig[];
  const helpers = helpersJson as unknown as HelperConfig[];
  const orderTemplates = ordersJson as unknown as OrderTemplateConfig[];
  const tutorial = tutorialJson as unknown as TutorialStepConfig[];

  const objectList: FarmObjectConfig[] = [...crops, ...animals, ...buildings];
  const objects: Record<string, FarmObjectConfig> = {};
  for (const object of objectList) {
    if (objects[object.id]) {
      throw new Error(`Duplicate farm object id: ${object.id}`);
    }
    objects[object.id] = object;
  }

  const zoneById: Record<string, ZoneConfig> = {};
  for (const zone of zones) {
    zoneById[zone.id] = zone;
  }

  const helperById: Record<string, HelperConfig> = {};
  for (const helper of helpers) {
    helperById[helper.id] = helper;
  }

  const producerByResource: Partial<Record<ResourceId, string>> = {};
  for (const crop of crops) {
    producerByResource[crop.resourceId] = crop.id;
  }
  for (const animal of animals) {
    producerByResource[animal.resourceId] = animal.id;
  }
  for (const building of buildings) {
    for (const recipe of building.recipes) {
      for (const output of recipe.output) {
        producerByResource[output.id] = building.id;
      }
    }
  }

  cached = {
    crops,
    animals,
    buildings,
    zones,
    helpers,
    orderTemplates,
    tutorial,
    objects,
    objectList,
    zoneById,
    helperById,
    producerByResource,
  };

  return cached;
}
