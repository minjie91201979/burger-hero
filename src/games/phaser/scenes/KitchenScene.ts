import { Geom, Scene } from 'phaser';
import {
  UPGRADE_CATALOG,
  type GameSaveData,
  type IngredientId,
} from '../../../app/models/burger-game.model';
import type { GameEventBridge } from '../event-bridge.interface';
import { Customer, randomCustomerName } from '../entities/customer';
import { Order } from '../entities/order';

const COOK_TO_PERFECT_MS = 5200;
const PERFECT_TO_BURNT_MS = 3800;
/** 倒计时在肉饼中心下方的 Y 偏移（像素） */
const GRILL_COUNTDOWN_Y_OFFSET = 36;
/** 底部食材栏图标最大尺寸（原图较大，统一缩放） */
const ING_BAR_ICON_MAX = { w: 92, h: 58 };
/** 「取生肉」入口与生肉 PNG 一致，单独控制尺寸 */
const SPAWN_RAW_ICON_MAX = { w: 100, h: 76 };
/** 「清空盘」空盘图标尺寸 */
const CLEAR_PLATE_ICON_MAX = { w: 92, h: 60 };
/** 「出餐」计算器图标尺寸 */
const SERVE_BTN_ICON_MAX = { w: 100, h: 64 };
/** 生肉饼 / 烤架上的肉饼显示尺寸上限 */
const PATTY_ICON_MAX = { w: 88, h: 88 };
/** 餐盘叠放单层显示尺寸上限（PNG 按此框等比缩小，整体更大） */
const STACK_LAYER_MAX = { w: 176, h: 132 };
/** 相邻两层中心距 ≈ 层高×比例，越小叠得越紧（参考效果图几乎贴在一起） */
const STACK_LAYER_OVERLAP = 0.21;
/** 最底层食材中心：相对盘子区域中心向下占半高的比例（越大越靠盘底） */
const PLATE_STACK_BOTTOM_FRAC = 0.36;
/** 叠放整体竖直微调：负值上移（画面上更高），与瓷盘视觉对齐 */
const PLATE_STACK_ANCHOR_OFFSET = -34;

/** 与 `game_bg.png` 中平底锅、白盘大致对齐的交互区（Phaser Zone：x/y 为区域中心） */
const GRILL_ZONE = { cx: 252, cy: 408, w: 320, h: 220 };
const PLATE_ZONE = { cx: 752, cy: 398, w: 320, h: 236 };
/** 瓷盘图相对 `PLATE_ZONE` 中心下移（像素），仅移动贴图不改动交互区 */
const PLATE_DISH_GRAPHIC_OY = 58;
/** 烤盘 PNG 最大显示尺寸（略小于交互区，避免压住灶具描边） */
const GRILL_PAN_MAX = { w: GRILL_ZONE.w - 20, h: GRILL_ZONE.h - 24 };
/** 瓷盘 PNG 最大显示尺寸（略小于出餐交互区） */
const PLATE_DISH_MAX = { w: PLATE_ZONE.w - 16, h: PLATE_ZONE.h - 20 };

/** 操作台肉饼 Image 与烤架槽 Container 均带 Transform，用于拖拽回调收窄类型 */
type PattyDragObject = Phaser.GameObjects.Image | Phaser.GameObjects.Container;

interface GrillSlot {
  /** 烤架槽：肉饼 + 倒计时同容器拖拽，避免坐标/层级错位 */
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  phase: 'cooking' | 'perfect' | 'burnt';
  perfectAt?: number;
  /** 变焦前的时间戳（与 burntTimer 一致，用于 UI 倒计时） */
  burntAt?: number;
  burntTimer?: Phaser.Time.TimerEvent;
  slotIndex: number;
}

export class KitchenScene extends Scene {
  private eventsBridge!: GameEventBridge;
  private money = 100;
  private combo = 0;
  private score = 0;
  private customers: Customer[] = [];
  private stack: IngredientId[] = [];
  private stackSprites: Phaser.GameObjects.Container[] = [];
  private grillSlots: GrillSlot[] = [];
  private floatingPatty: Phaser.GameObjects.Image | null = null;
  private purchased = new Set<string>();
  private grillSpeed = 1;
  private patienceMult = 1;
  private maxGrillSlots = 1;
  private upgradeSub?: { unsubscribe: () => void };
  private saveTimer?: Phaser.Time.TimerEvent;
  private hudText!: Phaser.GameObjects.Text;
  private stackLabel!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private plateZone!: Phaser.GameObjects.Zone;
  private grillZone!: Phaser.GameObjects.Zone;
  /** 烤制中生肉时的滋滋声（循环），无烤制槽时停止 */
  private grillSizzleSound?: Phaser.Sound.BaseSound;
  private spawnRowY = 640;
  constructor() {
    super({ key: 'KitchenScene' });
  }

