import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/data/createInitialState';
import { loadGameData } from '../src/game/data/loadGameData';
import { EventBus } from '../src/game/systems/EventBus';
import { StoryService } from '../src/game/systems/StoryService';

const NOW = 1_700_000_000_000;

function setup() {
  const data = loadGameData();
  const state = createInitialState(data, NOW);
  const bus = new EventBus();
  const story = new StoryService(state, data, bus);
  return { data, state, bus, story };
}

function emitOrder(bus: EventBus): void {
  bus.emit('order:completed', {
    instanceId: 1,
    templateId: 'order_wheat_2',
    reward: [{ id: 'coin', amount: 20 }],
  });
}

describe('StoryService', () => {
  it('completes the first order beat and emits a mail event', () => {
    const { state, bus, story } = setup();
    const listener = vi.fn();
    bus.on('story:beat', listener);

    emitOrder(bus);

    expect(state.story.completedBeats).toEqual(['first_order']);
    expect(state.story.unreadBeats).toEqual(['first_order']);
    expect(story.getUnreadCount()).toBe(1);
    expect(listener).toHaveBeenCalledWith({
      beatId: 'first_order',
      speakerKey: 'story.speaker.keeper',
      textKey: 'story.first_order',
    });
  });

  it('does not repeat a completed beat', () => {
    const { state, bus } = setup();
    emitOrder(bus);
    emitOrder(bus);
    expect(state.story.completedBeats).toEqual(['first_order']);
  });

  it('unlocks the full first-session story chain', () => {
    const { state, bus } = setup();

    emitOrder(bus);
    bus.emit('object:upgraded', {
      objectId: 'plot_wheat',
      level: 2,
      cost: [{ id: 'coin', amount: 20 }],
    });
    bus.emit('object:unlocked', {
      objectId: 'plot_carrot',
      cost: [{ id: 'coin', amount: 20 }],
    });
    bus.emit('zone:unlocked', {
      zoneId: 'terrace',
      cost: [{ id: 'coin', amount: 80 }],
    });
    bus.emit('object:unlocked', {
      objectId: 'chicken',
      cost: [{ id: 'coin', amount: 100 }],
    });

    expect(state.story.completedBeats).toEqual([
      'first_order',
      'first_upgrade',
      'carrot_unlocked',
      'first_zone',
      'first_animal',
    ]);
    expect(state.story.unreadBeats).toHaveLength(5);
  });

  it('marks letters as read', () => {
    const { state, bus, story } = setup();
    emitOrder(bus);
    const listener = vi.fn();
    bus.on('story:changed', listener);

    story.markMailRead();

    expect(state.story.unreadBeats).toEqual([]);
    expect(story.getUnreadCount()).toBe(0);
    expect(listener).toHaveBeenCalledWith({ completed: 1, unread: 0 });
  });

  it('returns completed beats in story order', () => {
    const { bus, story } = setup();
    emitOrder(bus);
    bus.emit('object:upgraded', {
      objectId: 'plot_wheat',
      level: 2,
      cost: [],
    });

    expect(story.getCompletedBeats().map((beat) => beat.id)).toEqual([
      'first_order',
      'first_upgrade',
    ]);
  });
});
