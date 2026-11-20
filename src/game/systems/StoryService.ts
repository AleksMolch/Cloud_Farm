import type { GameData, StoryBeatConfig, StoryTrigger } from '../types/ConfigTypes';
import type { GameState } from '../types/GameState';
import type { EventBus } from './EventBus';

export class StoryService {
  constructor(
    private readonly state: GameState,
    private readonly data: GameData,
    private readonly bus: EventBus,
  ) {
    this.subscribe();
  }

  getCompletedBeats(): StoryBeatConfig[] {
    return this.state.story.completedBeats
      .map((id) => this.data.story.find((beat) => beat.id === id))
      .filter((beat): beat is StoryBeatConfig => Boolean(beat));
  }

  getUnreadCount(): number {
    return this.state.story.unreadBeats.length;
  }

  markMailRead(): void {
    if (this.state.story.unreadBeats.length === 0) return;
    this.state.story.unreadBeats = [];
    this.emitChanged();
  }

  private subscribe(): void {
    this.bus.on('order:completed', () => {
      this.trigger({ type: 'order_completed' });
    });
    this.bus.on('object:upgraded', ({ objectId }) => {
      this.trigger({ type: 'object_upgraded', objectId });
    });
    this.bus.on('object:unlocked', ({ objectId }) => {
      this.trigger({ type: 'object_unlocked', objectId });
      const config = this.data.objects[objectId];
      if (config?.kind === 'animal') {
        this.trigger({ type: 'animal_unlocked' });
      }
    });
    this.bus.on('zone:unlocked', () => {
      this.trigger({ type: 'zone_unlocked' });
    });
  }

  private trigger(trigger: StoryTrigger): void {
    const beat = this.data.story.find(
      (candidate) =>
        !this.state.story.completedBeats.includes(candidate.id) &&
        this.matches(candidate, trigger),
    );
    if (!beat) return;
    this.complete(beat);
  }

  private matches(beat: StoryBeatConfig, trigger: StoryTrigger): boolean {
    const expected = beat.trigger;
    if (expected.type !== trigger.type) return false;
    if (
      expected.type === 'object_unlocked' ||
      expected.type === 'object_upgraded'
    ) {
      const actual = trigger as {
        type: 'object_unlocked' | 'object_upgraded';
        objectId?: string;
      };
      return !expected.objectId || expected.objectId === actual.objectId;
    }
    return true;
  }

  private complete(beat: StoryBeatConfig): void {
    if (this.state.story.completedBeats.includes(beat.id)) return;
    this.state.story.completedBeats.push(beat.id);
    this.state.story.unreadBeats.push(beat.id);
    this.bus.emit('story:beat', {
      beatId: beat.id,
      speakerKey: beat.speakerKey,
      textKey: beat.textKey,
    });
    this.emitChanged();
  }

  private emitChanged(): void {
    this.bus.emit('story:changed', {
      completed: this.state.story.completedBeats.length,
      unread: this.state.story.unreadBeats.length,
    });
  }
}