  init(): void {
    this.eventsBridge = this.game.registry.get('eventService') as GameEventBridge;
    const initial = this.game.registry.get('initialSave') as
      | { money?: number; upgrades?: string[]; combo?: number; highScore?: number }
      | undefined;
    if (initial?.money !== undefined) this.money = initial.money;
    if (initial?.combo !== undefined) this.combo = initial.combo;
    if (typeof initial?.highScore === 'number') {
      this.game.registry.set('highScore', initial.highScore);
    }
    if (initial?.upgrades?.length) {
      for (const u of initial.upgrades) {
        this.purchased.add(u);
        this.applyUpgradeInternal(u, false);
      }
    }
    this.upgradeSub = this.eventsBridge.upgradePurchased$.subscribe((id: string) => {
      if (this.purchased.has(id)) return;
      const def = UPGRADE_CATALOG.find((u) => u.id === id);
      if (!def) return;
      if (this.money < def.price) {
        this.eventsBridge.emitToast('金钱不足，无法购买升级');
        return;
      }
      this.money -= def.price;
      this.purchased.add(id);
      this.applyUpgradeInternal(id, true);
      this.eventsBridge.emitMoney(this.money);
      this.eventsBridge.emitPurchasedUpgrades([...this.purchased]);
      this.syncHud();
    });
  }

