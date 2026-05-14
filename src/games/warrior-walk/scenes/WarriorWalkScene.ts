import * as Phaser from 'phaser';
import { getWarriorWalkPlayClass, type WarriorWalkPlayClass } from './WarriorWalkSelectScene';
import { WARRIOR_WALK_BACKGROUND_FILES } from '../warrior-walk-background-manifest';

/** 关卡最小宽度；实际宽度会取「背景一整轮拼接宽度」的整数倍，避免裁切半张图 */
const MIN_WORLD_W = 4800;
const WORLD_H = 720;
const GROUND_H = 120;
/** 角色脚底世界 Y；若与背景地平线不齐可微调（须 ≤ WORLD_H - GROUND_H） */
const FEET_WORLD_Y = 600;
const GROUND_CY = FEET_WORLD_Y + GROUND_H / 2;
const MOVE_SPEED = 280;
const JUMP_VELOCITY = -560;
const LAND_POSE_MS = 220;

/** 武将雪碧图帧 */
const W_FRAME_WALK_START = 0;
const W_FRAME_WALK_END = 4;
const W_FRAME_JUMP_AIR = 5;
const W_FRAME_LAND = 6;

/** 法师行走 6 帧：0–4 行走，5 空中，落地用 4 */
const M_FRAME_WALK_START = 0;
const M_FRAME_WALK_END = 4;
const M_FRAME_JUMP_AIR = 5;
const M_FRAME_LAND = 4;

const HUOQIU_FLY_KEY = 'huoqiu_fly_anim';
const HUOQIU_BOOM_KEY = 'huoqiu_boom_anim';
const FIREBALL_SPEED = 520;
const FIREBALL_SCALE = 0.272;
/** 火球命中判定相对 getBounds 每边内缩比例，避免贴图透明边提前触发爆炸 */
const FIREBALL_HIT_INSET = 0.18;

const ENEMY_WALK_KEY = 'enemy_walk';
const ENEMY_ATTACK_KEY = 'enemy_attack';
/** 玩家与敌人贴图缩放（略小便于看清场景） */
const PLAYER_SCALE = 0.304;
const ENEMY_SCALE = 0.304;
const ENEMY_SPAWN_MIN_X = 900;
const ENEMY_SPAWN_MARGIN_X = 250;
const ENEMY_SPAWN_COUNT_MIN = 8;
const ENEMY_SPAWN_COUNT_MAX = 15;
const WARRIOR_MELEE_REACH = 135;
/** 以当前重力与 JUMP_VELOCITY 估算的站立起跳最大升高（像素，略留余量） */
const MAX_STANDING_JUMP_DELTA_Y = 96;
/** 空中平台距地面的最小高度（避免贴地） */
const PLATFORM_MIN_ABOVE_GROUND = 34;

