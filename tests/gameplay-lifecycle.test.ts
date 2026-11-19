import { describe, expect, it } from 'vitest';
import { GameplayLifecycle } from '../src/game/systems/GameplayLifecycle';
import { FakePlatform } from './fakePlatform';

describe('GameplayLifecycle', () => {
  it('starts only once and stacks pause reasons', () => {
    const platform = new FakePlatform();
    const lifecycle = new GameplayLifecycle(platform);

    lifecycle.start();
    lifecycle.start();
    expect(platform.gameplayStarts).toBe(1);

    lifecycle.pause('modal');
    lifecycle.pause('modal');
    lifecycle.pause('ad');
    expect(platform.gameplayStops).toBe(1);

    lifecycle.resume('ad');
    lifecycle.resume('modal');
    expect(platform.gameplayStarts).toBe(2);

    lifecycle.resume('modal');
    expect(platform.gameplayStarts).toBe(2);
  });

  it('does not start gameplay while a pause reason remains', () => {
    const platform = new FakePlatform();
    const lifecycle = new GameplayLifecycle(platform);

    lifecycle.pause('platform');
    lifecycle.start();
    expect(platform.gameplayStarts).toBe(0);

    lifecycle.resume('platform');
    expect(platform.gameplayStarts).toBe(1);
  });
});
