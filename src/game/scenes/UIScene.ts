import Phaser from 'phaser';
import type { GameContext } from '../systems/GameContext';
import type { FarmObjectConfig } from '../types/ConfigTypes';
import { RESOURCE_IDS } from '../types/GameState';
import type { ResourceAmount } from '../types/GameState';
import type { GameEventMap } from '../systems/EventBus';
import { Button } from '../ui/Button';
import { ModalPanel } from '../ui/Modal';
import {
  COLORS,
  FONT_FAMILY,
  GAME_WIDTH,
  TEXT,
  formatCost,
  formatAmounts,
  formatClock,
  formatDuration,
  formatNumber,
  iconForResource,
} from '../ui/theme';

type ModalKind = 'orders' | 'shop' | 'object' | 'settings' | 'offline' | 'storage';

interface GoalInfo {
  text: string;
  progress: number;
}

interface ShopItem {
  kind: 'zone' | 'object' | 'helper';
  id: string;
  name: string;
  icon: string;
  cost: ResourceAmount[];
  description?: string;
  canAct: boolean;
}

const SHOP_PAGE_SIZE = 6;
const ZONE_ICONS: Record<string, string> = {
  terrace: 'crop_strawberry',
  yard: 'animal_chicken',
  mill: 'building_mill',
  meadow: 'icon_star',
};

export class UIScene extends Phaser.Scene {
  private ctx!: GameContext;
  private hud!: Phaser.GameObjects.Container;
  private hintContainer!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private crystalText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;
  private questProgress!: Phaser.GameObjects.Graphics;
  private ordersButton!: Button;
  private shopButton!: Button;
  private settingsButton!: Button;

  private modal: ModalPanel | null = null;
  private modalKind: ModalKind | null = null;
  private selectedObjectId: string | null = null;
  private modalDirty = false;
  private modalAccumulator = 0;
  private shopPage = 0;
  private resetArmed = false;
  private adBusy = false;
  private toast: Phaser.GameObjects.Container | null = null;
  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.ctx = this.registry.get('ctx') as GameContext;
    this.buildHud();
    this.buildHint();
    this.bindEvents();
    this.updateHud();
    this.updateTutorialUi();

    this.input.on('pointerdown', () => this.ctx.audio.unlock());

