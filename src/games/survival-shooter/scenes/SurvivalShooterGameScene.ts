import * as Phaser from 'phaser';
import { getSurvivalShooterPlayClass, type SurvivalShooterPlayClass } from './SurvivalShooterSelectScene';
import { WARRIOR_WALK_BACKGROUND_FILES } from '../../warrior-walk/warrior-walk-background-manifest';

const WORLD_W = 4200;
const WORLD_H = 2800;
/** 人物更小 → 地图观感更大 */
const PLAYER_SCALE = 0.11;
const ENEMY_SCALE = 0.095;
const PLAYER_SPEED = 240;
const ENEMY_SPEED_MIN = 55;
const ENEMY_SPEED_MAX = 105;
const BULLET_SPEED = 560;
const FIRE_INTERVAL_MS = 220;
const ENEMY_HP = 2;
const MAX_ALIVE_ENEMIES = 48;
const SPAWN_BURST_MIN = 1;
const SPAWN_BURST_MAX = 3;
const SPAWN_EVERY_MS = 2000;
const PLAYER_MAX_HP = 100;
const CONTACT_DAMAGE = 12;
const CONTACT_COOLDOWN_MS = 650;
const HUOQIU_FLY_KEY = 'ss_huoqiu_fly';
const ENEMY_WALK_KEY = 'ss_enemy_walk';
/** 子弹与敌人用显示矩形检测（overlap 对普通 Group 内物体在 Phaser 4 下不可靠） */
const BULLET_HIT_INSET = 0.12;
const ENEMY_HIT_INSET_X = 0.08;
const ENEMY_HIT_INSET_Y = 0.06;

