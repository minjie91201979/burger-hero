import * as Phaser from 'phaser';
import { WARRIOR_WALK_BACKGROUND_FILES } from '../../warrior-walk/warrior-walk-background-manifest';
import {
  CARDS,
  GAME_CONFIG,
  type CardId,
  getHeroDef,
} from '../data/game-data';
import { getSelectedHeroId } from './HeroDuelSelectScene';

const VIEW_W = 1280;
const VIEW_H = 640;
const PLAY_H = 440;
const GROUND_H = 110;
const FEET_Y = PLAY_H - 24;
const GROUND_CY = FEET_Y + GROUND_H / 2;
const MIN_WORLD_W = 4000;
const PLAYER_SCALE = 0.29;
const ENEMY_SCALE = 0.29;
const W_FRAME_WALK_START = 0;
const W_FRAME_WALK_END = 4;
const M_FRAME_WALK_START = 0;
const M_FRAME_WALK_END = 4;
const ENEMY_WALK_KEY = 'hd_enemy_walk';
const ENEMY_ATTACK_KEY = 'hd_enemy_attack';
const ENEMY_HP_BAR_W = 48;
const ENEMY_HP_BAR_H = 8;
const ENEMY_HP_BAR_Y_OFF = 130;

type CardSlot = CardId | null;