    this.time.delayedCall(320, () => {
      if (this.ctx.pendingOffline) {
        this.openModal('offline');
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) unsubscribe();
      this.unsubscribers.length = 0;
    });
  }

  update(_time: number, delta: number): void {
    if (!this.modal) {
      this.modalAccumulator = 0;
      return;
    }
    this.modalAccumulator += delta;
    const pointerDown = this.input.activePointer.isDown;
    if (
      this.modalDirty ||
      (this.modalAccumulator >= 1000 && !pointerDown)
    ) {
      this.modalDirty = false;
      this.modalAccumulator = 0;
      this.renderModal();
    }
  }

  private buildHud(): void {
    this.hud = this.add.container(0, 0).setDepth(100);

    const coinChip = this.createResourceChip(20, 14, 'icon_coin', TEXT.coin);
    this.coinText = coinChip.text;
    const crystalChip = this.createResourceChip(212, 14, 'icon_crystal', '#1f9fd0');
    this.crystalText = crystalChip.text;
    this.hud.add([coinChip.container, crystalChip.container]);

    this.ordersButton = this.createHudButton(790, 44, 160, 'hud.orders', 'icon_orders', COLORS.accent, () =>
      this.openModal('orders'),
    );
    this.shopButton = this.createHudButton(958, 44, 160, 'hud.shop', 'icon_shop', COLORS.green, () =>
      this.openModal('shop'),
    );
    this.settingsButton = this.createHudButton(1170, 44, 76, null, 'icon_gear', COLORS.inkSoft, () =>
      this.openModal('settings'),
    );
    this.createHudButton(600, 44, 140, 'hud.storage', 'icon_basket', 0x4b9fd0, () =>
      this.openModal('storage'),
    );

    const questBackground = this.add.graphics();
    questBackground.fillStyle(0xfff8ec, 0.94);
    questBackground.fillRoundedRect(0, 0, 400, 60, 22);
    questBackground.lineStyle(3, COLORS.green, 0.7);
    questBackground.strokeRoundedRect(0, 0, 400, 60, 22);

    const questIcon = this.add.image(30, 30, 'icon_star').setDisplaySize(34, 34);
    this.questText = this.add
      .text(54, 8, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT.ink,
        wordWrap: { width: 330 },
      })
      .setOrigin(0, 0);
    this.questProgress = this.add.graphics();

    const questChip = this.add.container(20, 84);
    questChip.add([
      questBackground,
      questIcon,
      this.questText,
      this.questProgress,
    ]);
    this.hud.add(questChip);
  }

  private buildHint(): void {
    this.hintContainer = this.add
      .container(GAME_WIDTH / 2, 668)
      .setDepth(300)
      .setVisible(false);
    const background = this.add.graphics();
    background.fillStyle(COLORS.inkDark, 0.88);
    background.fillRoundedRect(-450, -29, 900, 58, 24);
    background.lineStyle(3, COLORS.accent, 0.8);
    background.strokeRoundedRect(-450, -29, 900, 58, 24);
    const star = this.add.image(-416, 0, 'icon_star').setDisplaySize(30, 30);
    this.hintText = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT.white,
        align: 'center',
        wordWrap: { width: 790 },
      })
      .setOrigin(0.5);
    this.hintContainer.add([background, star, this.hintText]);
  }

  private createResourceChip(
    x: number,
    y: number,
    icon: string,
    color: string,
  ): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
    const container = this.add.container(x, y);
    const background = this.add.graphics();
    background.fillStyle(0x183448, 0.18);
    background.fillRoundedRect(0, 5, 180, 58, 22);
    background.fillStyle(0xfff8ec, 0.96);
    background.fillRoundedRect(0, 0, 180, 58, 22);
    background.lineStyle(3, COLORS.panelStroke, 0.7);
    background.strokeRoundedRect(0, 0, 180, 58, 22);
    const iconImage = this.add.image(30, 29, icon).setDisplaySize(38, 38);
    const text = this.add
      .text(56, 29, '0', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0, 0.5);
    container.add([background, iconImage, text]);
    return { container, text };
  }

  private createHudButton(
    x: number,
    y: number,
    width: number,
    labelKey: string | null,
    icon: string,
    fill: number,
    onClick: () => void,
  ): Button {
    const button = new Button(this, x, y, {
      width,
      height: 58,
      label: labelKey ? this.ctx.localization.t(labelKey) : '',
      icon,
      fontSize: 18,
      fill,
      stroke: COLORS.ink,
      onClick,
    });
    this.hud.add(button);
    return button;
  }

  private rebuildHud(): void {
    this.hud.destroy(true);
    this.buildHud();
    this.updateHud();
    this.updateTutorialUi();
  }

  private updateHud(): void {
    if (!this.coinText) return;
    const loc = this.ctx.localization;
    this.coinText.setText(formatNumber(this.ctx.economy.get('coin')));
    this.crystalText.setText(formatNumber(this.ctx.economy.get('crystal')));

    const affordableOrders = this.ctx.state.orders.filter((order) =>
      this.ctx.economy.canAfford(order.requires),
    ).length;
    this.ordersButton.setLabel(
      `${loc.t('hud.orders')}${affordableOrders > 0 ? ` · ${affordableOrders}` : ''}`,
    );
    this.shopButton.setLabel(
      this.hasAffordableShopItem()
        ? `${loc.t('hud.shop')} ●`
        : loc.t('hud.shop'),
    );

    const goal = this.computeGoal();
    this.questText.setText(goal.text);
    this.questProgress.clear();
    this.questProgress.fillStyle(COLORS.inkDark, 0.15);
    this.questProgress.fillRoundedRect(54, 48, 320, 6, 3);
    this.questProgress.fillStyle(COLORS.green, 1);
    this.questProgress.fillRoundedRect(
      54,
      48,
      Math.max(4, 320 * Math.min(1, Math.max(0, goal.progress))),
      6,
      3,
    );
  }

  private computeGoal(): GoalInfo {
    const { data, state, localization: loc } = this.ctx;
    const sequence: Array<{ kind: 'zone' | 'object' | 'helper'; id: string }> = [
      { kind: 'object', id: 'plot_carrot' },
      { kind: 'zone', id: 'terrace' },
      { kind: 'object', id: 'plot_strawberry' },
      { kind: 'zone', id: 'yard' },
      { kind: 'object', id: 'chicken' },
      { kind: 'zone', id: 'mill' },
      { kind: 'object', id: 'mill' },
      { kind: 'object', id: 'cow' },
      { kind: 'object', id: 'bakery' },
      { kind: 'helper', id: 'cat' },
      { kind: 'object', id: 'plot_cloudberry' },
      { kind: 'object', id: 'sheep' },
      { kind: 'object', id: 'dairy' },
      { kind: 'helper', id: 'dog' },
    ];

    for (const entry of sequence) {
      if (entry.kind === 'zone') {
        const zone = data.zoneById[entry.id];
        if (!zone || state.zones[zone.id]?.unlocked) continue;
        const cost = zone.unlockCost[0];
        const progress = this.progressForCost(zone.unlockCost);
        return {
          text: loc.t('goal.unlock_object', {
            name: loc.t(zone.nameKey),
            amount: cost?.amount ?? 0,
            currency: cost ? loc.t(`currency.${cost.id}`) : '',
          }),
          progress,
        };
      }
      if (entry.kind === 'object') {
        const object = data.objects[entry.id];
        if (!object || state.objects[object.id]?.unlocked) continue;
        if (!state.zones[object.zoneId]?.unlocked) continue;
        const cost = object.unlockCost[0];
        return {
          text: loc.t('goal.unlock_object', {
            name: loc.t(object.nameKey),
            amount: cost?.amount ?? 0,
            currency: cost ? loc.t(`currency.${cost.id}`) : '',
          }),
          progress: this.progressForCost(object.unlockCost),
        };
      }
      const helper = data.helperById[entry.id];
      if (!helper || state.helpers[helper.id]) continue;
      const cost = helper.cost[0];
      return {
        text: loc.t('goal.hire_helper', {
          name: loc.t(helper.nameKey),
          amount: cost?.amount ?? 0,
          currency: cost ? loc.t(`currency.${cost.id}`) : '',
        }),
        progress: this.progressForCost(helper.cost),
      };
    }

    return { text: loc.t('goal.done'), progress: 1 };
  }

  private progressForCost(cost: ResourceAmount[]): number {
    const first = cost[0];
    if (!first) return 1;
    return this.ctx.economy.get(first.id) / Math.max(1, first.amount);
  }

  private hasAffordableShopItem(): boolean {
    return this.getShopItems().some((item) => item.canAct);
  }

  private updateTutorialUi(): void {
    const step = this.ctx.tutorial.getCurrentStep();
    this.ordersButton?.setHighlighted(step?.highlight?.id === 'orders');
    this.shopButton?.setHighlighted(step?.highlight?.id === 'shop');
    this.settingsButton?.setHighlighted(step?.highlight?.id === 'settings');

    if (!step) {
      this.hintContainer.setVisible(false);
      return;
    }
    this.hintText.setText(this.ctx.localization.t(step.textKey));
    this.hintContainer.setVisible(true);
  }

  private bindEvents(): void {
    this.subscribe('resources:changed', () => {
      this.updateHud();
      this.modalDirty = true;
    });
    this.subscribe('orders:changed', () => {
      this.updateHud();
      this.modalDirty = true;
    });
    this.subscribe('object:changed', () => {
      this.modalDirty = true;
    });
    this.subscribe('object:upgraded', () => {
      this.modalDirty = true;
    });
    this.subscribe('object:unlocked', () => {
      this.modalDirty = true;
    });
    this.subscribe('zone:unlocked', () => {
      this.modalDirty = true;
      this.updateHud();
    });
    this.subscribe('helper:unlocked', () => {
      this.modalDirty = true;
      this.updateHud();
    });
    this.subscribe('order:completed', () => {
      this.showToastKey('toast.order_completed');
      this.updateHud();
      this.modalDirty = true;
    });
    this.subscribe('tutorial:changed', () => {
      this.updateTutorialUi();
    });
    this.subscribe('tutorial:step_completed', ({ reward }) => {
      const coins = reward.find((amount) => amount.id === 'coin')?.amount ?? 0;
      const crystals =
        reward.find((amount) => amount.id === 'crystal')?.amount ?? 0;
      if (coins > 0 || crystals > 0) {
        this.showToastKey('toast.tutorial_reward', {
          n: coins,
          m: crystals,
        });
      }
      this.updateHud();
    });
    this.subscribe('settings:changed', () => {
      this.rebuildHud();
      this.modalDirty = true;
    });
    this.subscribe('toast', ({ key, params }) => {
      this.showToastKey(key, params);
    });
    this.subscribe('ui:open-panel', ({ panel, objectId }) => {
      this.openModal(panel, objectId);
    });
  }

  private subscribe<K extends keyof GameEventMap>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void {
    this.unsubscribers.push(this.ctx.bus.on(event, handler));
  }

  private showToastKey(
    key: string,
    params?: Record<string, string | number>,
  ): void {
    const error =
      key.startsWith('toast.not_enough') ||
      key.startsWith('toast.locked') ||
      key === 'ad.failed' ||
      key === 'ad.not_supported' ||
      key === 'offline.rewarded_fail';
    this.showToast(
      this.ctx.localization.t(key, params),
      error ? COLORS.red : COLORS.greenDark,
    );
  }

  private showToast(text: string, color: number): void {
    this.toast?.destroy(true);
    const baseY = this.modal ? 690 : 604;
    const container = this.add.container(GAME_WIDTH / 2, baseY + 20).setDepth(1100);
    const label = this.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT.white,
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5);
    const width = Math.max(220, label.width + 48);
    const background = this.add.graphics();
    background.fillStyle(color, 0.96);
    background.fillRoundedRect(-width / 2, -27, width, 54, 22);
    background.lineStyle(3, 0xffffff, 0.35);
    background.strokeRoundedRect(-width / 2, -27, width, 54, 22);
    container.add([background, label]);
    this.toast = container;

    container.setAlpha(0).setY(baseY + 20);
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: baseY,
      duration: 180,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(2300, () => {
      if (this.toast !== container) return;
      this.tweens.add({
        targets: container,
        alpha: 0,
        y: baseY - 20,
        duration: 220,
        onComplete: () => {
          if (this.toast === container) this.toast = null;
          container.destroy(true);
        },
      });
    });
  }

  private openModal(kind: ModalKind, objectId?: string): void {
    this.modal?.destroy();
    this.modalKind = kind;
    this.selectedObjectId = objectId ?? null;
    this.resetArmed = false;

    const sizes: Record<ModalKind, { width: number; height: number; title: string }> = {
      orders: {
        width: 790,
        height: 570,
        title: this.ctx.localization.t('orders.title'),
      },
      shop: {
        width: 1060,
        height: 600,
        title: this.ctx.localization.t('shop.title'),
      },
      object: {
        width: 640,
        height: 570,
        title: this.ctx.localization.t('object.title'),
      },
      settings: {
        width: 620,
        height: 540,
        title: this.ctx.localization.t('settings.title'),
      },
      offline: {
        width: 640,
        height: 540,
        title: this.ctx.localization.t('offline.title'),
      },
      storage: {
        width: 700,
        height: 520,
        title: this.ctx.localization.t('storage.title'),
      },
    };
    const size = sizes[kind];
    if (kind === 'shop') this.shopPage = 0;
    this.modal = new ModalPanel(this, size.width, size.height, size.title, {
      closable: kind !== 'offline',
      closeOnOverlay: kind !== 'offline',
      onClose: () => {
        this.modal = null;
        this.modalKind = null;
        this.selectedObjectId = null;
      },
    });
    this.renderModal();
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    this.modalKind = null;
    this.selectedObjectId = null;
  }

  private renderModal(): void {
    if (!this.modal || !this.modalKind) return;
    const titles: Record<ModalKind, string> = {
      orders: this.ctx.localization.t('orders.title'),
      shop: this.ctx.localization.t('shop.title'),
      object: this.ctx.localization.t('object.title'),
      settings: this.ctx.localization.t('settings.title'),
      offline: this.ctx.localization.t('offline.title'),
      storage: this.ctx.localization.t('storage.title'),
    };
    if (this.modalKind !== 'object') {
      this.modal.setTitle(titles[this.modalKind]);
    }
    this.modal.clearBody();
    switch (this.modalKind) {
      case 'orders':
        this.renderOrders();
        break;
      case 'shop':
        this.renderShop();
        break;
      case 'object':
        this.renderObject();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'offline':
        this.renderOffline();
        break;
      case 'storage':
        this.renderStorage();
        break;
    }
  }

  private renderOrders(): void {
    if (!this.modal) return;
    const loc = this.ctx.localization;
    const now = this.ctx.time.now();
    const top = -190;

    const hint = this.add
      .text(0, top - 24, loc.t('orders.refresh'), {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5);
    this.modal.body.add(hint);

    if (this.ctx.state.orders.length === 0) {
      const empty = this.add
        .text(0, 0, loc.t('orders.empty'), {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
          color: TEXT.inkSoft,
        })
        .setOrigin(0.5);
      this.modal.body.add(empty);
      return;
    }

    this.ctx.state.orders.forEach((order, index) => {
      const row = this.add.container(0, top + 66 + index * 128);
      const background = this.add.graphics();
      background.fillStyle(COLORS.panelAlt, 0.75);
      background.fillRoundedRect(-350, -54, 700, 112, 20);
      background.lineStyle(3, COLORS.panelStroke, 0.6);
      background.strokeRoundedRect(-350, -54, 700, 112, 20);

      const requireLabel = this.add
        .text(-322, -44, loc.t('common.requires'), {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: TEXT.inkSoft,
        })
        .setOrigin(0, 0);

      const requirements = this.renderAmounts(
        order.requires,
        -322,
        -16,
        false,
      );

      const rewardLabel = this.add
        .text(-322, 10, loc.t('common.reward'), {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: TEXT.inkSoft,
        })
        .setOrigin(0, 0);
      const rewards = this.renderAmounts(order.reward, -322, 38, true);

      const remaining = Math.max(0, (order.expiresAt - now) / 1000);

      const affordable = this.ctx.economy.canAfford(order.requires);
      const complete = new Button(this, 274, 0, {
        width: 140,
        height: 52,
        label: loc.t('orders.complete'),
        fontSize: 17,
        fill: affordable ? COLORS.green : COLORS.inkSoft,
        stroke: COLORS.ink,
        disabled: !affordable,
        onClick: () => this.completeOrder(order.instanceId),
      });

      const timer = this.add
        .text(274, -40, formatClock(remaining), {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          fontStyle: 'bold',
          color: TEXT.inkSoft,
          fixedWidth: 140,
          align: 'center',
        })
        .setOrigin(0.5, 0);

      row.add([
        background,
        requireLabel,
        ...requirements,
        rewardLabel,
        ...rewards,
        timer,
        complete,
      ]);
      this.modal?.body.add(row);
    });
  }

  private renderAmounts(
    amounts: ResourceAmount[],
    startX: number,
    y: number,
    emphasize: boolean,
  ): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    let x = startX;
    for (const amount of amounts) {
      const icon = this.add
        .image(x, y, iconForResource(amount.id))
        .setDisplaySize(28, 28);
      const text = this.add
        .text(x + 18, y, `×${amount.amount}`, {
          fontFamily: FONT_FAMILY,
          fontSize: emphasize ? '18px' : '17px',
          fontStyle: 'bold',
          color: amount.id === 'coin' ? TEXT.coin : TEXT.ink,
          stroke: '#fff8ec',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5);
      objects.push(icon, text);
      x += 70 + Math.max(0, String(amount.amount).length - 1) * 8;
    }
    return objects;
  }

  private completeOrder(instanceId: number): void {
    const result = this.ctx.orders.completeOrder(instanceId, this.ctx.time.now());
    if (!result.success) {
      this.ctx.audio.sfx('error');
      this.showToastKey('toast.not_enough_resources');
      this.modalDirty = true;
      return;
    }
    if (this.ctx.state.stats.ordersCompleted % 5 === 0) {
      void this.ctx.ads.showInterstitial('milestone');
    }
    this.modalDirty = true;
  }

  private getShopItems(): ShopItem[] {
    const { data, state, localization: loc } = this.ctx;
    const items: ShopItem[] = [];

    for (const zone of data.zones) {
      if (state.zones[zone.id]?.unlocked) continue;
      items.push({
        kind: 'zone',
        id: zone.id,
        name: loc.t(zone.nameKey),
        icon: ZONE_ICONS[zone.id] ?? 'icon_star',
        cost: zone.unlockCost,
        canAct: this.ctx.economy.canAfford(zone.unlockCost),
      });
    }

    for (const object of data.objectList) {
      if (state.objects[object.id]?.unlocked) continue;
      if (!state.zones[object.zoneId]?.unlocked) continue;
      items.push({
        kind: 'object',
        id: object.id,
        name: loc.t(object.nameKey),
        icon: object.icon,
        cost: object.unlockCost,
        canAct: this.ctx.unlocks.canUnlockObject(object.id),
      });
    }

    for (const helper of data.helpers) {
      if (state.helpers[helper.id]) continue;
      items.push({
        kind: 'helper',
        id: helper.id,
        name: loc.t(helper.nameKey),
        icon: helper.icon,
        cost: helper.cost,
        description: loc.t(helper.descriptionKey),
        canAct: this.ctx.unlocks.canHireHelper(helper.id),
      });
    }

    return items;
  }

  private renderShop(): void {
    if (!this.modal) return;
    const loc = this.ctx.localization;
    const items = this.getShopItems();
    const pages = Math.max(1, Math.ceil(items.length / SHOP_PAGE_SIZE));
    this.shopPage = Math.min(this.shopPage, pages - 1);

    if (items.length === 0) {
      const empty = this.add
        .text(0, -40, loc.t('shop.all_unlocked'), {
          fontFamily: FONT_FAMILY,
          fontSize: '24px',
          fontStyle: 'bold',
          color: TEXT.ink,
        })
        .setOrigin(0.5);
      this.modal.body.add(empty);
      return;
    }

    const pageItems = items.slice(
      this.shopPage * SHOP_PAGE_SIZE,
      this.shopPage * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE,
    );

    pageItems.forEach((item, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const card = this.createShopCard(
        item,
        -330 + column * 330,
        -130 + row * 184,
      );
      this.modal?.body.add(card);
    });

    if (pages > 1) {
      const pageLabel = this.add
        .text(0, 222, loc.t('shop.page', { page: this.shopPage + 1, pages }), {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          color: TEXT.inkSoft,
        })
        .setOrigin(0.5);
      const prev = new Button(this, -560, 212, {
        width: 64,
        height: 48,
        label: '‹',
        fontSize: 26,
        fill: COLORS.inkSoft,
        disabled: this.shopPage === 0,
        onClick: () => {
          this.shopPage = Math.max(0, this.shopPage - 1);
          this.renderModal();
        },
      });
      const next = new Button(this, 560, 212, {
        width: 64,
        height: 48,
        label: '›',
        fontSize: 26,
        fill: COLORS.accent,
        disabled: this.shopPage >= pages - 1,
        onClick: () => {
          this.shopPage = Math.min(pages - 1, this.shopPage + 1);
          this.renderModal();
        },
      });
      this.modal.body.add([pageLabel, prev, next]);
    }
  }

  private createShopCard(
    item: ShopItem,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const loc = this.ctx.localization;
    const card = this.add.container(x, y);
    const background = this.add.graphics();
    background.fillStyle(0xfff3da, 0.9);
    background.fillRoundedRect(-150, -88, 300, 176, 22);
    background.lineStyle(3, COLORS.panelStroke, 0.65);
    background.strokeRoundedRect(-150, -88, 300, 176, 22);

    const icon = this.add.image(0, -54, item.icon).setDisplaySize(50, 50);
    const name = this.add
      .text(0, -14, item.name, {
        fontFamily: FONT_FAMILY,
        fontSize: item.name.length > 16 ? '15px' : '17px',
        fontStyle: 'bold',
        color: TEXT.ink,
        align: 'center',
        fixedWidth: 270,
        wordWrap: { width: 260 },
      })
      .setOrigin(0.5);

    const costText = this.add
      .text(0, item.description ? 40 : 28, formatCost(item.cost, loc), {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        fontStyle: 'bold',
        color: item.canAct ? TEXT.green : TEXT.inkSoft,
      })
      .setOrigin(0.5);

    const actionLabel =
      item.kind === 'zone'
        ? loc.t('shop.unlock_zone')
        : item.kind === 'helper'
          ? loc.t('common.hire')
          : loc.t('common.buy');
    const button = new Button(this, 0, 64, {
      width: 160,
      height: 44,
      label: actionLabel,
      fontSize: 15,
      fill: item.canAct ? COLORS.green : COLORS.inkSoft,
      disabled: !item.canAct,
      onClick: () => this.actOnShopItem(item),
    });

    card.add([background, icon, name, costText, button]);
    if (item.description) {
      card.add(
        this.add
          .text(0, 12, item.description, {
            fontFamily: FONT_FAMILY,
            fontSize: '11px',
            color: TEXT.inkSoft,
            align: 'center',
            fixedWidth: 260,
            wordWrap: { width: 260 },
          })
          .setOrigin(0.5),
      );
    }
    return card;
  }

  private actOnShopItem(item: ShopItem): void {
    const loc = this.ctx.localization;
    let success = false;
    if (item.kind === 'zone') {
      success = this.ctx.unlocks.unlockZone(item.id);
      if (success) {
        const zone = this.ctx.data.zoneById[item.id];
        this.showToastKey('toast.zone_unlocked', {
          name: zone ? loc.t(zone.nameKey) : item.name,
        });
        void this.ctx.ads.showInterstitial('zone_unlocked');
      }
    } else if (item.kind === 'object') {
      success = this.ctx.unlocks.unlockObject(item.id);
      if (success) {
        this.showToastKey('toast.unlocked', { name: item.name });
      }
    } else {
      success = this.ctx.unlocks.hireHelper(item.id);
      if (success) {
        this.showToastKey('toast.helper_hired', { name: item.name });
      }
    }

    if (!success) {
      this.ctx.audio.sfx('error');
      const currency = item.cost[0]?.id;
      this.showToastKey(
        currency === 'crystal'
          ? 'toast.not_enough_crystal'
          : 'toast.not_enough_coin',
      );
    }
    this.updateHud();
    this.modalDirty = true;
  }

  private renderObject(): void {
    if (!this.modal || !this.selectedObjectId) return;
    const config = this.ctx.data.objects[this.selectedObjectId];
    const objectState = this.ctx.state.objects[this.selectedObjectId];
    if (!config || !objectState) {
      this.closeModal();
      return;
    }
    const loc = this.ctx.localization;
    this.modal.setTitle(loc.t(config.nameKey));
    const now = this.ctx.time.now();
    const status = this.ctx.production.getStatus(config.id, now);

    const icon = this.add.image(0, -172, config.icon).setDisplaySize(96, 96);
    const name = this.add
      .text(0, -108, loc.t(config.nameKey), {
        fontFamily: FONT_FAMILY,
        fontSize: '26px',
        fontStyle: 'bold',
        color: TEXT.ink,
      })
      .setOrigin(0.5);
    const level = this.add
      .text(0, -74, loc.t('object.level', { n: objectState.level }), {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: 'bold',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5);
    this.modal.body.add([icon, name, level]);

    if (status.kind === 'growing' || status.kind === 'producing') {
      const progress = this.add.graphics();
      progress.fillStyle(COLORS.inkDark, 0.12);
      progress.fillRoundedRect(-150, -44, 300, 14, 7);
      progress.fillStyle(COLORS.green, 1);
      progress.fillRoundedRect(-150, -44, Math.max(10, 300 * status.progress), 14, 7);
      const timer = this.add
        .text(
          0,
          -18,
          loc.t('common.time_left', {
            time: formatDuration(status.remainingSeconds, loc),
          }),
          {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            fontStyle: 'bold',
            color: TEXT.inkSoft,
          },
        )
        .setOrigin(0.5);
      this.modal.body.add([progress, timer]);
    }

    if (config.kind === 'building') {
      this.renderBuildingActions(config, now);
    } else {
      this.renderCropAnimalActions(config, status);
    }

    const upgradeCost = this.ctx.upgrades.getUpgradeCost(config.id);
    const maxLevel = objectState.level >= config.upgrade.maxLevel;
    const upgradeLabel = maxLevel
      ? loc.t('object.max_level')
      : `${loc.t('object.upgrade')} · ${formatCost(upgradeCost, loc)}`;
    const upgradeButton = new Button(this, 0, 96, {
      width: 300,
      height: 50,
      label: upgradeLabel,
      fontSize: 16,
      fill: maxLevel ? COLORS.inkSoft : COLORS.accent,
      disabled: maxLevel || !this.ctx.upgrades.canUpgrade(config.id),
      onClick: () => this.upgradeObject(config.id),
    });
    this.modal.body.add(upgradeButton);

    if (
      (status.kind === 'growing' || status.kind === 'producing') &&
      this.ctx.ads.isRewardedSupported() &&
      !this.adBusy
    ) {
      const speed = new Button(this, 0, 158, {
        width: 300,
        height: 46,
        label: `▶ ${loc.t('object.speed_ad')}`,
        fontSize: 15,
        fill: COLORS.inkSoft,
        onClick: () => void this.speedUp(config.id),
      });
      this.modal.body.add(speed);
      this.modal.body.add(
        this.add
          .text(0, 190, loc.t('object.speed_ad_desc'), {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            color: TEXT.inkSoft,
          })
          .setOrigin(0.5),
      );
    }

    if (config.kind === 'crop' && this.ctx.state.helpers.cat) {
      this.modal.body.add(
        this.add
          .text(0, 206, loc.t('object.autocollect'), {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            fontStyle: 'bold',
            color: TEXT.green,
          })
          .setOrigin(0.5),
      );
    }
    if (config.kind === 'animal' && this.ctx.state.helpers.dog) {
      this.modal.body.add(
        this.add
          .text(0, 206, loc.t('object.dog_bonus'), {
            fontFamily: FONT_FAMILY,
            fontSize: '12px',
            fontStyle: 'bold',
            color: TEXT.green,
          })
          .setOrigin(0.5),
      );
    }
  }

  private renderCropAnimalActions(
    config: FarmObjectConfig,
    status: ReturnType<GameContext['production']['getStatus']>,
  ): void {
    if (!this.modal) return;
    const loc = this.ctx.localization;
    if (status.kind === 'empty') {
      const button = new Button(this, 0, 30, {
        width: 260,
        height: 50,
        label: loc.t('common.plant'),
        fontSize: 19,
        fill: COLORS.green,
        onClick: () => {
          this.ctx.production.plant(config.id, this.ctx.time.now());
          this.modalDirty = true;
        },
      });
      this.modal.body.add(button);
      return;
    }
    if (status.kind === 'ready') {
      const button = new Button(this, 0, 30, {
        width: 260,
        height: 50,
        label: loc.t('common.collect'),
        fontSize: 19,
        fill: COLORS.green,
        onClick: () => {
          this.ctx.production.collect(config.id, this.ctx.time.now());
          this.modalDirty = true;
        },
      });
      this.modal.body.add(button);
    }
  }

  private renderBuildingActions(config: FarmObjectConfig, now: number): void {
    if (!this.modal || config.kind !== 'building') return;
    const loc = this.ctx.localization;
    const recipe = this.ctx.production.getRecipe(config.id, null);
    if (!recipe) {
      this.modal.body.add(
        this.add
          .text(0, 30, loc.t('toast.no_recipe'), {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: TEXT.inkSoft,
          })
          .setOrigin(0.5),
      );
      return;
    }

    const inputText = formatAmounts(recipe.input, loc);
    const output = this.ctx.production.getRecipeOutput(config.id, recipe.id);
    const outputText = formatAmounts(output, loc);
    this.modal.body.add([
      this.add
        .text(0, 4, loc.t('object.inputs', { list: inputText }), {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: TEXT.inkSoft,
        })
        .setOrigin(0.5),
      this.add
        .text(0, 24, loc.t('object.outputs', { list: outputText }), {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          fontStyle: 'bold',
          color: TEXT.green,
        })
        .setOrigin(0.5),
    ]);

    const status = this.ctx.production.getStatus(config.id, now);
    if (status.kind === 'ready') {
      this.modal.body.add(
        new Button(this, 0, 58, {
          width: 260,
          height: 48,
          label: loc.t('common.collect'),
          fontSize: 18,
          fill: COLORS.green,
          onClick: () => {
            this.ctx.production.collectBuilding(config.id, this.ctx.time.now());
            this.modalDirty = true;
          },
        }),
      );
    } else if (status.kind === 'idle') {
      this.modal.body.add(
        new Button(this, 0, 58, {
          width: 280,
          height: 48,
          label: `${loc.t('common.start')} · ${inputText}`,
          fontSize: 15,
          fill: this.ctx.economy.canAfford(recipe.input)
            ? COLORS.green
            : COLORS.inkSoft,
          disabled: !this.ctx.economy.canAfford(recipe.input),
          onClick: () => {
            if (!this.ctx.production.startBuilding(config.id, recipe.id, this.ctx.time.now())) {
              this.ctx.audio.sfx('error');
              this.showToastKey('toast.not_enough_resources');
            }
            this.modalDirty = true;
          },
        }),
      );
    }
  }

  private upgradeObject(objectId: string): void {
    if (!this.ctx.upgrades.upgrade(objectId)) {
      this.ctx.audio.sfx('error');
      return;
    }
    const config = this.ctx.data.objects[objectId];
    const level = this.ctx.state.objects[objectId].level;
    if (config) {
      this.showToastKey('toast.upgraded', {
        name: this.ctx.localization.t(config.nameKey),
        level,
      });
    }
    this.updateHud();
    this.modalDirty = true;
  }

  private async speedUp(objectId: string): Promise<void> {
    if (this.adBusy) return;
    this.adBusy = true;
    this.modalDirty = true;
    try {
      const success = await this.ctx.ads.showRewarded('speed_up');
      if (success) {
        this.ctx.production.speedUp(objectId, 300, this.ctx.time.now());
        this.showToastKey('toast.speed_success');
      }
    } finally {
      this.adBusy = false;
      this.modalDirty = true;
    }
  }

  private renderSettings(): void {
    if (!this.modal) return;
    const loc = this.ctx.localization;
    const state = this.ctx.state;

    const music = new Button(this, 0, -132, {
      width: 380,
      height: 52,
      label: `${loc.t('settings.music')}: ${state.settings.music ? loc.t('common.on') : loc.t('common.off')}`,
      icon: 'icon_music',
      fontSize: 18,
      fill: state.settings.music ? COLORS.green : COLORS.inkSoft,
      onClick: () => {
        this.ctx.setMusic(!state.settings.music);
        this.modalDirty = true;
      },
    });
    const sfx = new Button(this, 0, -64, {
      width: 380,
      height: 52,
      label: `${loc.t('settings.sfx')}: ${state.settings.sfx ? loc.t('common.on') : loc.t('common.off')}`,
      icon: 'icon_sound',
      fontSize: 18,
      fill: state.settings.sfx ? COLORS.green : COLORS.inkSoft,
      onClick: () => {
        this.ctx.setSfx(!state.settings.sfx);
        this.modalDirty = true;
      },
    });

    const languageLabel = this.add
      .text(0, 0, loc.t('settings.language'), {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT.ink,
      })
      .setOrigin(0.5);
    const ru = new Button(this, -100, 42, {
      width: 180,
      height: 46,
      label: loc.t('settings.lang_ru'),
      fontSize: 16,
      fill: loc.getLanguage() === 'ru' ? COLORS.green : COLORS.inkSoft,
      onClick: () => this.ctx.setLanguage('ru'),
    });
    const en = new Button(this, 100, 42, {
      width: 180,
      height: 46,
      label: loc.t('settings.lang_en'),
      fontSize: 16,
      fill: loc.getLanguage() === 'en' ? COLORS.green : COLORS.inkSoft,
      onClick: () => this.ctx.setLanguage('en'),
    });

    const platform = this.add
      .text(
        0,
        96,
        loc.t('settings.platform', { name: this.ctx.platform.id }),
        {
          fontFamily: FONT_FAMILY,
          fontSize: '14px',
          color: TEXT.inkSoft,
        },
      )
      .setOrigin(0.5);
    const version = this.add
      .text(0, 120, loc.t('settings.version', { version: '1.0.0' }), {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5);

    const reset = new Button(this, 0, 178, {
      width: 320,
      height: 48,
      label: this.resetArmed
        ? loc.t('settings.reset_confirm')
        : loc.t('settings.reset'),
      fontSize: 15,
      fill: COLORS.red,
      onClick: () => {
        if (this.resetArmed) {
          void this.ctx.resetProgress();
          return;
        }
        this.resetArmed = true;
        this.modalDirty = true;
      },
    });
    const resetHint = this.add
      .text(0, 212, loc.t('settings.reset_hint'), {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5);

    this.modal.body.add([
      music,
      sfx,
      languageLabel,
      ru,
      en,
      platform,
      version,
      reset,
      resetHint,
    ]);
  }

  private renderStorage(): void {
    if (!this.modal) return;
    const loc = this.ctx.localization;
    RESOURCE_IDS.forEach((id, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = -225 + column * 225;
      const y = -160 + row * 90;
      const amount = this.ctx.economy.get(id);
      const card = this.add.container(x, y);
      const background = this.add.graphics();
      background.fillStyle(0xfff3da, amount > 0 ? 0.92 : 0.5);
      background.fillRoundedRect(-105, -38, 210, 76, 18);
      background.lineStyle(2, COLORS.panelStroke, amount > 0 ? 0.65 : 0.3);
      background.strokeRoundedRect(-105, -38, 210, 76, 18);
      const icon = this.add
        .image(-76, 0, iconForResource(id))
        .setDisplaySize(34, 34)
        .setAlpha(amount > 0 ? 1 : 0.4);
      const name = this.add
        .text(-52, -10, loc.t(`resource.${id}`), {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          fontStyle: 'bold',
          color: TEXT.ink,
          fixedWidth: 105,
          wordWrap: { width: 105 },
        })
        .setOrigin(0, 0.5)
        .setAlpha(amount > 0 ? 1 : 0.5);
      const value = this.add
        .text(92, 0, formatNumber(amount), {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
          fontStyle: 'bold',
          color: amount > 0 ? TEXT.ink : TEXT.inkSoft,
        })
        .setOrigin(1, 0.5)
        .setAlpha(amount > 0 ? 1 : 0.5);
      card.add([background, icon, name, value]);
      this.modal?.body.add(card);
    });
  }

  private renderOffline(): void {
    if (!this.modal) return;
    const report = this.ctx.pendingOffline;
    if (!report) {
      this.closeModal();
      return;
    }
    const loc = this.ctx.localization;

    const away = this.add
      .text(
        0,
        -186,
        loc.t('offline.away', {
          time: formatDuration(report.elapsedSeconds, loc),
        }),
        {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          fontStyle: 'bold',
          color: TEXT.ink,
        },
      )
      .setOrigin(0.5);
    const capped = this.add
      .text(0, -158, loc.t('offline.capped'), {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5)
      .setVisible(report.elapsedSeconds > report.creditedSeconds);
    const gainsTitle = this.add
      .text(0, -118, loc.t('offline.gains'), {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: TEXT.inkSoft,
      })
      .setOrigin(0.5);
    this.modal.body.add([away, capped, gainsTitle]);

    report.gains.forEach((gain, index) => {
      const y = -74 + index * 44;
      const icon = this.add
        .image(-100, y, iconForResource(gain.id))
        .setDisplaySize(34, 34);
      const label = this.add
        .text(
          -70,
          y,
          `+${gain.amount} ${loc.t(`resource.${gain.id}`)}`,
          {
            fontFamily: FONT_FAMILY,
            fontSize: '18px',
            fontStyle: 'bold',
            color: TEXT.ink,
          },
        )
        .setOrigin(0, 0.5);
      this.modal?.body.add([icon, label]);
    });

    if (report.gains.length === 0) {
      this.modal.body.add(
        this.add
          .text(0, -40, loc.t('offline.no_gains'), {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: TEXT.inkSoft,
          })
          .setOrigin(0.5),
      );
    }

    const claim = new Button(this, 0, 170, {
      width: 250,
      height: 52,
      label: loc.t('offline.claim'),
      fontSize: 18,
      fill: COLORS.green,
      onClick: () => void this.claimOffline(1),
    });
    this.modal.body.add(claim);

    if (this.ctx.ads.isRewardedSupported() && report.gains.length > 0) {
      const claimDouble = new Button(this, 0, 230, {
        width: 330,
        height: 52,
        label: `▶ ${loc.t('offline.claim_x2')}`,
        fontSize: 17,
        fill: COLORS.accent,
        disabled: this.adBusy,
        onClick: () => void this.claimOffline(2),
      });
      this.modal.body.add(claimDouble);
    }
  }

  private async claimOffline(multiplier: number): Promise<void> {
    if (this.adBusy) return;
    this.adBusy = true;
    if (multiplier === 2) {
      const success = await this.ctx.ads.showRewarded('offline_double');
      if (!success) {
        this.adBusy = false;
        this.showToastKey('offline.rewarded_fail');
        this.modalDirty = true;
        return;
      }
    }

    await this.ctx.claimOffline(multiplier);
    this.adBusy = false;
    this.closeModal();
    this.showToastKey('toast.offline_claimed');
    this.updateHud();
    this.modalDirty = true;
  }
}
