import type { GameData } from '../types/ConfigTypes';
import type {
  GameState,
  OfflineReport,
  ResourceAmount,
  SupportedLanguage,
} from '../types/GameState';
import type { PlatformAdapter } from '../types/PlatformTypes';
import { AdManager } from './AdManager';
import { AudioService } from './AudioService';
import { EconomyService } from './EconomyService';
import { EventBus } from './EventBus';
import { GameplayLifecycle } from './GameplayLifecycle';
import { LocalizationService } from './LocalizationService';
import { OfflineProgressService } from './OfflineProgressService';
import { OrderService } from './OrderService';
import { ProductionService } from './ProductionService';
import { SaveScheduler, SaveService } from './SaveService';
import { TimeService } from './TimeService';
import { TutorialService } from './TutorialService';
import { UnlockService } from './UnlockService';
import { UpgradeService } from './UpgradeService';

export interface GameContextOptions {
  platform: PlatformAdapter;
  state: GameState;
  data: GameData;
  time?: TimeService;
  localization?: LocalizationService;
  audio?: AudioService;
}

export class GameContext {
  readonly data: GameData;
  readonly state: GameState;
  readonly platform: PlatformAdapter;
  readonly time: TimeService;
  readonly bus: EventBus;
  readonly localization: LocalizationService;
  readonly audio: AudioService;
  readonly economy: EconomyService;
  readonly production: ProductionService;
  readonly upgrades: UpgradeService;
  readonly unlocks: UnlockService;
  readonly orders: OrderService;
  readonly offline: OfflineProgressService;
  readonly tutorial: TutorialService;
  readonly saveService: SaveService;
  readonly saveScheduler: SaveScheduler;
  readonly ads: AdManager;
  readonly lifecycle: GameplayLifecycle;

  pendingOffline: OfflineReport | null;

  constructor(options: GameContextOptions) {
    this.data = options.data;
    this.state = options.state;
    this.platform = options.platform;
    this.time = options.time ?? new TimeService();
    this.bus = new EventBus();
    this.localization =
      options.localization ??
      new LocalizationService(this.platform.getLanguage(), this.state.settings.language);
    this.audio = options.audio ?? new AudioService(this.state, this.platform);
    this.lifecycle = new GameplayLifecycle(this.platform);

    this.economy = new EconomyService(this.state, this.bus);
    this.production = new ProductionService(
      this.state,
      this.data,
      this.economy,
      this.bus,
    );
    this.upgrades = new UpgradeService(
      this.state,
      this.data,
      this.economy,
      this.bus,
    );
    this.unlocks = new UnlockService(
      this.state,
      this.data,
      this.economy,
      this.production,
      this.bus,
      this.time,
    );
    this.orders = new OrderService(this.state, this.data, this.economy, this.bus);
    this.offline = new OfflineProgressService(this.data);
    this.tutorial = new TutorialService(
      this.state,
      this.data,
      this.economy,
      this.bus,
    );
    this.saveService = new SaveService(this.platform, this.data, this.time);
    this.saveScheduler = new SaveScheduler(
      this.saveService,
      this.state,
      this.bus,
    );
    this.ads = new AdManager(
      this.platform,
      this.state,
      this.bus,
      this.time,
      this.lifecycle,
    );

    const savedPending = this.state.pendingOffline;
    if (savedPending && savedPending.gains.length > 0) {
      this.pendingOffline = savedPending;
    } else {
      const report = this.offline.compute(this.state, this.time.now());
      this.pendingOffline = report.gains.length > 0 ? report : null;
      this.state.pendingOffline = this.pendingOffline;
    }

    this.wireEvents();
  }

  start(): void {
    this.orders.ensureOrders(this.time.now());
    this.saveScheduler.start();
  }

  tick(now: number = this.time.now()): void {
    this.production.tickAutoCollect(now);
    this.orders.ensureOrders(now);
  }

  requestSave(): void {
    this.bus.emit('game:save-requested');
  }

  async claimOffline(multiplier: number): Promise<ResourceAmount[]> {
    if (!this.pendingOffline) return [];
    const report = this.pendingOffline;
    const snapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    const claimed = this.offline.claim(this.economy, report, multiplier);
    this.state.stats.totalCollected += claimed.reduce(
      (sum, amount) => sum + amount.amount,
      0,
    );
    this.pendingOffline = null;
    this.state.pendingOffline = null;
    this.production.rebaseOffline(this.time.now());

    try {
      await this.saveService.save(this.state);
    } catch (error) {
      Object.assign(this.state, snapshot);
      this.pendingOffline = report;
      throw error;
    }

    this.bus.emit('offline:claimed', { multiplier, gains: claimed });
    return claimed;
  }

  setLanguage(language: SupportedLanguage): void {
    this.state.settings.language = language;
    this.localization.setLanguage(language);
    this.bus.emit('settings:changed');
  }

  setMusic(enabled: boolean): void {
    this.state.settings.music = enabled;
    this.audio.applySettings();
    this.bus.emit('settings:changed');
  }

  setSfx(enabled: boolean): void {
    this.state.settings.sfx = enabled;
    this.bus.emit('settings:changed');
  }

  async resetProgress(): Promise<void> {
    await this.saveService.reset();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  dispose(): void {
    this.saveScheduler.dispose();
  }

  private wireEvents(): void {
    const requestSave = (): void => this.requestSave();
    this.bus.on('object:upgraded', requestSave);
    this.bus.on('object:unlocked', requestSave);
    this.bus.on('zone:unlocked', requestSave);
    this.bus.on('helper:unlocked', requestSave);
    this.bus.on('order:completed', requestSave);
    this.bus.on('tutorial:step_completed', requestSave);
    this.bus.on('settings:changed', requestSave);

    this.bus.on('crop:collected', requestSave);
    this.bus.on('animal:collected', requestSave);
    this.bus.on('building:collected', requestSave);
    this.bus.on('building:started', requestSave);

    this.bus.on('crop:collected', () => this.audio.sfx('collect'));
    this.bus.on('animal:collected', () => this.audio.sfx('collect'));
    this.bus.on('building:collected', () => this.audio.sfx('collect'));
    this.bus.on('object:upgraded', () => this.audio.sfx('upgrade'));
    this.bus.on('order:completed', () => this.audio.sfx('success'));
    this.bus.on('object:unlocked', () => this.audio.sfx('purchase'));
    this.bus.on('zone:unlocked', () => this.audio.sfx('purchase'));
    this.bus.on('helper:unlocked', () => this.audio.sfx('purchase'));
    this.bus.on('tutorial:step_completed', () => this.audio.sfx('success'));
    this.bus.on('ad:started', () => this.audio.pause());
    this.bus.on('ad:finished', () => this.audio.resume());

    this.platform.onAudioChanged((enabled) => {
      this.audio.setPlatformAudio(enabled);
    });

    this.platform.onPauseChanged((paused) => {
      this.bus.emit('game:paused', { paused });
      if (paused) {
        this.audio.pause();
        this.lifecycle.pause('platform');
      } else {
        this.audio.resume();
        this.lifecycle.resume('platform');
      }
    });
  }
}
