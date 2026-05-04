import * as Phaser from 'phaser';

const WORLD_W = 4800;
const WORLD_H = 720;
const GROUND_H = 120;
const GROUND_CY = WORLD_H - GROUND_H / 2;
const MOVE_SPEED = 280;
/** 起跳初速度（像素/秒，Arcade Y 轴向上为负） */
const JUMP_VELOCITY = -560;
/** 雪碧图帧：与 `WarriorWalkPreloadScene` 中 400×400 切分一致 */
const FRAME_WALK_START = 0;
const FRAME_WALK_END = 4;
const FRAME_JUMP_AIR = 5;
const FRAME_LAND = 6;
/** 落地_pose 持续毫秒，再切回行走/待机 */
const LAND_POSE_MS = 220;
const ATTACK_ANIM_KEY = 'warrior_attack_anim';

export class WarriorWalkScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ground!: Phaser.GameObjects.Rectangle;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private wasOnFloor = true;
  private landPoseMs = 0;
  private attacking = false;

  constructor() {
    super({ key: 'WarriorWalkScene' });
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // 远景渐变
    this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x1a237e, 1)
      .setDepth(-2);
    this.add
      .rectangle(WORLD_W / 2, WORLD_H * 0.35, WORLD_W, WORLD_H * 0.7, 0x283593, 0.45)
      .setDepth(-1);

    // 地面装饰带
    this.add.rectangle(WORLD_W / 2, GROUND_CY - 24, WORLD_W, 8, 0xffb74d, 0.35);
    this.ground = this.add.rectangle(WORLD_W / 2, GROUND_CY, WORLD_W, GROUND_H, 0x4e342e);
    this.physics.add.existing(this.ground, true);

    if (!this.anims.exists('warrior_walk_anim')) {
      this.anims.create({
        key: 'warrior_walk_anim',
        frames: this.anims.generateFrameNumbers('warrior_walk', {
          start: FRAME_WALK_START,
          end: FRAME_WALK_END,
        }),
        frameRate: 11,
        repeat: -1,
      });
    }
    if (!this.anims.exists(ATTACK_ANIM_KEY)) {
      this.anims.create({
        key: ATTACK_ANIM_KEY,
        frames: this.anims.generateFrameNumbers('warrior_attack', { start: 0, end: 3 }),
        frameRate: 14,
        repeat: 0,
      });
    }

    const startX = 640;
    const scale = 0.48;
    this.player = this.physics.add.sprite(startX, GROUND_CY - GROUND_H / 2 - 8, 'warrior_walk', 0);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(scale);
    this.player.setOrigin(0.5, 1);
    this.player.setY(GROUND_CY - GROUND_H / 2);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(1600);
    body.setMaxVelocity(420, 2000);
    body.setSize(140, 168);
    body.setOffset(130, 200);

    this.physics.add.collider(this.player, this.ground);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onPointerDown, this);
    });

    const kb = this.input.keyboard;
    if (kb) {
      this.keyA = kb.addKey('A');
      this.keyD = kb.addKey('D');
      this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(180, 80);

    this.add
      .text(24, 20, 'A 向左 · D 向右 · 空格跳跃 · 鼠标左键攻击', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#eceff1',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) return;
    this.tryAttack();
  }

  private tryAttack(): void {
    if (this.attacking) return;
    this.attacking = true;
    this.landPoseMs = 0;
    this.player.anims.stop();
    this.player.setTexture('warrior_attack', 0);
    this.player.once(`animationcomplete-${ATTACK_ANIM_KEY}`, () => {
      this.finishAttack();
    });
    this.player.play(ATTACK_ANIM_KEY);
  }

  private finishAttack(): void {
    this.attacking = false;
    this.player.anims.stop();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.onFloor();
    this.player.setTexture('warrior_walk', onGround ? FRAME_WALK_START : FRAME_JUMP_AIR);
  }

  override update(_time: number, delta: number): void {
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
      this.player.setFrame(FRAME_LAND);
      return;
    }

    if (!onGround) {
      this.player.anims.stop();
      this.player.setFrame(FRAME_JUMP_AIR);
      return;
    }

    if (Math.abs(vx) > 4) {
      this.player.anims.play('warrior_walk_anim', true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(FRAME_WALK_START);
    }
  }
}