export class SurvivalShooterGameScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  /** 使用普通 Group（与 WarriorWalk 火球一致）；`physics.add.group` 在 Phaser 4 下会导致子物体速度无法积分 */
  private bullets!: Phaser.GameObjects.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private playClass: SurvivalShooterPlayClass = 'warrior';
  private walkTextureKey!: string;
  private walkAnimKey!: string;
  private frameWalkStart = 0;
  private frameWalkEnd = 4;
  private lastFireAt = 0;
  private lastFacing = new Phaser.Math.Vector2(1, 0);
  private playerHp = PLAYER_MAX_HP;
  private kills = 0;
  private gameOver = false;
  private nextSpawnAt = 0;
  private contactCooldownUntil = 0;
  private hpText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private showTouchUi = false;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private joystickRadius = 72;
  private joystickThumbRadius = 26;
  private joystickActiveId: number | null = null;
  private joystickVec = new Phaser.Math.Vector2(0, 0);
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private shootBtnCenterX = 0;
  private shootBtnCenterY = 0;
  private shootBtnRadius = 52;
  private shootBtnGfx!: Phaser.GameObjects.Arc;
  private uiContainer!: Phaser.GameObjects.Container;

  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyR!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'SurvivalShooterGameScene' });
  }

  create(): void {
    this.playClass = getSurvivalShooterPlayClass(this.registry);
    if (this.playClass === 'mage') {
      this.walkTextureKey = 'fashi_walk';
      this.walkAnimKey = 'ss_mage_walk';
    } else {
      this.walkTextureKey = 'warrior_walk';
      this.walkAnimKey = 'ss_warrior_walk';
    }

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.drawWorldBackdrop();

    if (!this.anims.exists(this.walkAnimKey)) {
      this.anims.create({
        key: this.walkAnimKey,
        frames: this.anims.generateFrameNumbers(this.walkTextureKey, {
          start: this.frameWalkStart,
          end: this.frameWalkEnd,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists(HUOQIU_FLY_KEY)) {
      this.anims.create({
        key: HUOQIU_FLY_KEY,
        frames: this.anims.generateFrameNumbers('huoqiu', { start: 0, end: 3 }),
        frameRate: 14,
        repeat: -1,
      });
    }
    if (!this.anims.exists(ENEMY_WALK_KEY)) {
      this.anims.create({
        key: ENEMY_WALK_KEY,
        frames: this.anims.generateFrameNumbers('ribenwushi', { start: 0, end: 1 }),
        frameRate: 7,
        repeat: -1,
      });
    }

    this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2, this.walkTextureKey, 0);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setOrigin(0.5, 0.85);
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    pb.setGravity(0, 0);
    pb.setDrag(0, 0);
    pb.setMaxVelocity(PLAYER_SPEED * 1.2, PLAYER_SPEED * 1.2);
    pb.setSize(100, 80);
    pb.setOffset(150, 240);
    pb.setCollideWorldBounds(true);

    this.bullets = this.add.group();
    this.enemies = this.physics.add.group();

    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      this.onEnemyTouchPlayer(e as Phaser.Physics.Arcade.Sprite);
    });

    const kb = this.input.keyboard;
    const goSelect = () => this.scene.start('SurvivalShooterSelectScene');
    if (kb) {
      this.keyW = kb.addKey('W');
      this.keyA = kb.addKey('A');
      this.keyS = kb.addKey('S');
      this.keyD = kb.addKey('D');
      this.cursors = kb.createCursorKeys();
      this.keyR = kb.addKey('R');
      this.keyR.on('down', goSelect);
    }

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(100, 80);

    this.showTouchUi = this.computeShowTouchUi();
    const hudHintBase =
      this.playClass === 'mage'
        ? 'WASD / 方向键移动 · 鼠标左键向光标射击 · 法师火球'
        : 'WASD / 方向键移动 · 鼠标左键向光标射击 · 武将斩击弹';
    const hudHint = this.showTouchUi
      ? '左下摇杆移动 · 右下「射」连续开火 · R 重选角色'
      : `${hudHintBase} · R 重选角色`;
    this.hintText = this.add
      .text(12, 10, hudHint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#eceff1',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(5000);

    this.hpText = this.add
      .text(12, 48, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#a5d6a7',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(5000);

    this.killsText = this.add
      .text(12, 82, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#ffcc80',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(5000);

    this.refreshHud();
    this.nextSpawnAt = this.time.now + 800;

    this.layoutTouchUi();
    this.scale.on('resize', this.layoutTouchUi, this);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('pointerupoutside', this.onPointerUp, this);
      this.scale.off('resize', this.layoutTouchUi, this);
      this.keyR?.off('down', goSelect);
    });
  }

  private computeShowTouchUi(): boolean {
    const w = this.scale.width;
    if (w <= 820) return true;
    const os = this.sys.game.device.os;
    return !!(os.android || os.iOS);
  }

  private layoutTouchUi(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.joystickCenterX = 108;
    this.joystickCenterY = h - 108;
    this.shootBtnCenterX = w - 100;
    this.shootBtnCenterY = h - 112;

    if (!this.uiContainer) {
      this.uiContainer = this.add.container(0, 0);
      this.uiContainer.setScrollFactor(0);
      this.uiContainer.setDepth(6000);

      this.joystickBase = this.add.circle(0, 0, this.joystickRadius, 0x000000, 0.35);
      this.joystickBase.setStrokeStyle(3, 0xffffff, 0.35);
      this.joystickThumb = this.add.circle(0, 0, this.joystickThumbRadius, 0xffffff, 0.42);
      this.joystickThumb.setStrokeStyle(2, 0xce93d8, 0.55);

      this.shootBtnGfx = this.add.circle(0, 0, this.shootBtnRadius, 0xb71c1c, 0.55);
      this.shootBtnGfx.setStrokeStyle(3, 0xffab91, 0.85);

      const shootLabel = this.add
        .text(0, 0, '射', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          color: '#fff3e0',
        })
        .setOrigin(0.5, 0.5);

      this.uiContainer.add([this.joystickBase, this.joystickThumb, this.shootBtnGfx, shootLabel]);
      shootLabel.setPosition(this.shootBtnCenterX, this.shootBtnCenterY);
    }

    this.joystickBase.setPosition(this.joystickCenterX, this.joystickCenterY);
    this.joystickThumb.setPosition(this.joystickCenterX, this.joystickCenterY);
    this.shootBtnGfx.setPosition(this.shootBtnCenterX, this.shootBtnCenterY);
    const children = this.uiContainer.list;
    const lbl = children[children.length - 1] as Phaser.GameObjects.Text;
    if (lbl?.setPosition) lbl.setPosition(this.shootBtnCenterX, this.shootBtnCenterY);

    const vis = this.showTouchUi;
    this.uiContainer.setVisible(vis);
    if (!vis) {
      this.joystickVec.set(0, 0);
      this.joystickActiveId = null;
    }
  }

  private isPointerOnShootButton(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.shootBtnCenterX, this.shootBtnCenterY) <= this.shootBtnRadius + 16;
  }

  private isPointerOnJoystick(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.joystickCenterX, this.joystickCenterY) <= this.joystickRadius + 36;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver || !this.showTouchUi) return;
    const px = pointer.x;
    const py = pointer.y;
    if (this.isPointerOnShootButton(px, py)) {
      this.tryFire(this.getMobileFireDirection());
      return;
    }
    if (this.isPointerOnJoystick(px, py)) {
      this.joystickActiveId = pointer.id;
      this.updateJoystickThumb(px, py);
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

  private updateJoystickThumb(px: number, py: number): void {
    const dx = px - this.joystickCenterX;
    const dy = py - this.joystickCenterY;
    const len = Math.hypot(dx, dy);
    const max = this.joystickRadius - 8;
    const nx = len > max ? (dx / len) * max : dx;
    const ny = len > max ? (dy / len) * max : dy;
    this.joystickThumb.setPosition(this.joystickCenterX + nx, this.joystickCenterY + ny);
    if (len < 6) {
      this.joystickVec.set(0, 0);
    } else {
      const inv = 1 / Math.max(len, 1);
      this.joystickVec.set(dx * inv, dy * inv);
    }
  }

  private getMobileFireDirection(): Phaser.Math.Vector2 {
    if (this.joystickVec.length() > 0.12) {
      return new Phaser.Math.Vector2(this.joystickVec.x, this.joystickVec.y).normalize();
    }
    return this.lastFacing.clone().normalize();
  }

  private drawWorldBackdrop(): void {
    const g = this.add.graphics();
    g.fillStyle(0x141022, 1);
    g.fillRect(0, 0, WORLD_W, WORLD_H);
    g.lineStyle(1, 0x2d2640, 0.45);
    const step = 96;
    for (let x = 0; x <= WORLD_W; x += step) {
      g.lineBetween(x, 0, x, WORLD_H);
    }
    for (let y = 0; y <= WORLD_H; y += step) {
      g.lineBetween(0, y, WORLD_W, y);
    }
    g.setDepth(-30);

    let ox = 0;
    for (let i = 0; i < WARRIOR_WALK_BACKGROUND_FILES.length; i++) {
      const key = `ww_bg_${i}`;
      if (!this.textures.exists(key)) continue;
      const frame = this.textures.get(key).get();
      const scale = (WORLD_H * 0.42) / frame.height;
      const w = frame.width * scale;
      this.add
        .image(ox + w / 2, WORLD_H * 0.36, key)
        .setScale(scale)
        .setAlpha(0.22)
        .setDepth(-25);
      ox += w;
      if (ox > WORLD_W) break;
    }
  }

  private tryFire(dir: Phaser.Math.Vector2): void {
    if (this.gameOver) return;
    const now = this.time.now;
    if (now - this.lastFireAt < FIRE_INTERVAL_MS) return;
    this.lastFireAt = now;
    if (dir.length() < 0.01) dir.set(1, 0);
    dir.normalize();

    // 用显示包围盒中心 + 世界坐标，避免 Phaser4/物理体与精灵原点不同步时子弹生在错误位置
    const origin = this.player.getCenter(new Phaser.Math.Vector2());
    const px = origin.x + dir.x * 42;
    const py = origin.y + dir.y * 28 - 18;

    const setupBullet = (b: Phaser.Physics.Arcade.Sprite, bb: Phaser.Physics.Arcade.Body): void => {
      b.setScrollFactor(1, 1);
      b.setOrigin(0.5, 0.5);
      bb.setAllowGravity(false);
      b.setRotation(Math.atan2(dir.y, dir.x));
      bb.setVelocity(dir.x * BULLET_SPEED, dir.y * BULLET_SPEED);
      this.bullets.add(b);
    };

    if (this.playClass === 'mage') {
      const b = this.physics.add.sprite(px, py, 'huoqiu', 0);
      b.setScale(0.1);
      b.setDepth(4);
      b.setData('kind', 'mage');
      b.play(HUOQIU_FLY_KEY);
      const bb = b.body as Phaser.Physics.Arcade.Body;
      const bw = Math.max(10, b.displayWidth * 0.65);
      const bh = Math.max(10, b.displayHeight * 0.65);
      bb.setSize(bw, bh);
      b.refreshBody();
      bb.reset(px, py);
      setupBullet(b, bb);
    } else {
      const b = this.physics.add.sprite(px, py, 'warrior_attack', 0);
      b.setScale(0.075);
      b.setDepth(4);
      b.setData('kind', 'warrior');
      const bb = b.body as Phaser.Physics.Arcade.Body;
      const bw = Math.max(10, b.displayWidth * 0.8);
      const bh = Math.max(10, b.displayHeight * 0.8);
      bb.setSize(bw, bh);
      b.refreshBody();
      bb.reset(px, py);
      setupBullet(b, bb);
    }
  }

  private applyBulletDamage(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || !enemy.active || enemy.getData('dead')) return;
    let hp = (enemy.getData('hp') as number) ?? ENEMY_HP;
    hp -= 1;
    enemy.setData('hp', hp);
    bullet.destroy();
    if (hp <= 0) {
      enemy.setData('dead', true);
      this.tweens.add({
        targets: enemy,
        alpha: 0,
        scale: enemy.scale * 0.4,
        duration: 120,
        onComplete: () => enemy.destroy(),
      });
      this.kills += 1;
      this.refreshHud();
    }
  }

  /** 每帧用渲染包围盒做命中判定（与 WarriorWalk 火球逻辑一致） */
  private checkBulletEnemyHitsByBounds(): void {
    const bulletChildren = this.bullets.getChildren();
    for (let bi = 0; bi < bulletChildren.length; bi++) {
      const bullet = bulletChildren[bi] as Phaser.Physics.Arcade.Sprite;
      if (!bullet.active) continue;

      const rb = bullet.getBounds();
      const ix = rb.width * BULLET_HIT_INSET;
      const iy = rb.height * BULLET_HIT_INSET;
      const hitRect = new Phaser.Geom.Rectangle(
        rb.x + ix,
        rb.y + iy,
        Math.max(6, rb.width - 2 * ix),
        Math.max(6, rb.height - 2 * iy),
      );

      for (const ec of this.enemies.getChildren()) {
        const enemy = ec as Phaser.Physics.Arcade.Sprite;
        if (!enemy.active || enemy.getData('dead')) continue;
        const eb = enemy.getBounds();
        const ex = eb.width * ENEMY_HIT_INSET_X;
        const ey = eb.height * ENEMY_HIT_INSET_Y;
        const enemyRect = new Phaser.Geom.Rectangle(
          eb.x + ex,
          eb.y + ey,
          Math.max(10, eb.width - 2 * ex),
          Math.max(10, eb.height - 2 * ey),
        );
        if (Phaser.Geom.Intersects.RectangleToRectangle(hitRect, enemyRect)) {
          this.applyBulletDamage(bullet, enemy);
          break;
        }
      }
    }
  }

  private onEnemyTouchPlayer(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.gameOver || !enemy.active || enemy.getData('dead')) return;
    const now = this.time.now;
    if (now < this.contactCooldownUntil) return;
    this.contactCooldownUntil = now + CONTACT_COOLDOWN_MS;
    this.playerHp -= CONTACT_DAMAGE;
    this.refreshHud();
    this.cameras.main.shake(120, 0.004);
    if (this.playerHp <= 0) {
      this.playerHp = 0;
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    const { width, height } = this.scale;
    this.add
      .rectangle(width / 2, height / 2, width + 4, height + 4, 0x000000, 0.62)
      .setScrollFactor(0)
      .setDepth(8000);
    this.add
      .text(width / 2, height / 2 - 24, '阵亡', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        color: '#ffab91',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(8001);
    this.add
      .text(width / 2, height / 2 + 28, `消灭 ${this.kills} 名武士 · 点击或按 R 返回`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#eceff1',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(8001);

    this.input.once('pointerdown', () => this.scene.start('SurvivalShooterSelectScene'));
  }

  private refreshHud(): void {
    this.hpText.setText(`生命 ${this.playerHp} / ${PLAYER_MAX_HP}`);
    this.killsText.setText(`击倒 ${this.kills}`);
  }

  private spawnEnemyOutsideCamera(): void {
    const cam = this.cameras.main;
    const m = 120;
    const edge = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;
    const vw = cam.width;
    const vh = cam.height;
    const sx = cam.scrollX;
    const sy = cam.scrollY;

    switch (edge) {
      case 0:
        x = sx + Phaser.Math.Between(-m - 220, vw + m + 220);
        y = sy - m - Phaser.Math.Between(40, 180);
        break;
      case 1:
        x = sx + vw + m + Phaser.Math.Between(40, 200);
        y = sy + Phaser.Math.Between(-m - 40, vh + m + 40);
        break;
      case 2:
        x = sx + Phaser.Math.Between(-m - 220, vw + m + 220);
        y = sy + vh + m + Phaser.Math.Between(40, 200);
        break;
      default:
        x = sx - m - Phaser.Math.Between(40, 200);
        y = sy + Phaser.Math.Between(-m - 40, vh + m + 40);
    }

    x = Phaser.Math.Clamp(x, 24, WORLD_W - 24);
    y = Phaser.Math.Clamp(y, 24, WORLD_H - 24);

    const e = this.physics.add.sprite(x, y, 'ribenwushi', 0);
    e.setScale(ENEMY_SCALE);
    e.setOrigin(0.5, 0.85);
    e.setDepth(2);
    e.setData('hp', ENEMY_HP);
    e.setData('dead', false);
    e.play(ENEMY_WALK_KEY);
    const eb = e.body as Phaser.Physics.Arcade.Body;
    eb.setAllowGravity(false);
    eb.setSize(110, 86);
    eb.setOffset(145, 248);
    this.enemies.add(e);
  }

  private updateEnemiesChase(): void {
    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active || e.getData('dead')) return;
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = Phaser.Math.FloatBetween(ENEMY_SPEED_MIN, ENEMY_SPEED_MAX);
      const vx = (dx / len) * spd;
      const vy = (dy / len) * spd;
      e.setVelocity(vx, vy);
      e.setFlipX(dx < 0);
    });
  }

  override update(_time: number, _delta: number): void {
    if (this.gameOver) return;

    let mx = 0;
    let my = 0;
    if (this.keyA?.isDown || this.cursors?.left.isDown) mx -= 1;
    if (this.keyD?.isDown || this.cursors?.right.isDown) mx += 1;
    if (this.keyW?.isDown || this.cursors?.up.isDown) my -= 1;
    if (this.keyS?.isDown || this.cursors?.down.isDown) my += 1;

    if (this.showTouchUi && this.joystickVec.length() > 0.08) {
      mx = this.joystickVec.x;
      my = this.joystickVec.y;
    }

    const len = Math.hypot(mx, my);
    if (len > 1e-6) {
      const nx = mx / len;
      const ny = my / len;
      this.player.setVelocity(nx * PLAYER_SPEED, ny * PLAYER_SPEED);
      this.lastFacing.set(nx, ny);
      if (Math.abs(mx) > 0.02) {
        this.player.setFlipX(mx < 0);
      }
      this.player.anims.play(this.walkAnimKey, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setFrame(this.frameWalkStart);
    }

    const ptr = this.input.activePointer;
    if (!this.showTouchUi && ptr.isDown && ptr.primaryDown) {
      const cam = this.cameras.main;
      const wp = cam.getWorldPoint(ptr.x, ptr.y);
      this.tryFire(new Phaser.Math.Vector2(wp.x - this.player.x, wp.y - this.player.y));
    }

    if (this.showTouchUi) {
      const mgr = this.input.manager;
      for (let i = 0; i < mgr.pointersTotal; i++) {
        const p = mgr.pointers[i];
        if (!p.active || !p.isDown) continue;
        if (this.isPointerOnShootButton(p.x, p.y)) {
          this.tryFire(this.getMobileFireDirection());
          break;
        }
      }
    }

    this.updateEnemiesChase();
    this.checkBulletEnemyHitsByBounds();

    const now = this.time.now;
    const enemyN = this.enemies.getChildren().length;
    if (now >= this.nextSpawnAt && enemyN < MAX_ALIVE_ENEMIES) {
      const burst = Phaser.Math.Between(SPAWN_BURST_MIN, SPAWN_BURST_MAX);
      for (let i = 0; i < burst; i++) {
        if (this.enemies.getChildren().length >= MAX_ALIVE_ENEMIES) break;
        this.spawnEnemyOutsideCamera();
      }
      this.nextSpawnAt = now + SPAWN_EVERY_MS;
    }

    this.bullets.getChildren().forEach((c) => {
      const b = c as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      if (b.x < -80 || b.y < -80 || b.x > WORLD_W + 80 || b.y > WORLD_H + 80) {
        b.destroy();
      }
    });
  }
}