  create(): void {
    // this.add
    //   .image(512, 360, 'kitchen_bg')
    //   .setDepth(0)
    //   .setDisplaySize(1024, 720);

    const grillPan = this.add
      .image(GRILL_ZONE.cx, GRILL_ZONE.cy, 'kaopan')
      .setDepth(1);
    this.fitImageUniform(grillPan, GRILL_PAN_MAX.w, GRILL_PAN_MAX.h);

    this.grillZone = this.add
      .zone(GRILL_ZONE.cx, GRILL_ZONE.cy, GRILL_ZONE.w, GRILL_ZONE.h)
      .setDepth(2);
    this.plateZone = this.add
      .zone(PLATE_ZONE.cx, PLATE_ZONE.cy, PLATE_ZONE.w, PLATE_ZONE.h)
      .setDepth(2);

    const ciPan = this.add
      .image(PLATE_ZONE.cx, PLATE_ZONE.cy + PLATE_DISH_GRAPHIC_OY, 'cipan')
      .setDepth(1);
    this.fitImageUniform(ciPan, PLATE_DISH_MAX.w, PLATE_DISH_MAX.h);

    this.add.text(640, 250, '出餐台（按订单自下而上叠放）', {
      fontSize: '16px',
      color: '#333333',
    }).setDepth(3);

    this.hudText = this.add
      .text(24, 16, '', { fontSize: '18px', color: '#fff8e1', fontStyle: 'bold' })
      .setDepth(10);
    this.stackLabel = this.add
      .text(PLATE_ZONE.cx, PLATE_ZONE.cy + PLATE_ZONE.h * 0.62, '', {
        fontSize: '14px',
        color: '#eceff1',
        align: 'center',
        wordWrap: { width: Math.min(PLATE_ZONE.w + 80, 360) },
      })
      .setOrigin(0.5, 0)
      .setDepth(10);
    this.feedbackText = this.add
      .text(512, 120, '', { fontSize: '20px', color: '#ffeb3b' })
      .setOrigin(0.5)
      .setDepth(20);

    this.buildIngredientBar();
    this.buildPattySpawn();
    this.buildActions();

    this.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, x: number, y: number) => {
        if (obj.getData('kind') === 'patty') {
          (obj as PattyDragObject).setPosition(x, y);
        }
      },
    );

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (obj.getData('kind') === 'patty') {
        this.handlePattyDragEnd(obj as PattyDragObject);
      }
    });

    this.time.addEvent({
      delay: 7000,
      callback: () => this.trySpawnCustomer(),
      loop: true,
      callbackScope: this,
    });

    this.saveTimer = this.time.addEvent({
      delay: 8000,
      callback: () => this.pushSave(),
      loop: true,
      callbackScope: this,
    });

    this.syncHud();
    this.trySpawnCustomer();
    this.pushOrders();
    this.eventsBridge.emitPurchasedUpgrades([...this.purchased]);
    this.eventsBridge.emitMoney(this.money);
    this.eventsBridge.emitCombo(this.combo);
    this.eventsBridge.emitScore(this.score);

    this.game.registry.set('getSaveSnapshot', () => this.buildSaveData());

    this.events.once('destroy', () => {
      this.upgradeSub?.unsubscribe();
      this.saveTimer?.destroy();
      this.stopGrillSizzle();
    });
  }

  override update(time: number, delta: number): void {
    for (const slot of this.grillSlots) {
      if (slot.phase === 'cooking' && slot.perfectAt !== undefined) {
        if (time >= slot.perfectAt) {
          this.finishCookToPerfect(slot, time);
        } else {
          const left = (slot.perfectAt - time) / 1000;
          slot.label.setText(`烤制中 ${left.toFixed(1)}s`);
          slot.label.setColor('#ffecb3');
        }
      } else if (slot.phase === 'perfect' && slot.burntAt !== undefined && time < slot.burntAt) {
        const left = (slot.burntAt - time) / 1000;
        slot.label.setText(`快取！${left.toFixed(1)}s 后变焦`);
        slot.label.setColor('#fff9c4');
      }
    }

    const drain = ((delta / 1000) * 28) / this.patienceMult;
    let changed = false;
    for (const c of this.customers) {
      c.patience -= drain;
      if (c.patience <= 0) {
        changed = true;
      }
    }
    const remainingCustomers = this.customers.filter((c) => c.patience > 0);
    if (remainingCustomers.length !== this.customers.length) {
      this.customers = remainingCustomers;
      this.combo = 0;
      this.eventsBridge.emitCombo(0);
      this.eventsBridge.emitCustomerLeave();
      this.eventsBridge.emitToast('顾客等不及离开了…');
      this.showFeedback('失去连击', 1000);
      this.pushOrders();
    } else if (changed) {
      this.pushOrders();
    }

    const hasCooking = this.grillSlots.some((s) => s.phase === 'cooking');
    this.syncGrillSizzle(hasCooking);
  }

  private syncGrillSizzle(shouldPlay: boolean): void {
    if (shouldPlay) {
      if (!this.grillSizzleSound) {
        this.grillSizzleSound = this.sound.add('kaorou_zizi', { loop: true, volume: 0.4 });
      }
      if (!this.grillSizzleSound.isPlaying) {
        this.grillSizzleSound.play();
      }
    } else {
      this.stopGrillSizzle();
    }
  }

  private stopGrillSizzle(): void {
    if (this.grillSizzleSound?.isPlaying) {
      this.grillSizzleSound.stop();
    }
  }

  /** PNG 素材缩放到界面可用尺寸（保持宽高比） */
  private fitImageUniform(
    img: Phaser.GameObjects.Image,
    maxW: number,
    maxH: number,
  ): void {
    const iw = img.width;
    const ih = img.height;
    if (iw <= 0 || ih <= 0) return;
    const s = Math.min(maxW / iw, maxH / ih);
    img.setScale(s);
  }

  private applyPattyDisplaySize(sprite: Phaser.GameObjects.Image): void {
    sprite.setScale(1);
    this.fitImageUniform(sprite, PATTY_ICON_MAX.w, PATTY_ICON_MAX.h);
  }

  private buildIngredientBar(): void {
    const defs: { key: string; id: IngredientId; label: string }[] = [
      { key: 'bun_bottom', id: 'bun_bottom', label: '底面包' },
      { key: 'lettuce', id: 'lettuce', label: '生菜' },
      { key: 'cheese', id: 'cheese', label: '芝士' },
      { key: 'bun_top', id: 'bun_top', label: '顶面包' },
    ];
    let x = 320;
    for (const d of defs) {
      const img = this.add
        .image(x, this.spawnRowY, d.key)
        .setInteractive({ useHandCursor: true })
        .setDepth(5);
      this.fitImageUniform(img, ING_BAR_ICON_MAX.w, ING_BAR_ICON_MAX.h);
      img.on('pointerdown', () => this.tryAddIngredient(d.id));
      this.add
        .text(x, this.spawnRowY + 36, d.label, { fontSize: '11px', color: '#cfd8dc' })
        .setOrigin(0.5, 0)
        .setDepth(5);
      x += 100;
    }
  }

  private buildPattySpawn(): void {
    const btn = this.add
      .image(120, this.spawnRowY, 'patty_raw')
      .setInteractive({ useHandCursor: true })
      .setDepth(5);
    this.fitImageUniform(btn, SPAWN_RAW_ICON_MAX.w, SPAWN_RAW_ICON_MAX.h);
    this.add
      .text(120, this.spawnRowY + 36, '取生肉', { fontSize: '11px', color: '#cfd8dc' })
      .setOrigin(0.5, 0)
      .setDepth(5);
    btn.on('pointerdown', () => this.spawnRawPatty());
  }

  private buildActions(): void {
    const serve = this.add
      .image(880, this.spawnRowY - 20, 'jisuanqi')
      .setInteractive({ useHandCursor: true })
      .setDepth(5);
    this.fitImageUniform(serve, SERVE_BTN_ICON_MAX.w, SERVE_BTN_ICON_MAX.h);
    this.add
      .text(880, this.spawnRowY + 20, '出餐', { fontSize: '12px', color: '#eceff1' })
      .setOrigin(0.5, 0)
      .setDepth(5);
    serve.on('pointerdown', () => this.tryServe());

    const clear = this.add
      .image(780, this.spawnRowY - 20, 'kongpan')
      .setInteractive({ useHandCursor: true })
      .setDepth(5);
    this.fitImageUniform(clear, CLEAR_PLATE_ICON_MAX.w, CLEAR_PLATE_ICON_MAX.h);
    this.add
      .text(780, this.spawnRowY + 20, '清空盘', { fontSize: '12px', color: '#eceff1' })
      .setOrigin(0.5, 0)
      .setDepth(5);
    clear.on('pointerdown', () => this.clearPlate());
  }

  private spawnRawPatty(): void {
    if (this.floatingPatty) {
      this.showFeedback('先放好手里的肉饼', 600);
      return;
    }
    const s = this.add.image(280, 500, 'patty_raw').setDepth(6);
    this.applyPattyDisplaySize(s);
    s.setData('kind', 'patty');
    s.setData('mode', 'counter');
    this.ensurePattyDraggable(s);
    this.floatingPatty = s;
  }

  /** 操作台漂浮生肉饼：可拖入烤架 */
  private ensurePattyDraggable(sprite: Phaser.GameObjects.Image): void {
    sprite.setDepth(8);
    sprite.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(sprite);
  }

  private bringGrillSlotForward(slot: GrillSlot): void {
    slot.root.setDepth(12);
  }

  private handlePattyDragEnd(obj: PattyDragObject): void {
    const mode = obj.getData('mode') as string;
    const gx = this.grillZone.x;
    const gy = this.grillZone.y;
    const gw = this.grillZone.width;
    const gh = this.grillZone.height;
    const px = this.plateZone.x;
    const py = this.plateZone.y;
    const pw = this.plateZone.width;
    const ph = this.plateZone.height;

    const ox = obj.x;
    const oy = obj.y;

    if (
      mode === 'counter' &&
      ox > gx - gw / 2 &&
      ox < gx + gw / 2 &&
      oy > gy - gh / 2 &&
      oy < gy + gh / 2
    ) {
      if (this.grillSlots.length >= this.maxGrillSlots) {
        this.showFeedback('烤架已满', 700);
        obj.setPosition(280, 500);
        return;
      }
      this.placePattyOnGrill(obj as Phaser.GameObjects.Image);
      this.floatingPatty = null;
      return;
    }

    const slot = this.grillSlots.find((g) => g.root === obj);
    if (slot && slot.phase === 'cooking') {
      if (
        ox > px - pw / 2 &&
        ox < px + pw / 2 &&
        oy > py - ph / 2 &&
        oy < py + ph / 2
      ) {
        this.showFeedback('还在烤制，请看肉饼下方倒计时', 1000);
        obj.setPosition(this.getGrillPattyCenterX(slot.slotIndex), gy);
        return;
      }
    }
    if (slot && (slot.phase === 'perfect' || slot.phase === 'burnt')) {
      if (
        ox > px - pw / 2 &&
        ox < px + pw / 2 &&
        oy > py - ph / 2 &&
        oy < py + ph / 2
      ) {
        const ing: IngredientId = slot.phase === 'burnt' ? 'patty_burnt' : 'patty_cooked';
        this.addToStack(ing);
        this.removeGrillSlot(slot);
        return;
      }
    }

    if (mode === 'counter') {
      obj.setPosition(280, 500);
    } else if (slot) {
      obj.setPosition(this.getGrillPattyCenterX(slot.slotIndex), gy);
    }
  }

  /** 烤架上网格槽位的水平中心：单槽对齐烤架区中心，双槽左右均分 */
  private getGrillPattyCenterX(slotIndex: number): number {
    const cx = this.grillZone.x;
    if (this.maxGrillSlots <= 1) {
      return cx;
    }
    const spread = 92;
    return cx - spread / 2 + slotIndex * spread;
  }

  private placePattyOnGrill(sprite: Phaser.GameObjects.Image): void {
    const idx = this.grillSlots.length;
    const gy = this.grillZone.y;
    const baseX = this.getGrillPattyCenterX(idx);

    sprite.disableInteractive();
    this.input.setDraggable(sprite, false);
    sprite.setData('mode', 'grill');

    const root = this.add.container(baseX, gy);
    root.setDepth(9);
    root.setData('kind', 'patty');
    root.setData('mode', 'grill');

    sprite.setPosition(0, 0);
    root.add(sprite);

    const cookSec = COOK_TO_PERFECT_MS / this.grillSpeed / 1000;
    const label = this.add
      .text(0, GRILL_COUNTDOWN_Y_OFFSET, `烤制中 ${cookSec.toFixed(1)}s`, {
        fontSize: '15px',
        color: '#fff59d',
        fontStyle: 'bold',
        fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", sans-serif',
        backgroundColor: 'rgba(26, 18, 9, 0.92)',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0);
    root.add(label);

    const hitW = 148;
    const hitH = 112;
    root.setInteractive({
      hitArea: new Geom.Rectangle(-hitW / 2, -28, hitW, hitH),
      hitAreaCallback: Geom.Rectangle.Contains,
      draggable: true,
      useHandCursor: true,
    });
    this.input.setDraggable(root);

    const cookMs = COOK_TO_PERFECT_MS / this.grillSpeed;
    const slot: GrillSlot = {
      root,
      sprite,
      label,
      phase: 'cooking',
      slotIndex: idx,
      /** 与 Scene.update(time) 同源，避免与 Clock.now 不同步导致永远不熟透 */
      perfectAt: this.game.getTime() + cookMs,
    };
    this.grillSlots.push(slot);
  }

  private finishCookToPerfect(slot: GrillSlot, time: number): void {
    if (slot.phase !== 'cooking') return;
    slot.phase = 'perfect';
    slot.sprite.setTexture('patty_cooked');
    this.applyPattyDisplaySize(slot.sprite);
    this.bringGrillSlotForward(slot);
    const burntDelay = PERFECT_TO_BURNT_MS / this.grillSpeed;
    slot.burntAt = time + burntDelay;
    this.showFeedback('肉饼已熟，可拖到餐盘！', 900);
    slot.label.setText(`可取下（${(burntDelay / 1000).toFixed(1)}s 后变焦）`);
    slot.label.setColor('#c8e6c9');
    slot.burntTimer = this.time.delayedCall(burntDelay, () => {
      if (slot.phase === 'perfect') {
        slot.phase = 'burnt';
        slot.sprite.setTexture('patty_burnt');
        this.applyPattyDisplaySize(slot.sprite);
        this.bringGrillSlotForward(slot);
        slot.burntAt = undefined;
        slot.label.setText('已变焦');
        slot.label.setColor('#ffab91');
        this.showFeedback('肉饼焦了…', 800);
      }
    });
  }

  private removeGrillSlot(slot: GrillSlot): void {
    slot.burntTimer?.destroy();
    this.grillSlots = this.grillSlots.filter((s) => s !== slot);
    slot.root.destroy(true);
    this.reindexGrillSlots();
  }

  private reindexGrillSlots(): void {
    const gy = this.grillZone.y;
    this.grillSlots.forEach((s, i) => {
      s.slotIndex = i;
      const x = this.getGrillPattyCenterX(i);
      s.root.setPosition(x, gy);
    });
  }

  private tryAddIngredient(id: IngredientId): void {
    this.addToStack(id);
  }

  private addToStack(id: IngredientId): void {
    this.stack.push(id);
    this.refreshStackVisual();
    this.syncStackLabel();
  }

  private refreshStackVisual(): void {
    for (const c of this.stackSprites) c.destroy();
    this.stackSprites = [];
    if (this.stack.length === 0) return;

    const layers: { img: Phaser.GameObjects.Image; step: number }[] = [];
    for (const id of this.stack) {
      const img = this.add.image(0, 0, id);
      this.fitImageUniform(img, STACK_LAYER_MAX.w, STACK_LAYER_MAX.h);
      const step = Math.max(11, Math.round(img.displayHeight * STACK_LAYER_OVERLAP));
      layers.push({ img, step });
    }

    const bottomCenterY =
      PLATE_ZONE.cy + PLATE_ZONE.h * PLATE_STACK_BOTTOM_FRAC + PLATE_STACK_ANCHOR_OFFSET;
    let y = bottomCenterY;
    for (let i = 0; i < layers.length; i++) {
      const { img, step } = layers[i]!;
      const c = this.add.container(PLATE_ZONE.cx, y, [img]).setDepth(4);
      this.stackSprites.push(c);
      if (i < layers.length - 1) {
        y -= step;
      }
    }
  }

  private clearPlate(): void {
    this.stack = [];
    for (const c of this.stackSprites) c.destroy();
    this.stackSprites = [];
    this.syncStackLabel();
  }

  private syncStackLabel(): void {
    const names: Record<IngredientId, string> = {
      bun_bottom: '底面包',
      bun_top: '顶面包',
      lettuce: '生菜',
      cheese: '芝士',
      patty_raw: '生肉',
      patty_cooked: '熟肉',
      patty_burnt: '焦肉',
    };
    const line = this.stack.map((i) => names[i]).join(' → ') || '（空）';
    this.stackLabel.setText(`当前盘子：${line}`);
  }

  private tryServe(): void {
    const c = this.customers[0];
    if (!c) {
      this.showFeedback('没有顾客', 600);
      return;
    }
    if (!c.order.matchesStack(this.stack)) {
      this.eventsBridge.emitToast('食材顺序或种类与订单不符');
      this.showFeedback('再检查一下订单', 900);
      return;
    }
    const hasBurnt = this.stack.includes('patty_burnt');
    let gain = 18 + Math.floor(c.patience / 80);
    if (!hasBurnt) gain += 6;
    else gain = Math.max(4, Math.floor(gain * 0.45));
    this.combo += 1;
    this.money += gain;
    this.score += gain + this.combo * 2;
    this.clearPlate();
    this.customers.shift();
    this.eventsBridge.emitMoney(this.money);
    this.eventsBridge.emitCombo(this.combo);
    this.eventsBridge.emitScore(this.score);
    this.eventsBridge.emitToast(`完成订单 +$${gain}`);
    this.pushOrders();
    this.syncHud();
    this.pushSave();
  }

  private trySpawnCustomer(): void {
    if (this.customers.length >= 3) return;
    const rng = () => Math.random();
    const order = Order.randomOrder(rng);
    const maxP = Math.floor((9000 + rng() * 6000) * this.patienceMult);
    const cust = new Customer(order, maxP, randomCustomerName(rng));
    this.customers.push(cust);
    this.pushOrders();
  }

  private pushOrders(): void {
    this.eventsBridge.emitOrdersChanged(this.customers.map((c) => c.toSnapshot()));
  }

  private syncHud(): void {
    this.hudText.setText(`金钱 $${this.money}    连击 x${this.combo}    得分 ${this.score}`);
  }

  private showFeedback(msg: string, duration: number): void {
    this.feedbackText.setText(msg);
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.feedbackText.setAlpha(1);
        this.feedbackText.setText('');
      },
    });
  }

  private applyUpgradeInternal(id: string, toast: boolean): void {
    if (id === 'faster_grill') this.grillSpeed *= 1.22;
    if (id === 'patience_boost') this.patienceMult *= 1.28;
    if (id === 'extra_slot') this.maxGrillSlots = Math.min(2, this.maxGrillSlots + 1);
    if (toast) {
      this.eventsBridge.emitToast(`升级已应用：${id}`);
      this.pushSave();
    }
  }

  private buildSaveData(): GameSaveData {
    return {
      money: this.money,
      combo: this.combo,
      upgrades: [...this.purchased],
      achievements: [],
      highScore: Math.max(this.score, (this.game.registry.get('highScore') as number) || 0),
    };
  }

  private pushSave(): void {
    const data = this.buildSaveData();
    this.game.registry.events.emit('burger-save', data);
    this.game.registry.set('highScore', data.highScore);
  }
}
