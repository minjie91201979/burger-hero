import { Scene } from 'phaser';

/** 行走/跳跃：2800×400，400×400 切分 */
const WALK_FRAME_W = 400;
const WALK_FRAME_H = 400;
/** 攻击：2332×400 = 4×583，横向 4 帧 */
const ATTACK_FRAME_W = 583;
const ATTACK_FRAME_H = 400;

export class WarriorWalkPreloadScene extends Scene {
  constructor() {
    super({ key: 'WarriorWalkPreloadScene' });
  }

  preload(): void {
    this.load.spritesheet('warrior_walk', 'assets/images/walk/walk.png', {
      frameWidth: WALK_FRAME_W,
      frameHeight: WALK_FRAME_H,
    });
    this.load.spritesheet('warrior_attack', 'assets/images/walk/attack.png', {
      frameWidth: ATTACK_FRAME_W,
      frameHeight: ATTACK_FRAME_H,
    });
  }

  create(): void {
    this.scene.start('WarriorWalkScene');
  }
}