export class WarriorWalkScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ground!: Phaser.GameObjects.Rectangle;
  /** 随机空中平台（静态碰撞体） */
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keySpace?: Phaser.Input.Keyboard.Key;
  private wasOnFloor = true;
  private landPoseMs = 0;
  private attacking = false;
  private playClass: WarriorWalkPlayClass = 'warrior';
  private walkTextureKey!: string;
  private attackTextureKey!: string;
  private walkAnimKey!: string;
  private attackAnimKey!: string;
  private frameWalkStart!: number;
  private frameWalkEnd!: number;
  private frameJumpAir!: number;
  private frameLand!: number;
  private onWorldBounds!: (body: Phaser.Physics.Arcade.Body) => void;
  private enemies!: Phaser.Physics.Arcade.Group;
  /** 飞行中的火球（用于与敌人做显示区域相交检测，避免物理体与贴图错位导致穿模） */
  private fireballs!: Phaser.GameObjects.Group;
  private meleeHitThisSwing = new Set<Phaser.Physics.Arcade.Sprite>();
  private worldW = MIN_WORLD_W;

  private showTouchUi = false;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private joystickRadius = 64;
  private joystickThumbRadius = 22;
  private joystickActiveId: number | null = null;
  private joystickVec = new Phaser.Math.Vector2(0, 0);
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private jumpBtnCX = 0;
  private jumpBtnCY = 0;
  private jumpBtnR = 40;
  private attackBtnCX = 0;
  private attackBtnCY = 0;
  private attackBtnR = 40;
  private jumpBtnGfx!: Phaser.GameObjects.Arc;
  private attackBtnGfx!: Phaser.GameObjects.Arc;
  private jumpBtnLabel?: Phaser.GameObjects.Text;
  private attackBtnLabel?: Phaser.GameObjects.Text;
  /** 与键盘 A/D 对应的点按移动（可一手方向键、一手跳/攻） */
  private leftDirCX = 0;
  private leftDirCY = 0;
  private rightDirCX = 0;
  private rightDirCY = 0;
  private readonly dirPadR = 30;
  private leftDirGfx!: Phaser.GameObjects.Arc;
  private rightDirGfx!: Phaser.GameObjects.Arc;
  private leftDirLabel?: Phaser.GameObjects.Text;
  private rightDirLabel?: Phaser.GameObjects.Text;
  private mobileUi!: Phaser.GameObjects.Container;
  private mobileJumpQueued = false;

  constructor() {
    super({ key: 'WarriorWalkScene' });
  }

  create(): void {
    this.playClass = getWarriorWalkPlayClass(this.registry);

    if (this.playClass === 'mage') {
      this.walkTextureKey = 'fashi_walk';
      this.attackTextureKey = 'fashi_attack';
      this.walkAnimKey = 'mage_walk_anim';
      this.attackAnimKey = 'mage_attack_anim';
      this.frameWalkStart = M_FRAME_WALK_START;
      this.frameWalkEnd = M_FRAME_WALK_END;
      this.frameJumpAir = M_FRAME_JUMP_AIR;
      this.frameLand = M_FRAME_LAND;
    } else {
      this.walkTextureKey = 'warrior_walk';
      this.attackTextureKey = 'warrior_attack';
      this.walkAnimKey = 'warrior_walk_anim';
      this.attackAnimKey = 'warrior_attack_anim';
      this.frameWalkStart = W_FRAME_WALK_START;
      this.frameWalkEnd = W_FRAME_WALK_END;
      this.frameJumpAir = W_FRAME_JUMP_AIR;
      this.frameLand = W_FRAME_LAND;
    }

    this.worldW = this.layoutBackgroundWidthAndTiles();

    this.physics.world.setBounds(0, 0, this.worldW, WORLD_H);

    this.ground = this.add.rectangle(this.worldW / 2, GROUND_CY, this.worldW, GROUND_H, 0x4e342e, 0);
    this.physics.add.existing(this.ground, true);

    if (this.textures.exists('road_ground')) {
      const frame = this.textures.get('road_ground').get();
      const tileS = GROUND_H / frame.height;
      const road = this.add.tileSprite(this.worldW / 2, GROUND_CY, this.worldW, GROUND_H, 'road_ground');
      road.setOrigin(0.5, 0.5);
      road.setDepth(-8);
      road.setTileScale(tileS, tileS);
    } else {
      this.ground.setFillStyle(0x4e342e, 1);
      this.add.rectangle(this.worldW / 2, GROUND_CY - 24, this.worldW, 8, 0xffb74d, 0.35);
    }

    this.spawnAirPlatforms();

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
    if (!this.anims.exists(this.attackAnimKey)) {
      this.anims.create({
        key: this.attackAnimKey,
        frames: this.anims.generateFrameNumbers(this.attackTextureKey, { start: 0, end: 3 }),
        frameRate: 14,
        repeat: 0,
      });
    }
    if (!this.anims.exists(HUOQIU_FLY_KEY)) {
      this.anims.create({
        key: HUOQIU_FLY_KEY,
        frames: this.anims.generateFrameNumbers('huoqiu', { start: 0, end: 3 }),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists(HUOQIU_BOOM_KEY)) {
      this.anims.create({
        key: HUOQIU_BOOM_KEY,
        frames: this.anims.generateFrameNumbers('huoqiu', { start: 4, end: 7 }),
        frameRate: 18,
        repeat: 0,
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

    const startX = 640;
    this.player = this.physics.add.sprite(startX, GROUND_CY - GROUND_H / 2 - 8, this.walkTextureKey, 0);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setOrigin(0.5, 1);
    this.player.setY(GROUND_CY - GROUND_H / 2);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(1600);
    body.setMaxVelocity(420, 2000);
    body.setSize(140, 168);
    body.setOffset(130, 200);

    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platforms);

    this.enemies = this.physics.add.group();
    this.fireballs = this.add.group();
    this.spawnEnemies();
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.player, this.enemies);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.layoutMobileControls();
    this.scale.on('resize', this.layoutMobileControls, this);

    this.onWorldBounds = (b: Phaser.Physics.Arcade.Body) => {
      const go = b.gameObject as Phaser.Physics.Arcade.Sprite | undefined;
      if (go?.getData('isFireball')) {
        this.explodeFireball(go);
      }
    };
    this.physics.world.on('worldbounds', this.onWorldBounds);

    const kb = this.input.keyboard;
    if (kb) {
      this.keyA = kb.addKey('A');
      this.keyD = kb.addKey('D');
      this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    this.cameras.main.setBounds(0, 0, this.worldW, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(180, 80);

    this.showTouchUi = this.computeShowTouchUi();
    const hint = this.showTouchUi
      ? '摇杆或 ◀▶ 左右 · 「跳」「攻」· R 重选'
      : this.playClass === 'mage'
        ? 'A 向左 · D 向右 · 空格跳跃 · 左键攻击（发射火球） · R 重选角色'
        : 'A 向左 · D 向右 · 空格跳跃 · 鼠标左键攻击 · R 重选角色';
    this.add
      .text(24, 20, hint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#eceff1',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    const keyR = this.input.keyboard?.addKey('R');
    const onReselect = () => {
      this.scene.start('WarriorWalkSelectScene');
    };
    keyR?.on('down', onReselect);

    this.events.once('shutdown', () => {
      this.input?.off('pointerdown', this.onPointerDown, this);
      this.input?.off('pointermove', this.onPointerMove, this);
      this.input?.off('pointerup', this.onPointerUp, this);
      this.input?.off('pointerupoutside', this.onPointerUp, this);
      this.scale?.off('resize', this.layoutMobileControls, this);
      this.physics?.world?.off('worldbounds', this.onWorldBounds);
      keyR?.off('down', onReselect);
    });
  }

  private computeShowTouchUi(): boolean {
    const w = this.scale.width;
    if (w <= 900) return true;
    const os = this.sys.game.device.os;
    return !!(os.android || os.iOS);
  }

  private layoutMobileControls(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.joystickCenterX = 96;
    this.joystickCenterY = h - 88;
    this.leftDirCX = 52;
    this.leftDirCY = h - 168;
    this.rightDirCX = 140;
    this.rightDirCY = h - 168;
    this.jumpBtnCX = w - 168;
    this.jumpBtnCY = h - 96;
    this.attackBtnCX = w - 72;
    this.attackBtnCY = h - 96;

    if (!this.mobileUi) {
      this.mobileUi = this.add.container(0, 0);
      this.mobileUi.setScrollFactor(0);
      this.mobileUi.setDepth(250);

      this.leftDirGfx = this.add
        .circle(0, 0, this.dirPadR, 0x0d47a1, 0.48)
        .setStrokeStyle(2, 0x90caf9, 0.65);
      this.rightDirGfx = this.add
        .circle(0, 0, this.dirPadR, 0x0d47a1, 0.48)
        .setStrokeStyle(2, 0x90caf9, 0.65);
      this.leftDirLabel = this.add
        .text(0, 0, '◀', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#e3f2fd' })
        .setOrigin(0.5, 0.5);
      this.rightDirLabel = this.add
        .text(0, 0, '▶', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#e3f2fd' })
        .setOrigin(0.5, 0.5);

      this.joystickBase = this.add
        .circle(0, 0, this.joystickRadius, 0x000000, 0.32)
        .setStrokeStyle(2, 0xffffff, 0.35);
      this.joystickThumb = this.add
        .circle(0, 0, this.joystickThumbRadius, 0xffffff, 0.4)
        .setStrokeStyle(2, 0x90caf9, 0.55);
      this.jumpBtnGfx = this.add.circle(0, 0, this.jumpBtnR, 0x1565c0, 0.55).setStrokeStyle(2, 0xbbdefb, 0.85);
      this.attackBtnGfx = this.add.circle(0, 0, this.attackBtnR, 0xc62828, 0.55).setStrokeStyle(2, 0xffccbc, 0.85);
      this.jumpBtnLabel = this.add
        .text(0, 0, '跳', { fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#e3f2fd' })
        .setOrigin(0.5, 0.5);
      this.attackBtnLabel = this.add
        .text(0, 0, '攻', { fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#fff3e0' })
        .setOrigin(0.5, 0.5);
      this.mobileUi.add([
        this.leftDirGfx,
        this.rightDirGfx,
        this.leftDirLabel,
        this.rightDirLabel,
        this.joystickBase,
        this.joystickThumb,
        this.jumpBtnGfx,
        this.attackBtnGfx,
        this.jumpBtnLabel,
        this.attackBtnLabel,
      ]);
    }

    this.leftDirGfx.setPosition(this.leftDirCX, this.leftDirCY);
    this.rightDirGfx.setPosition(this.rightDirCX, this.rightDirCY);
    this.leftDirLabel?.setPosition(this.leftDirCX, this.leftDirCY);
    this.rightDirLabel?.setPosition(this.rightDirCX, this.rightDirCY);
    this.joystickBase.setPosition(this.joystickCenterX, this.joystickCenterY);
    this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
    this.jumpBtnGfx.setPosition(this.jumpBtnCX, this.jumpBtnCY);
    this.attackBtnGfx.setPosition(this.attackBtnCX, this.attackBtnCY);
    this.jumpBtnLabel?.setPosition(this.jumpBtnCX, this.jumpBtnCY);
    this.attackBtnLabel?.setPosition(this.attackBtnCX, this.attackBtnCY);

    this.mobileUi.setVisible(this.showTouchUi);
    if (!this.showTouchUi) {
      this.joystickVec.set(0, 0);
      this.joystickActiveId = null;
    }
  }

  private isPointerOnLeftDirPad(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.leftDirCX, this.leftDirCY) <= this.dirPadR + 14;
  }

  private isPointerOnRightDirPad(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.rightDirCX, this.rightDirCY) <= this.dirPadR + 14;
  }

  private isPointerOnJoystick(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.joystickCenterX, this.joystickCenterY) <= this.joystickRadius + 32;
  }

  private isPointerOnJump(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.jumpBtnCX, this.jumpBtnCY) <= this.jumpBtnR + 12;
  }

  private isPointerOnAttack(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.attackBtnCX, this.attackBtnCY) <= this.attackBtnR + 12;
  }

  private updateJoystickThumb(px: number, py: number): void {
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

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.joystickActiveId !== pointer.id) return;
    this.updateJoystickThumb(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.joystickActiveId === pointer.id) {
      this.joystickActiveId = null;
      this.joystickVec.set(0, 0);
      this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
    }
  }

  /** 多点触摸：统计当前落在 ◀ ▶ 上的指针，供 update 与键盘 A/D 合并 */
  private touchDirPadSign(): number {
    if (!this.showTouchUi) return 0;
    const mgr = this.input.manager;
    let d = 0;
    for (let i = 0; i < mgr.pointersTotal; i++) {
      const p = mgr.pointers[i];
      if (!p.active || !p.isDown) continue;
      if (this.isPointerOnLeftDirPad(p.x, p.y)) d -= 1;
      if (this.isPointerOnRightDirPad(p.x, p.y)) d += 1;
    }
    return Phaser.Math.Clamp(d, -1, 1);
  }

  /**
   * 在世界中随机放置空中平台；顶面高度限制在「站立起跳」可达范围内，保证能从地面跳上去。
   */
  private spawnAirPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    const groundSurfaceY = GROUND_CY - GROUND_H / 2;
    const minSurfaceY = groundSurfaceY - MAX_STANDING_JUMP_DELTA_Y;
    const maxSurfaceYDefault = groundSurfaceY - PLATFORM_MIN_ABOVE_GROUND;

    const minX = 380;
    const maxX = this.worldW - 320;
    const count = Phaser.Math.Clamp(Math.floor(this.worldW / 700), 4, 20);

    const occupied: Phaser.Geom.Rectangle[] = [];

    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let t = 0; t < 16 && !placed; t++) {
        const pw = Phaser.Math.Between(90, 170);
        const ph = Phaser.Math.Between(14, 26);
        const maxSurfaceY = Math.min(maxSurfaceYDefault, groundSurfaceY - ph - 8);
        if (maxSurfaceY < minSurfaceY) {
          continue;
        }
        const surfaceY = Phaser.Math.Between(minSurfaceY, maxSurfaceY);
        const cx = Phaser.Math.Between(minX + Math.floor(pw / 2), maxX - Math.floor(pw / 2));
        const cy = surfaceY + ph / 2;

        const padX = 48;
        const padY = 20;
        const probe = new Phaser.Geom.Rectangle(
          cx - pw / 2 - padX,
          surfaceY - padY,
          pw + padX * 2,
          ph + padY * 2,
        );
        if (occupied.some((r) => Phaser.Geom.Intersects.RectangleToRectangle(r, probe))) {
          continue;
        }

        // 出生点附近少放高处台子，避免开局挡路
        if (cx > 260 && cx < 1100 && surfaceY < groundSurfaceY - 55) {
          continue;
        }

        const colors = [0x6d4c41, 0x5d4037, 0x4e342e, 0x795548, 0x8d6e63];
        const plat = this.add.rectangle(cx, cy, pw, ph, Phaser.Math.RND.pick(colors), 0.93);
        plat.setStrokeStyle(2, 0xffe0b2, 0.5);
        plat.setDepth(-4);

        this.physics.add.existing(plat, true);
        this.platforms.add(plat);

        occupied.push(probe);
        placed = true;
      }
    }
  }

  /**
   * 将 `background-manifest` 中的图按高度铺满 WORLD_H，横向循环拼接；返回世界宽度（≥ MIN_WORLD_W 且为整轮拼贴）。
   */
  private layoutBackgroundWidthAndTiles(): number {
    const segments: { key: string; w: number; scale: number }[] = [];
    for (let i = 0; i < WARRIOR_WALK_BACKGROUND_FILES.length; i++) {
      const key = `ww_bg_${i}`;
      if (!this.textures.exists(key)) continue;
      const frame = this.textures.get(key).get();
      const srcH = frame.height;
      const scale = WORLD_H / srcH;
      const w = frame.width * scale;
      segments.push({ key, w, scale });
    }

    if (segments.length === 0) {
      this.add
        .rectangle(MIN_WORLD_W / 2, WORLD_H / 2, MIN_WORLD_W, WORLD_H, 0x1a237e, 1)
        .setDepth(-20);
      this.add
        .rectangle(MIN_WORLD_W / 2, WORLD_H * 0.35, MIN_WORLD_W, WORLD_H * 0.7, 0x283593, 0.45)
        .setDepth(-19);
      return MIN_WORLD_W;
    }

    const patternW = segments.reduce((a, s) => a + s.w, 0);
    const repetitions = Math.max(1, Math.ceil(MIN_WORLD_W / patternW));
    const worldW = repetitions * patternW;

    let x = 0;
    for (let r = 0; r < repetitions; r++) {
      for (const seg of segments) {
        this.add.image(x, WORLD_H, seg.key).setOrigin(0, 1).setScale(seg.scale).setDepth(-20);
        x += seg.w;
      }
    }

    return worldW;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.showTouchUi) {
      const px = pointer.x;
      const py = pointer.y;
      if (this.isPointerOnJump(px, py)) {
        this.mobileJumpQueued = true;
        return;
      }
      if (this.isPointerOnAttack(px, py)) {
        this.tryAttack();
        return;
      }
      if (this.isPointerOnLeftDirPad(px, py) || this.isPointerOnRightDirPad(px, py)) {
        return;
      }
      if (this.isPointerOnJoystick(px, py)) {
        this.joystickActiveId = pointer.id;
        this.updateJoystickThumb(px, py);
        return;
      }
      return;
    }
    if (!pointer.leftButtonDown()) return;
    this.tryAttack();
  }

  private tryAttack(): void {
    if (this.attacking) return;
    this.meleeHitThisSwing.clear();
    this.attacking = true;
    this.landPoseMs = 0;
    this.player.anims.stop();
    this.player.setTexture(this.attackTextureKey, 0);
    this.player.once(`animationcomplete-${this.attackAnimKey}`, () => {
      if (this.playClass === 'mage') {
        this.spawnFireball();
      }
      this.finishAttack();
    });
    this.player.play(this.attackAnimKey);
  }

  private finishAttack(): void {
    this.attacking = false;
    this.player.anims.stop();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.onFloor();
    this.player.setTexture(this.walkTextureKey, onGround ? this.frameWalkStart : this.frameJumpAir);
  }

  private spawnFireball(): void {
    const dir = this.player.flipX ? -1 : 1;
    const sx = this.player.x + dir * 72;
    const sy = this.player.y - 100;

    const fb = this.physics.add.sprite(sx, sy, 'huoqiu', 0);
    fb.setDepth(2);
    fb.setScale(FIREBALL_SCALE);
    fb.setFlipX(dir < 0);
    fb.setData('isFireball', true);
    fb.setData('exploding', false);
    fb.setData('canHitPlayer', false);
    fb.play(HUOQIU_FLY_KEY);
    this.fireballs.add(fb);

    const fbBody = fb.body as Phaser.Physics.Arcade.Body;
    fbBody.setAllowGravity(false);
    const bw = Math.max(36, Math.round(fb.displayWidth * 0.72));
    const bh = Math.max(36, Math.round(fb.displayHeight * 0.72));
    fbBody.setSize(bw, bh);
    fb.refreshBody();
    fbBody.setVelocity(dir * FIREBALL_SPEED, 0);
    fb.setCollideWorldBounds(true);
    fbBody.onWorldBounds = true;

    this.time.delayedCall(160, () => {
      if (fb.active) fb.setData('canHitPlayer', true);
    });

    const groundCol = this.physics.add.collider(fb, this.ground, () => {
      this.explodeFireball(fb);
    });
    fb.setData('groundCol', groundCol);

    const platCol = this.physics.add.collider(fb, this.platforms, () => {
      this.explodeFireball(fb);
    });
    fb.setData('platCol', platCol);

    const playerOverlap = this.physics.add.overlap(fb, this.player, () => {
      if (fb.getData('canHitPlayer')) {
        this.explodeFireball(fb);
      }
    });
    fb.setData('playerOverlap', playerOverlap);
  }

  private explodeFireball(fb: Phaser.Physics.Arcade.Sprite): void {
    if (!fb.active || fb.getData('exploding')) return;
    fb.setData('exploding', true);

    const gc = fb.getData('groundCol') as Phaser.Physics.Arcade.Collider | undefined;
    gc?.destroy();
    const plc = fb.getData('platCol') as Phaser.Physics.Arcade.Collider | undefined;
    plc?.destroy();
    const po = fb.getData('playerOverlap') as Phaser.Physics.Arcade.Collider | undefined;
    po?.destroy();

    this.fireballs.remove(fb, false, false);

    fb.setCollideWorldBounds(false);
    const b = fb.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, 0);
    b.setEnable(false);

    fb.anims.stop();
    fb.play(HUOQIU_BOOM_KEY);
    fb.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      fb.destroy();
    });
  }

  private spawnEnemies(): void {
    const n = Phaser.Math.Between(ENEMY_SPAWN_COUNT_MIN, ENEMY_SPAWN_COUNT_MAX);
    const usedX: number[] = [];
    for (let i = 0; i < n; i++) {
      const maxX = Math.max(ENEMY_SPAWN_MIN_X + 1, this.worldW - ENEMY_SPAWN_MARGIN_X);
      let x = Phaser.Math.Between(ENEMY_SPAWN_MIN_X, maxX);
      for (let tries = 0; tries < 8; tries++) {
        if (!usedX.some((ux) => Math.abs(ux - x) < 72)) break;
        x = Phaser.Math.Between(ENEMY_SPAWN_MIN_X, maxX);
      }
      usedX.push(x);

      const e = this.physics.add.sprite(x, GROUND_CY - GROUND_H / 2, 'ribenwushi', 0);
      e.setOrigin(0.5, 1);
      e.setScale(ENEMY_SCALE);
      e.setDepth(1);
      e.setData('isEnemy', true);
      e.setData('dying', false);
      e.setData('enemyAttacking', false);
      const dir = Math.random() < 0.5 ? -1 : 1;
      e.setData('patrolDir', dir);
      e.setData('patrolSpeed', Phaser.Math.Between(45, 95));
      e.setData('nextTurn', this.time.now + Phaser.Math.Between(1600, 3800));
      e.setData('nextAttackTime', this.time.now + Phaser.Math.Between(1800, 4800));
      e.play(ENEMY_WALK_KEY);
      e.setFlipX(dir < 0);

      const eb = e.body as Phaser.Physics.Arcade.Body;
      eb.setGravityY(1600);
      eb.setMaxVelocity(220, 2000);
      eb.setSize(130, 165);
      eb.setOffset(135, 205);
      eb.setVelocityX((e.getData('patrolSpeed') as number) * dir);

      this.physics.add.collider(e, this.ground);
      this.enemies.add(e);
    }
  }

  private hitEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active || enemy.getData('dying')) return;
    enemy.setData('dying', true);
    enemy.setData('enemyAttacking', false);
    const b = enemy.body as Phaser.Physics.Arcade.Body;
    b.setVelocity(0, 0);
    b.setEnable(false);
    enemy.anims.stop();

    this.tweens.add({
      targets: enemy,
      alpha: { from: 1, to: 0.2 },
      duration: 70,
      yoyo: true,
      repeat: 0,
      onComplete: () => {
        enemy.destroy();
      },
    });
  }

  private isWarriorMeleeHit(enemy: Phaser.Physics.Arcade.Sprite): boolean {
    const anim = this.player.anims.currentAnim;
    const frame = this.player.anims.currentFrame;
    if (!anim || anim.key !== this.attackAnimKey || !frame) return false;
    if (frame.index < 1 || frame.index > 2) return false;

    const dy = Math.abs(enemy.y - this.player.y);
    if (dy > 130) return false;
    const dx = enemy.x - this.player.x;
    const reach = WARRIOR_MELEE_REACH;
    if (this.player.flipX) {
      return dx <= 35 && dx >= -reach;
    }
    return dx >= -35 && dx <= reach;
  }

  private checkWarriorMeleeHits(): void {
    this.enemies.getChildren().forEach((c) => {
      const enemy = c as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active || enemy.getData('dying')) return;
      if (this.meleeHitThisSwing.has(enemy)) return;
      if (!this.isWarriorMeleeHit(enemy)) return;
      this.meleeHitThisSwing.add(enemy);
      this.hitEnemy(enemy);
    });
  }

  /**
   * 用火球与敌人的渲染矩形相交判断（每帧开头执行）。双方 getBounds 均做内缩，减少透明像素导致的「未碰到就炸」。
   */
  private checkFireballEnemyHitsByBounds(): void {
    this.fireballs.getChildren().forEach((child) => {
      const fb = child as Phaser.Physics.Arcade.Sprite;
      if (!fb.active || fb.getData('exploding') || !fb.getData('isFireball')) return;

      const rb = fb.getBounds();
      const ix = rb.width * FIREBALL_HIT_INSET;
      const iy = rb.height * FIREBALL_HIT_INSET;
      const hitRect = new Phaser.Geom.Rectangle(
        rb.x + ix,
        rb.y + iy,
        Math.max(8, rb.width - 2 * ix),
        Math.max(8, rb.height - 2 * iy),
      );

      for (const ec of this.enemies.getChildren()) {
        const enemy = ec as Phaser.Physics.Arcade.Sprite;
        if (!enemy.active || enemy.getData('dying')) continue;
        const eb = enemy.getBounds();
        const ex = eb.width * 0.06;
        const ey = eb.height * 0.04;
        const re = new Phaser.Geom.Rectangle(
          eb.x + ex,
          eb.y + ey,
          Math.max(12, eb.width - 2 * ex),
          Math.max(12, eb.height - 2 * ey),
        );
        if (Phaser.Geom.Intersects.RectangleToRectangle(hitRect, re)) {
          this.hitEnemy(enemy);
          this.explodeFireball(fb);
          return;
        }
      }
    });
  }

  private updateEnemies(): void {
    const now = this.time.now;
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dying')) return;
      const body = e.body as Phaser.Physics.Arcade.Body;

      if (e.getData('enemyAttacking')) {
        body.setVelocityX(0);
        return;
      }

      const spd = e.getData('patrolSpeed') as number;
      const dir = e.getData('patrolDir') as number;
      body.setVelocityX(spd * dir);
      e.setFlipX(dir < 0);

      if (now > (e.getData('nextTurn') as number)) {
        e.setData('patrolDir', -dir);
        e.setData('nextTurn', now + Phaser.Math.Between(1600, 4000));
      }

      if (now > (e.getData('nextAttackTime') as number)) {
        e.setData('enemyAttacking', true);
        e.anims.stop();
        e.play(ENEMY_ATTACK_KEY);
        e.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (!e.active || e.getData('dying')) return;
          e.setData('enemyAttacking', false);
          e.play(ENEMY_WALK_KEY);
          e.setData('nextAttackTime', this.time.now + Phaser.Math.Between(2200, 5600));
        });
      }
    });
  }

  override update(_time: number, delta: number): void {
    this.updateEnemies();
    this.checkFireballEnemyHitsByBounds();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.onFloor();

    const spaceJump = this.keySpace ? Phaser.Input.Keyboard.JustDown(this.keySpace) : false;
    if (!this.attacking && onGround && (spaceJump || this.mobileJumpQueued)) {
      this.landPoseMs = 0;
      body.setVelocityY(JUMP_VELOCITY);
      this.mobileJumpQueued = false;
    }

    let vx = 0;
    if (!this.attacking) {
      const joyActive = this.showTouchUi && this.joystickVec.length() > 0.08;
      const padSign = this.touchDirPadSign();
      if (joyActive) {
        vx = MOVE_SPEED * Phaser.Math.Clamp(this.joystickVec.x, -1, 1);
      } else {
        if (this.keyA?.isDown || padSign < 0) vx -= MOVE_SPEED;
        if (this.keyD?.isDown || padSign > 0) vx += MOVE_SPEED;
      }
    }
    this.player.setVelocityX(vx);

    if (this.attacking && this.playClass === 'warrior') {
      this.checkWarriorMeleeHits();
    }

    if (!this.attacking) {
      if (vx < -4) {
        this.player.setFlipX(true);
      } else if (vx > 4) {
        this.player.setFlipX(false);
      }
    }

    if (this.attacking) {
      return;
    }

    const landed = onGround && !this.wasOnFloor;
    this.wasOnFloor = onGround;
    if (landed) {
      this.landPoseMs = LAND_POSE_MS;
    }

    if (this.landPoseMs > 0) {
      this.landPoseMs = Math.max(0, this.landPoseMs - delta);
      this.player.anims.stop();
      this.player.setFrame(this.frameLand);
      return;
    }

    if (!onGround) {
      this.player.anims.stop();
      this.player.setFrame(this.frameJumpAir);
      return;
    }

    if (Math.abs(vx) > 4) {
      this.player.anims.play(this.walkAnimKey, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(this.frameWalkStart);
    }
  }
}