export class HeroDuelBattleScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ground!: Phaser.GameObjects.Rectangle;
  private enemies!: Phaser.Physics.Arcade.Group;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;

  private walkTextureKey!: string;
  private walkAnimKey!: string;
  private frameWalkStart!: number;
  private frameWalkEnd!: number;

  private worldW = MIN_WORLD_W;

  private maxHp = 9;
  private currentHp = 9;
  private nextDamageIgnored = false;
  private invulnUntil = 0;
  private lastEnemyHitMs = 0;

  private speedBuffUntil = 0;
  private speedMult = 1;
  private cardDamageMultUntil = 0;
  private cardDamageMult = 1;

  private hand: CardSlot[] = [];
  private refillCountdown = GAME_CONFIG.refillInterval;
  private skillCdEnd: number[] = [0, 0, 0, 0];

  private heroId = 'zhao_yun';
  private orbZones: Phaser.GameObjects.Arc[] = [];
  private orbAngles: number[] = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  private orbHitAt = new Map<Phaser.Physics.Arcade.Sprite, number>();

  private hpBarFg!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private refillText!: Phaser.GameObjects.Text;
  private enemyLeftText!: Phaser.GameObjects.Text;
  private handSlots: {
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    index: number;
  }[] = [];
  private skillSlots: {
    bg: Phaser.GameObjects.Rectangle;
    keyLbl: Phaser.GameObjects.Text;
    nameLbl: Phaser.GameObjects.Text;
    cdOverlay: Phaser.GameObjects.Rectangle;
    cdText: Phaser.GameObjects.Text;
    index: number;
  }[] = [];

  private floatingTip!: Phaser.GameObjects.Text;
  private gameEndContainer?: Phaser.GameObjects.Container;
  private isBattleOver = false;
  private windWall?: Phaser.GameObjects.Rectangle;
  private windWallTick?: Phaser.Time.TimerEvent;
  private longdanHit = new Set<Phaser.Physics.Arcade.Sprite>();
  /** Phaser 4：create 阶段立刻 setText 可能尚未建立 Canvas 纹理，推迟到 update 再刷新手牌 UI */
  private handUiDirty = false;

  private showTouchUi = false;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private joystickRadius = 56;
  private joystickThumbRadius = 20;
  private joystickActiveId: number | null = null;
  private joystickVec = new Phaser.Math.Vector2(0, 0);
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private moveTouchUi!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'HeroDuelBattleScene' });
  }

  create(): void {
    this.heroId = getSelectedHeroId(this.registry);
    const def = getHeroDef(this.heroId);
    if (!def) {
      this.scene.start('HeroDuelSelectScene');
      return;
    }

    let effectiveMax = def.maxHp;
    if (def.heroId === 'zhang_fei') {
      effectiveMax = Math.floor(def.maxHp * 1.1);
    }
    this.maxHp = effectiveMax;
    this.currentHp = effectiveMax;

    if (def.visual === 'mage') {
      this.walkTextureKey = 'fashi_walk';
      this.walkAnimKey = 'hd_mage_walk';
      this.frameWalkStart = M_FRAME_WALK_START;
      this.frameWalkEnd = M_FRAME_WALK_END;
    } else {
      this.walkTextureKey = 'warrior_walk';
      this.walkAnimKey = 'hd_warrior_walk';
      this.frameWalkStart = W_FRAME_WALK_START;
      this.frameWalkEnd = W_FRAME_WALK_END;
    }

    this.worldW = this.layoutBackground();
    this.physics.world.setBounds(0, 0, this.worldW, PLAY_H);

    this.ground = this.add.rectangle(this.worldW / 2, GROUND_CY, this.worldW, GROUND_H, 0x3e2723, 0.35);
    this.physics.add.existing(this.ground, true);

    if (this.textures.exists('road_ground')) {
      const frame = this.textures.get('road_ground').get();
      const tileS = GROUND_H / frame.height;
      const road = this.add.tileSprite(this.worldW / 2, GROUND_CY, this.worldW, GROUND_H, 'road_ground');
      road.setOrigin(0.5, 0.5);
      road.setDepth(-8);
      road.setTileScale(tileS, tileS);
    }

    if (!this.anims.exists(this.walkAnimKey)) {
      this.anims.create({
        key: this.walkAnimKey,
        frames: this.anims.generateFrameNumbers(this.walkTextureKey, {
          start: this.frameWalkStart,
          end: this.frameWalkEnd,
        }),
        frameRate: 11,
        repeat: -1,
      });
    }
    if (!this.anims.exists(ENEMY_WALK_KEY)) {
      this.anims.create({
        key: ENEMY_WALK_KEY,
        frames: this.anims.generateFrameNumbers('ribenwushi', { start: 0, end: 1 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!this.anims.exists(ENEMY_ATTACK_KEY)) {
      this.anims.create({
        key: ENEMY_ATTACK_KEY,
        frames: this.anims.generateFrameNumbers('ribenwushi', { start: 2, end: 3 }),
        frameRate: 9,
        repeat: 0,
      });
    }

    const startX = 420;
    this.player = this.physics.add.sprite(startX, FEET_Y, this.walkTextureKey, this.frameWalkStart);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setOrigin(0.5, 1);
    if (def.visual === 'warrior_tint' && def.tint !== undefined) {
      this.player.setTint(def.tint);
    }

    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    pb.setAllowGravity(false);
    pb.setImmovable(false);
    pb.setSize(140, 168);
    pb.setOffset(130, 200);

    this.physics.add.collider(this.player, this.ground);

    this.enemies = this.physics.add.group();
    this.spawnEnemies();
    this.physics.add.collider(this.enemies, this.ground);
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      this.onPlayerEnemyOverlap(e as Phaser.Physics.Arcade.Sprite);
    });

    const kb = this.input.keyboard;
    if (kb) {
      this.keyA = kb.addKey('A');
      this.keyD = kb.addKey('D');
    }

    const onSkillKey = (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n < 1 || n > 4) return;
      const hd = getHeroDef(this.heroId);
      const sk = hd?.skills.find((s) => s.keyIndex === n);
      if (sk) this.tryUseSkill(hd!.skills.indexOf(sk));
    };
    this.input.keyboard?.on('keydown', onSkillKey);

    this.cameras.main.setBounds(0, 0, this.worldW, VIEW_H);
    this.cameras.main.startFollow(this.player, true, 0.14, 0);
    this.cameras.main.setDeadzone(220, VIEW_H);

    this.hand = Array.from({ length: GAME_CONFIG.handCardLimit }, () => null);
    this.drawStartingHand();

    this.buildHud(def.name);

    this.showTouchUi = this.computeShowTouchUi();
    this.layoutMoveTouchUi();
    this.scale.on('resize', this.layoutMoveTouchUi, this);
    this.input.on('pointerdown', this.onBattlePointerDown, this);
    this.input.on('pointermove', this.onBattlePointerMove, this);
    this.input.on('pointerup', this.onBattlePointerUp, this);
    this.input.on('pointerupoutside', this.onBattlePointerUp, this);

    this.floatingTip = this.add
      .text(VIEW_W / 2, 120, '', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#fff9c4',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setAlpha(0);

    const keyR = this.input.keyboard?.addKey('R');
    keyR?.on('down', () => {
      if (!this.isBattleOver) this.scene.start('HeroDuelSelectScene');
    });

    this.events.once('shutdown', () => {
      keyR?.off('down');
      this.input.keyboard?.off('keydown', onSkillKey);
      this.input.off('pointerdown', this.onBattlePointerDown, this);
      this.input.off('pointermove', this.onBattlePointerMove, this);
      this.input.off('pointerup', this.onBattlePointerUp, this);
      this.input.off('pointerupoutside', this.onBattlePointerUp, this);
      this.scale.off('resize', this.layoutMoveTouchUi, this);
      this.windWallTick?.remove(false);
    });
  }

  private computeShowTouchUi(): boolean {
    const w = this.scale.width;
    if (w <= 900) return true;
    const os = this.sys.game.device.os;
    return !!(os.android || os.iOS);
  }

  private layoutMoveTouchUi(): void {
    const h = this.scale.height;
    this.joystickCenterX = 78;
    this.joystickCenterY = h - 212;

    if (!this.moveTouchUi) {
      this.moveTouchUi = this.add.container(0, 0);
      this.moveTouchUi.setScrollFactor(0);
      this.moveTouchUi.setDepth(2500);
      this.joystickBase = this.add
        .circle(0, 0, this.joystickRadius, 0x000000, 0.3)
        .setStrokeStyle(2, 0xffffff, 0.32);
      this.joystickThumb = this.add
        .circle(0, 0, this.joystickThumbRadius, 0xffffff, 0.38)
        .setStrokeStyle(2, 0xffb74d, 0.5);
      this.moveTouchUi.add([this.joystickBase, this.joystickThumb]);
    }
    this.joystickBase.setPosition(this.joystickCenterX, this.joystickCenterY);
    this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
    this.moveTouchUi.setVisible(this.showTouchUi);
    if (!this.showTouchUi) {
      this.joystickVec.set(0, 0);
      this.joystickActiveId = null;
    }
  }

  private isPointerOnMoveJoystick(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.joystickCenterX, this.joystickCenterY) <= this.joystickRadius + 28;
  }

  private updateMoveJoystickThumb(px: number, py: number): void {
    const dx = px - this.joystickCenterX;
    const dy = py - this.joystickCenterY;
    const len = Math.hypot(dx, dy);
    const max = this.joystickRadius - 6;
    const nx = len > max ? (dx / len) * max : dx;
    const ny = len > max ? (dy / len) * max : dy;
    this.joystickThumb.setPosition(this.joystickCenterX + nx, this.joystickCenterY + ny);
    if (len < 5) {
      this.joystickVec.set(0, 0);
    } else {
      const inv = 1 / Math.max(len, 1);
      this.joystickVec.set(dx * inv, dy * inv);
    }
  }

  private onBattlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.showTouchUi || this.isBattleOver) return;
    if (this.isPointerOnMoveJoystick(pointer.x, pointer.y)) {
      this.joystickActiveId = pointer.id;
      this.updateMoveJoystickThumb(pointer.x, pointer.y);
    }
  }

  private onBattlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.joystickActiveId !== pointer.id) return;
    this.updateMoveJoystickThumb(pointer.x, pointer.y);
  }

  private onBattlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.joystickActiveId === pointer.id) {
      this.joystickActiveId = null;
      this.joystickVec.set(0, 0);
      this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
    }
  }

  private layoutBackground(): number {
    const WORLD_H_BG = PLAY_H;
    const segments: { key: string; w: number; scale: number }[] = [];
    for (let i = 0; i < WARRIOR_WALK_BACKGROUND_FILES.length; i++) {
      const key = `ww_bg_${i}`;
      if (!this.textures.exists(key)) continue;
      const frame = this.textures.get(key).get();
      const scale = WORLD_H_BG / frame.height;
      segments.push({ key, w: frame.width * scale, scale });
    }

    if (segments.length === 0) {
      this.add.rectangle(MIN_WORLD_W / 2, PLAY_H / 2, MIN_WORLD_W, PLAY_H, 0x263238, 1).setDepth(-20);
      return MIN_WORLD_W;
    }

    const patternW = segments.reduce((a, s) => a + s.w, 0);
    const repetitions = Math.max(1, Math.ceil(MIN_WORLD_W / patternW));
    const worldW = repetitions * patternW;
    let x = 0;
    for (let r = 0; r < repetitions; r++) {
      for (const seg of segments) {
        this.add.image(x, PLAY_H, seg.key).setOrigin(0, 1).setScale(seg.scale).setDepth(-20);
        x += seg.w;
      }
    }
    return worldW;
  }

  private spawnEnemies(): void {
    const margin = 280;
    const n = Phaser.Math.Between(GAME_CONFIG.enemyCountMin, GAME_CONFIG.enemyCountMax);
    const maxHp = GAME_CONFIG.enemyMaxHp;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(Math.floor(this.worldW * 0.35), this.worldW - margin);
      const e = this.physics.add.sprite(x, FEET_Y, 'ribenwushi', 0);
      e.setOrigin(0.5, 1);
      e.setScale(ENEMY_SCALE);
      e.setDepth(1);
      e.setData('dying', false);
      e.setData('stunUntil', 0);
      e.setData('slowUntil', 0);
      e.setData('vulnUntil', 0);
      e.setData('enemyAttacking', false);
      e.setData('nextAttack', this.time.now + Phaser.Math.Between(1200, 2800));
      e.setData('maxHp', maxHp);
      e.setData('hp', maxHp);
      e.play(ENEMY_WALK_KEY);

      const eb = e.body as Phaser.Physics.Arcade.Body;
      eb.setAllowGravity(false);
      eb.setSize(130, 165);
      eb.setOffset(135, 205);

      this.attachEnemyHpBar(e);
      this.enemies.add(e);
    }
  }

  /** 敌人头顶血条（世界坐标，随敌人移动） */
  private attachEnemyHpBar(e: Phaser.Physics.Arcade.Sprite): void {
    const innerW = ENEMY_HP_BAR_W - 4;
    const innerH = ENEMY_HP_BAR_H - 2;
    const cy = e.y - ENEMY_HP_BAR_Y_OFF;

    const bg = this.add
      .rectangle(e.x, cy, ENEMY_HP_BAR_W, ENEMY_HP_BAR_H, 0x1a1a1a, 0.92)
      .setStrokeStyle(1, 0xb0bec5, 0.65)
      .setDepth(4);

    const fg = this.add
      .rectangle(e.x - innerW / 2, cy, innerW, innerH, 0xc62828, 1)
      .setOrigin(0, 0.5)
      .setDepth(5);

    e.setData('hpBarBg', bg);
    e.setData('hpBarFg', fg);
    e.setData('hpBarInnerW', innerW);
  }

  private syncEnemyHpBars(): void {
    const innerFull = ENEMY_HP_BAR_W - 4;
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying')) return;
      const bg = e.getData('hpBarBg') as Phaser.GameObjects.Rectangle | undefined;
      const fg = e.getData('hpBarFg') as Phaser.GameObjects.Rectangle | undefined;
      if (!bg || !fg) return;

      const cy = e.y - ENEMY_HP_BAR_Y_OFF;
      bg.setPosition(e.x, cy);

      const hp = (e.getData('hp') as number) ?? 0;
      const maxHp = (e.getData('maxHp') as number) ?? GAME_CONFIG.enemyMaxHp;
      const ratio = Phaser.Math.Clamp(maxHp > 0 ? hp / maxHp : 0, 0, 1);
      const w = innerFull * ratio;
      fg.setPosition(e.x - innerFull / 2, cy);
      fg.width = Math.max(0, w);
      fg.setFillStyle(ratio <= 0.3 ? 0xff5722 : 0xd32f2f, 1);
    });
  }

  private destroyEnemyHpBar(enemy: Phaser.Physics.Arcade.Sprite): void {
    (enemy.getData('hpBarBg') as Phaser.GameObjects.Rectangle | undefined)?.destroy();
    (enemy.getData('hpBarFg') as Phaser.GameObjects.Rectangle | undefined)?.destroy();
    enemy.setData('hpBarBg', undefined);
    enemy.setData('hpBarFg', undefined);
  }

  private drawStartingHand(): void {
    for (let i = 0; i < GAME_CONFIG.startHandCardCount; i++) {
      this.hand[i] = Phaser.Math.RND.pick([...GAME_CONFIG.globalCardPool]);
    }
  }

  private buildHud(heroName: string): void {
    const pad = 12;
    this.add
      .text(pad, 8, `${heroName}  ·  R 返回选将`, {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '15px',
        color: '#eceff1',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    const barW = 220;
    const barH = 14;
    const bx = pad;
    const by = 44;
    this.add.rectangle(bx + barW / 2, by + barH / 2, barW + 4, barH + 4, 0x000000, 0.55).setScrollFactor(0).setDepth(1000);
    this.hpBarFg = this.add
      .rectangle(bx + 2, by + 2, barW, barH, 0x43a047, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.hpText = this.add
      .text(bx + barW / 2, by + barH / 2, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(1002);

    this.refillText = this.add
      .text(VIEW_W / 2, 36, '', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '16px',
        color: '#b2ebf2',
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.enemyLeftText = this.add
      .text(VIEW_W - pad, 36, '', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '16px',
        color: '#ffccbc',
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.refreshHpBar();
    this.updateEnemyCountText();

    const def = getHeroDef(this.heroId)!;
    const skillY = VIEW_H - 168;
    const skillSlot = 56;
    const skillGap = 10;
    const totalSkillW = def.skills.length * skillSlot + (def.skills.length - 1) * skillGap;
    let sx = VIEW_W / 2 - totalSkillW / 2;

    def.skills.forEach((sk, idx) => {
      const passive = sk.cooldown <= 0;
      const bg = this.add
        .rectangle(sx + skillSlot / 2, skillY + skillSlot / 2, skillSlot, skillSlot, passive ? 0x424242 : 0x37474f, 0.95)
        .setStrokeStyle(2, passive ? 0x9e9e9e : 0x81d4fa, 0.9)
        .setScrollFactor(0)
        .setDepth(1000)
        .setInteractive({ useHandCursor: !passive });

      const keyLbl = this.add
        .text(sx + 10, skillY + 8, passive ? '—' : String(sk.keyIndex), {
          fontSize: '14px',
          color: '#fff59d',
        })
        .setScrollFactor(0)
        .setDepth(1001);

      const nameLbl = this.add
        .text(sx + skillSlot / 2, skillY + skillSlot / 2 + 6, passive ? '被动' : sk.name, {
          fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
          fontSize: '11px',
          color: '#eceff1',
          align: 'center',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(1001);

      const cdOverlay = this.add
        .rectangle(sx + skillSlot / 2, skillY + skillSlot / 2, skillSlot, skillSlot, 0x000000, 0.65)
        .setVisible(false)
        .setScrollFactor(0)
        .setDepth(1002);

      const cdText = this.add
        .text(sx + skillSlot / 2, skillY + skillSlot / 2, '', {
          fontSize: '14px',
          color: '#ffffff',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(1003);

      if (!passive) {
        bg.on('pointerdown', () => this.tryUseSkill(idx));
      }

      this.skillSlots.push({ bg, keyLbl, nameLbl, cdOverlay, cdText, index: idx });
      sx += skillSlot + skillGap;
    });

    const handY = VIEW_H - 92;
    const cardW = 58;
    const cardH = 78;
    const cardGap = 6;
    const totalHandW = GAME_CONFIG.handCardLimit * cardW + (GAME_CONFIG.handCardLimit - 1) * cardGap;
    let hx = VIEW_W / 2 - totalHandW / 2;

    for (let i = 0; i < GAME_CONFIG.handCardLimit; i++) {
      const c0 = this.hand[i];
      const fill0 = c0 ? 0x1b5e20 : 0x263238;
      const bg = this.add
        .rectangle(hx + cardW / 2, handY + cardH / 2, cardW, cardH, fill0, 0.92)
        .setStrokeStyle(1, 0x78909c, 0.8)
        .setScrollFactor(0)
        .setDepth(1000)
        .setInteractive({ useHandCursor: true });

      const initialName = c0 ? CARDS[c0].name : ' ';
      const label = this.add
        .text(hx + cardW / 2, handY + cardH / 2, initialName, {
          fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
          fontSize: '13px',
          color: '#eceff1',
          align: 'center',
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(1001);

      const slotIndex = i;
      bg.on('pointerdown', () => this.tryUseCard(slotIndex));

      this.handSlots.push({ bg, label, index: slotIndex });
      hx += cardW + cardGap;
    }

    this.markHandUiDirty();
  }

  private markHandUiDirty(): void {
    this.handUiDirty = true;
  }

  private flushHandUiIfDirty(): void {
    if (!this.handUiDirty || !this.handSlots.length) return;
    this.handUiDirty = false;
    this.handSlots.forEach((slot) => {
      if (!slot.label.active) return;
      const c = this.hand[slot.index];
      slot.label.setText(c ? CARDS[c].name : '空');
      slot.bg.setFillStyle(c ? 0x1b5e20 : 0x263238, 0.92);
    });
  }

  /** 手牌数据变更后调用；实际刷新在 update 中执行，避免 Phaser 4 create 阶段 setText 崩溃 */
  private syncHandUi(): void {
    this.markHandUiDirty();
  }

  private refreshHpBar(): void {
    const ratio = Phaser.Math.Clamp(this.currentHp / this.maxHp, 0, 1);
    const fullW = 220;
    this.hpBarFg.width = fullW * ratio;
    const low = ratio <= 0.25;
    this.hpBarFg.setFillStyle(low ? 0xd32f2f : 0x43a047, 1);
    this.hpText.setText(`${this.currentHp} / ${this.maxHp}`);
  }

  private updateEnemyCountText(): void {
    const alive = this.enemies.countActive(true);
    this.enemyLeftText.setText(`剩余敌人: ${alive}`);
  }

  private tryUseCard(slotIndex: number): void {
    if (this.isBattleOver) return;
    const c = this.hand[slotIndex];
    if (!c) return;

    if (c === 'sha') {
      const t = this.getNearestEnemy();
      if (!t) {
        this.flashTip('范围内没有敌人');
        return;
      }
      const dmg = Math.floor(8 * this.cardDamageMult);
      this.damageEnemy(t, dmg);
      this.spawnFloatText(t.x, t.y - 80, `-${dmg}`, 0xffab91);
    } else if (c === 'shan') {
      this.nextDamageIgnored = true;
      this.flashTip('闪：已准备抵消下一次伤害');
    } else if (c === 'tao') {
      const heal = 5;
      this.currentHp = Math.min(this.maxHp, this.currentHp + heal);
      this.refreshHpBar();
      this.spawnFloatText(this.player.x, this.player.y - 120, `+${heal}`, 0xa5d6a7);
    }

    this.hand[slotIndex] = null;
    this.syncHandUi();
  }

  private tryUseSkill(skillIdx: number): void {
    if (this.isBattleOver) return;
    const def = getHeroDef(this.heroId);
    if (!def || !def.skills[skillIdx]) return;
    const sk = def.skills[skillIdx];
    if (sk.cooldown <= 0) return;

    const now = this.time.now;
    if (now < this.skillCdEnd[skillIdx]) return;

    const id = sk.skillId;
    this.flashTip(sk.name);

    if (id === 'skill_longdan') {
      this.skillLongdan();
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_danji') {
      this.speedBuffUntil = now + 3000;
      this.speedMult = 1.3;
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_qitan') {
      this.skillQitan();
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_guanxing') {
      this.applyVulnerableAll(5000);
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_dongfeng') {
      this.spawnWindWall();
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_kongcheng') {
      this.invulnUntil = now + 1500;
      this.time.delayedCall(1500, () => {
        if (this.isBattleOver) return;
        this.currentHp = Math.min(this.maxHp, this.currentHp + 5);
        this.refreshHpBar();
        this.spawnFloatText(this.player.x, this.player.y - 100, '+5', 0xa5d6a7);
      });
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_bazhen') {
      this.spawnOrbs();
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_heduan') {
      this.skillHeduan();
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_paoxiao') {
      this.cardDamageMultUntil = now + 6000;
      this.cardDamageMult = 1.35;
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    } else if (id === 'skill_wanjun') {
      this.skillWanjun();
      this.skillCdEnd[skillIdx] = now + sk.cooldown * 1000;
    }
  }

  private skillLongdan(): void {
    const dir = this.player.flipX ? -1 : 1;
    const dist = 220;
    this.longdanHit.clear();
    this.tweens.add({
      targets: this.player,
      x: this.player.x + dir * dist,
      duration: 140,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.hitEnemiesInRadiusLongdan(52, 15);
      },
    });
  }

  private skillQitan(): void {
    const dir = this.player.flipX ? -1 : 1;
    const baseX = this.player.x + dir * 100;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 120, () => {
        this.enemies.getChildren().forEach((c) => {
          const e = c as Phaser.Physics.Arcade.Sprite;
          if (!e.active || e.getData('dying')) return;
          const dx = e.x - baseX;
          if (Math.sign(dx) !== dir) return;
          if (Math.abs(dx) < 200 && Math.abs(e.y - this.player.y) < 100) {
            this.damageEnemy(e, 10);
          }
        });
      });
    }
  }

  private hitEnemiesInRadiusLongdan(r: number, dmg: number): void {
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying') || this.longdanHit.has(e)) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < r + 60) {
        this.longdanHit.add(e);
        this.damageEnemy(e, dmg);
      }
    });
  }

  private applyVulnerableAll(ms: number): void {
    const until = this.time.now + ms;
    this.enemies.getChildren().forEach((c) => {
      (c as Phaser.Physics.Arcade.Sprite).setData('vulnUntil', until);
    });
    this.flashTip('观星：敌人易伤');
  }

  private spawnWindWall(): void {
    if (this.windWall) {
      this.windWallTick?.remove(false);
      this.windWall.destroy();
      this.windWall = undefined;
    }
    const h = 200;
    const w = 80;
    const wall = this.add.rectangle(100, FEET_Y - h / 2, w, h, 0x81d4fa, 0.35);
    wall.setStrokeStyle(2, 0xe1f5fe, 0.6);
    wall.setDepth(3);
    this.windWall = wall;

    this.tweens.add({
      targets: wall,
      x: this.worldW + 200,
      duration: 2200,
      ease: 'Linear',
      onComplete: () => {
        this.windWallTick?.remove(false);
        wall.destroy();
        if (this.windWall === wall) this.windWall = undefined;
      },
    });

    this.windWallTick = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (!wall.active) return;
        const wr = wall.getBounds();
        this.enemies.getChildren().forEach((c) => {
          const e = c as Phaser.Physics.Arcade.Sprite;
          if (!e.active || e.getData('dying')) return;
          const er = e.getBounds();
          if (Phaser.Geom.Intersects.RectangleToRectangle(wr, er)) {
            e.setData('stunUntil', this.time.now + 1000);
          }
        });
      },
    });
  }

  private spawnOrbs(): void {
    this.orbZones.forEach((o) => o.destroy());
    this.orbZones = [];
    this.orbHitAt.clear();
    for (let i = 0; i < 3; i++) {
      const arc = this.add.circle(this.player.x, this.player.y, 18, 0xffeb3b, 0.85);
      arc.setStrokeStyle(2, 0xfff59d, 1);
      arc.setDepth(5);
      this.orbZones.push(arc);
    }
    this.time.delayedCall(4500, () => {
      this.orbZones.forEach((o) => o.destroy());
      this.orbZones = [];
      this.orbHitAt.clear();
    });
  }

  private skillHeduan(): void {
    const dir = this.player.flipX ? -1 : 1;
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying')) return;
      const dx = e.x - this.player.x;
      if (Math.sign(dx) !== dir) return;
      if (Math.abs(dx) < 260 && Math.abs(e.y - this.player.y) < 120) {
        this.damageEnemy(e, 8);
        const body = e.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(dir * 280);
      }
    });
  }

  private skillWanjun(): void {
    this.tweens.add({
      targets: this.player,
      y: FEET_Y - 80,
      duration: 160,
      yoyo: true,
      ease: 'Sine.easeOut',
      onYoyo: () => {
        this.enemies.getChildren().forEach((c) => {
          const e = c as Phaser.Physics.Arcade.Sprite;
          if (!e.active || e.getData('dying')) return;
          const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
          if (d < 200) {
            this.damageEnemy(e, 20);
            e.setData('slowUntil', this.time.now + 2500);
          }
        });
      },
    });
  }

  private getNearestEnemy(): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestD = 1e9;
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying')) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, base: number): void {
    if (!enemy.active || enemy.getData('dying')) return;
    let m = 1;
    if (this.time.now < (enemy.getData('vulnUntil') as number)) {
      m *= 1.2;
    }
    const v = Math.max(1, Math.floor(base * m));
    const hp0 = (enemy.getData('hp') as number) ?? GAME_CONFIG.enemyMaxHp;
    const hp = hp0 - v;
    enemy.setData('hp', Math.max(0, hp));
    this.spawnFloatText(enemy.x, enemy.y - 70, `-${v}`, 0xffccbc);
    if (hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (enemy.getData('dying')) return;
    enemy.setData('dying', true);
    this.destroyEnemyHpBar(enemy);
    const b = enemy.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, 0);
    enemy.anims.stop();
    this.tweens.add({
      targets: enemy,
      alpha: 0.15,
      duration: 80,
      yoyo: true,
      onComplete: () => enemy.destroy(),
    });
    this.updateEnemyCountText();
    this.time.delayedCall(100, () => this.checkVictory());
  }

  private checkVictory(): void {
    if (this.isBattleOver) return;
    if (this.enemies.countActive(true) === 0) {
      this.endBattle(true);
    }
  }

  private onPlayerEnemyOverlap(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBattleOver || enemy.getData('dying')) return;
    const now = this.time.now;
    if (now < this.invulnUntil) return;
    if (now - this.lastEnemyHitMs < GAME_CONFIG.enemyContactCooldownMs) return;
    this.lastEnemyHitMs = now;

    let dmg = GAME_CONFIG.enemyContactDamage;
    if (this.nextDamageIgnored) {
      this.nextDamageIgnored = false;
      this.flashTip('闪：已抵消伤害');
      return;
    }

    this.currentHp -= dmg;
    this.refreshHpBar();
    this.spawnFloatText(this.player.x, this.player.y - 100, `-${dmg}`, 0xff8a80);
    this.cameras.main.shake(120, 0.004);

    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.refreshHpBar();
      this.endBattle(false);
    }
  }

  private damagePlayer(amount: number): void {
    if (this.isBattleOver) return;
    const now = this.time.now;
    if (now < this.invulnUntil) return;
    if (this.nextDamageIgnored) {
      this.nextDamageIgnored = false;
      this.flashTip('闪：已抵消伤害');
      return;
    }
    this.currentHp -= amount;
    this.refreshHpBar();
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      this.refreshHpBar();
      this.endBattle(false);
    }
  }

  private endBattle(win: boolean): void {
    if (this.isBattleOver) return;
    this.isBattleOver = true;

    const { width, height } = this.scale;
    const g = this.add.container(width / 2, height / 2);
    g.setScrollFactor(0);
    g.setDepth(3000);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setScrollFactor(0);
    const title = this.add
      .text(0, -40, win ? '胜利' : '战败', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '42px',
        color: win ? '#fff59d' : '#ef9a9a',
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 40, '点击任意处或按 R 返回英雄选择', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#eceff1',
      })
      .setOrigin(0.5);

    g.add([bg, title, hint]);
    this.gameEndContainer = g;

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'r' || ev.key === 'R') {
        this.input.keyboard?.off('keydown', onKey);
        this.scene.start('HeroDuelSelectScene');
      }
    };
    const back = () => {
      this.input.keyboard?.off('keydown', onKey);
      this.scene.start('HeroDuelSelectScene');
    };
    bg.setInteractive();
    bg.once('pointerdown', back);
    this.input.keyboard?.on('keydown', onKey);
  }

  private flashTip(msg: string): void {
    this.floatingTip.setText(msg);
    this.floatingTip.setAlpha(1);
    this.tweens.killTweensOf(this.floatingTip);
    this.tweens.add({
      targets: this.floatingTip,
      alpha: 0,
      delay: 500,
      duration: 600,
    });
  }

  private spawnFloatText(x: number, y: number, t: string, color: number): void {
    const tx = this.add
      .text(x, y, t, {
        fontSize: '20px',
        color: this.hexColor(color),
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50);
    this.tweens.add({
      targets: tx,
      y: y - 46,
      alpha: 0,
      duration: 700,
      onComplete: () => tx.destroy(),
    });
  }

  private hexColor(c: number): string {
    return '#' + c.toString(16).padStart(6, '0');
  }

  override update(_t: number, delta: number): void {
    this.flushHandUiIfDirty();
    if (this.isBattleOver) return;

    const now = this.time.now;
    if (now > this.speedBuffUntil) {
      this.speedMult = 1;
    }
    if (now > this.cardDamageMultUntil) {
      this.cardDamageMult = 1;
    }

    this.refillCountdown -= delta / 1000;
    if (this.refillCountdown <= 0) {
      this.refillHand();
      this.refillCountdown = GAME_CONFIG.refillInterval;
    }
    this.refillText.setText(`下次补牌: ${this.refillCountdown.toFixed(1)}s`);

    this.skillSlots.forEach((s, i) => {
      const left = Math.max(0, (this.skillCdEnd[i] - now) / 1000);
      const def = getHeroDef(this.heroId)?.skills[i];
      const passive = def && def.cooldown <= 0;
      if (passive) {
        s.cdOverlay.setVisible(false);
        return;
      }
      if (left > 0.05) {
        s.cdOverlay.setVisible(true);
        s.cdText.setText(left.toFixed(1));
      } else {
        s.cdOverlay.setVisible(false);
        s.cdText.setText('');
      }
    });

    let vx = 0;
    const base = 260 * this.speedMult;
    const joy = this.showTouchUi && this.joystickVec.length() > 0.08;
    if (joy) {
      vx = base * Phaser.Math.Clamp(this.joystickVec.x, -1, 1);
    } else {
      if (this.keyA?.isDown) vx -= base;
      if (this.keyD?.isDown) vx += base;
    }
    this.player.setVelocityX(vx);
    this.player.y = FEET_Y;

    if (vx < -4) this.player.setFlipX(true);
    else if (vx > 4) this.player.setFlipX(false);

    if (Math.abs(vx) > 4) {
      this.player.anims.play(this.walkAnimKey, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(this.frameWalkStart);
    }

    this.updateEnemies();
    this.syncEnemyHpBars();
    this.updateOrbs();

    this.flushHandUiIfDirty();
  }

  private refillHand(): void {
    let need = 0;
    for (let i = 0; i < this.hand.length; i++) {
      if (this.hand[i] === null) need++;
    }
    if (need === 0) return;
    const pool = GAME_CONFIG.globalCardPool;
    for (let i = 0; i < this.hand.length && need > 0; i++) {
      if (this.hand[i] === null) {
        this.hand[i] = Phaser.Math.RND.pick([...pool]);
        need--;
      }
    }
    this.syncHandUi();
  }

  private updateEnemies(): void {
    const now = this.time.now;
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying')) return;
      const body = e.body as Phaser.Physics.Arcade.Body;

      if (now < (e.getData('stunUntil') as number)) {
        body.setVelocityX(0);
        return;
      }

      if (e.getData('enemyAttacking')) {
        body.setVelocityX(0);
        return;
      }

      const slow = now < (e.getData('slowUntil') as number) ? 0.45 : 1;
      const toPlayer = this.player.x - e.x;
      const dir = Math.sign(toPlayer) || 1;
      const spd = 70 * slow;
      body.setVelocityX(dir * spd);
      e.setFlipX(dir < 0);
      e.play(ENEMY_WALK_KEY, true);

      const ad = Math.abs(toPlayer);
      if (ad < 52 && now > (e.getData('nextAttack') as number)) {
        e.setData('enemyAttacking', true);
        e.anims.stop();
        e.play(ENEMY_ATTACK_KEY);
        e.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (!e.active || e.getData('dying')) return;
          e.setData('enemyAttacking', false);
          e.play(ENEMY_WALK_KEY);
          const tn = this.time.now;
          e.setData('nextAttack', tn + Phaser.Math.Between(1600, 3200));
          const adNow = Math.abs(this.player.x - e.x);
          if (adNow < 58 && tn >= this.invulnUntil) {
            this.damagePlayer(5);
          }
        });
      }
    });
  }

  private updateOrbs(): void {
    if (this.orbZones.length === 0) return;
    const now = this.time.now;
    const r = 95;
    const spd = 3.2;
    this.orbZones.forEach((circle, i) => {
      this.orbAngles[i] += (spd * Math.PI) / 180;
      const a = this.orbAngles[i];
      circle.setPosition(this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r * 0.35);
    });

    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying')) return;
      for (const circle of this.orbZones) {
        const d = Phaser.Math.Distance.Between(circle.x, circle.y, e.x, e.y - 40);
        if (d < 42) {
          const last = this.orbHitAt.get(e) ?? 0;
          if (now - last > 550) {
            this.orbHitAt.set(e, now);
            this.damageEnemy(e, 12);
          }
        }
      }
    });
  }
}
