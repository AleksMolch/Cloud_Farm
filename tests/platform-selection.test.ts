import { describe, expect, it } from 'vitest';
import { choosePlatformKind } from '../src/game/platform/createPlatform';

describe('choosePlatformKind', () => {
  it('prioritizes Playgama Bridge over native Yandex when Bridge is present', () => {
    expect(choosePlatformKind(null, true, true)).toBe('playgama');
  });

  it('uses native Yandex only without Bridge or when explicitly forced', () => {
    expect(choosePlatformKind(null, false, true)).toBe('yandex');
    expect(choosePlatformKind('yandex', true, true)).toBe('yandex');
  });

  it('supports explicit mock/playgama and local fallback', () => {
    expect(choosePlatformKind('mock', true, true)).toBe('mock');
    expect(choosePlatformKind('playgama', false, false)).toBe('playgama');
    expect(choosePlatformKind(null, false, false)).toBe('mock');
  });
});
