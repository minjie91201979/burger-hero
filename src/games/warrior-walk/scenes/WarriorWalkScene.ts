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

export class WarriorWalkScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ground!: Phaser.GameObjects.Rectangle;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
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

    this.enemies = this.physics.add.group();
    this.fireballs = this.add.group();
    this.spawnEnemies();
    this.physics.add.collider(this.player, this.enemies);

    this.input.on('pointerdown', this.onPointerDown, this);

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

    const hint =
      this.playClass === 'mage'
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
      this.physics?.world?.off('worldbounds', this.onWorldBounds);
      keyR?.off('down', onReselect);
    });
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

    if (!this.attacking && Phaser.Input.Keyboard.JustDown(this.keySpace) && onGround) {
      this.landPoseMs = 0;
      body.setVelocityY(JUMP_VELOCITY);
    }

    let vx = 0;
    if (!this.attacking) {
      if (this.keyA.isDown) vx -= MOVE_SPEED;
      if (this.keyD.isDown) vx += MOVE_SPEED;
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
