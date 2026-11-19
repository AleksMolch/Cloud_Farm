import { describe, expect, it } from 'vitest';
import { LocalizationService } from '../src/game/systems/LocalizationService';

describe('LocalizationService', () => {
  it('uses the platform language when supported', () => {
    const loc = new LocalizationService('ru-RU');
    expect(loc.getLanguage()).toBe('ru');
    expect(loc.t('hud.orders')).toBe('Заказы');
  });

  it('falls back to English for unsupported platform languages', () => {
    const loc = new LocalizationService('de-DE');
    expect(loc.getLanguage()).toBe('en');
    expect(loc.t('hud.orders')).toBe('Orders');
  });

  it('prefers the saved language over the platform language', () => {
    const loc = new LocalizationService('en', 'ru');
    expect(loc.getLanguage()).toBe('ru');
    expect(loc.t('hud.shop')).toBe('Магазин');
  });

  it('replaces parameters in both languages', () => {
    const loc = new LocalizationService('ru');
    expect(loc.t('common.level', { n: 3 })).toBe('Ур. 3');
    loc.setLanguage('en');
    expect(loc.t('common.level', { n: 3 })).toBe('Lv. 3');
  });

  it('returns the key for unknown translations', () => {
    const loc = new LocalizationService('en');
    expect(loc.t('missing.key')).toBe('missing.key');
  });
});
