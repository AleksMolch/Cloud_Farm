import type { ResourceAmount, ResourceId } from '../types/GameState';
import type { LocalizationService } from '../systems/LocalizationService';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const FONT_FAMILY =
  '"Trebuchet MS", "Segoe UI", "Arial Rounded MT Bold", Arial, sans-serif';

export const COLORS = {
  ink: 0x28495b,
  inkDark: 0x183448,
  inkSoft: 0x4f748b,
  panel: 0xfff8ec,
  panelAlt: 0xffeed0,
  panelStroke: 0xd9b06c,
  accent: 0xffa63d,
  accentDark: 0xd98222,
  green: 0x67c45a,
  greenDark: 0x3f8f3d,
  coin: 0xffcf4a,
  crystal: 0x7fdfff,
  red: 0xe05d5d,
  white: 0xffffff,
  sky: 0x8ed8f8,
} as const;

export const TEXT = {
  ink: '#28495b',
  inkSoft: '#4f748b',
  white: '#ffffff',
  coin: '#f2a81f',
  green: '#3f8f3d',
  accent: '#e8801f',
  red: '#d94b4b',
};

export const ASSET_PATH = (name: string): string => `assets/images/${name}.svg`;

const RESOURCE_ICONS: Record<ResourceId, string> = {
  coin: 'icon_coin',
  crystal: 'icon_crystal',
  wheat: 'crop_wheat',
  carrot: 'crop_carrot',
  strawberry: 'crop_strawberry',
  cloudberry: 'crop_cloudberry',
  egg: 'resource_egg',
  milk: 'resource_milk',
  wool: 'resource_wool',
  flour: 'resource_flour',
  pie: 'resource_pie',
  cream: 'resource_cream',
};

export function iconForResource(id: ResourceId): string {
  return RESOURCE_ICONS[id];
}

export function formatNumber(value: number): string {
  const rounded = Math.floor(value);
  if (rounded >= 1_000_000) {
    return `${(rounded / 1_000_000).toFixed(1).replace('.0', '')}M`;
  }
  if (rounded >= 10_000) {
    return `${(rounded / 1000).toFixed(1).replace('.0', '')}K`;
  }
  return String(rounded);
}

export function formatDuration(seconds: number, loc: LocalizationService): string {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return `${loc.t('common.hours', { n: hours })} ${loc.t('common.minutes', {
      n: minutes,
    })}`;
  }
  if (minutes > 0) {
    return `${loc.t('common.minutes', { n: minutes })} ${loc.t('common.seconds', {
      n: rest,
    })}`;
  }
  return loc.t('common.seconds', { n: rest });
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatCost(
  amounts: ResourceAmount[],
  loc: LocalizationService,
): string {
  return amounts
    .map((amount) => `${amount.amount} ${loc.t(`currency.${amount.id}`)}`)
    .join(' · ');
}

export function formatAmounts(
  amounts: ResourceAmount[],
  loc: LocalizationService,
): string {
  return amounts
    .map((amount) => `${amount.amount} ${loc.t(`resource.${amount.id}`)}`)
    .join(' · ');
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
