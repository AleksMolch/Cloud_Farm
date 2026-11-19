import type { GameData, TutorialStepConfig } from '../types/ConfigTypes';
import type { GameState } from '../types/GameState';
import type { EconomyService } from './EconomyService';
import type { EventBus } from './EventBus';

export class TutorialService {
  constructor(
    private readonly state: GameState,
    private readonly data: GameData,
    private readonly economy: EconomyService,
    private readonly bus: EventBus,
  ) {
    bus.on('crop:collected', ({ objectId }) => this.handleCollect(objectId));
    bus.on('order:completed', () => this.handleOrderCompleted());
    bus.on('object:upgraded', ({ objectId }) => this.handleUpgrade(objectId));
    this.emitChange();
  }

  getCurrentStep(): TutorialStepConfig | null {
    return (
      this.data.tutorial.find(
        (step) => !this.state.completedTutorialSteps.includes(step.id),
      ) ?? null
    );
  }

  private handleCollect(objectId: string): void {
    const step = this.getCurrentStep();
    if (!step || step.goal.type !== 'collect') return;
    if (step.goal.objectId && step.goal.objectId !== objectId) return;
    this.complete(step);
  }

  private handleOrderCompleted(): void {
    const step = this.getCurrentStep();
    if (!step || step.goal.type !== 'order_completed') return;
    this.complete(step);
  }

  private handleUpgrade(objectId: string): void {
    const step = this.getCurrentStep();
    if (!step || step.goal.type !== 'upgrade') return;
    if (step.goal.objectId && step.goal.objectId !== objectId) return;
    this.complete(step);
  }

  private complete(step: TutorialStepConfig): void {
    if (this.state.completedTutorialSteps.includes(step.id)) return;
    this.state.completedTutorialSteps.push(step.id);

    const reward = step.reward ?? [];
    if (reward.length > 0) {
      this.economy.grant(reward);
    }

    this.bus.emit('tutorial:step_completed', { stepId: step.id, reward });
    this.emitChange();
  }

  private emitChange(): void {
    this.bus.emit('tutorial:changed', {
      stepId: this.getCurrentStep()?.id ?? null,
    });
  }
}
