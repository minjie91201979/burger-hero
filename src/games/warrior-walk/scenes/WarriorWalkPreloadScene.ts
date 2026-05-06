import { Scene } from 'phaser';
import { WARRIOR_WALK_BACKGROUND_FILES } from '../warrior-walk-background-manifest';

/** 行走/跳跃：2800×400，400×400 切分 */
const WALK_FRAME_W = 400;
const WALK_FRAME_H = 400;
/** 攻击：2332×400 = 4×583，横向 4 帧 */
const ATTACK_FRAME_W = 583;
const ATTACK_FRAME_H = 400;
/** 人物选择：800×400，两列 400×400 */
const PEOPLES_FRAME_W = 400;
const PEOPLES_FRAME_H = 400;
/** 法师行走：2400×400 */
const FASHI_WALK_FRAME_W = 400;
const FASHI_WALK_FRAME_H = 400;
/** 法师攻击：1600×400，4 帧 */
const FASHI_ATTACK_FRAME_W = 400;
const FASHI_ATTACK_FRAME_H = 400;
/** 火球：1596×800，399×400，上行 4 帧飞行循环，下行 4 帧爆炸 */
const HUOQIU_FRAME_W = 399;
const HUOQIU_FRAME_H = 400;
/** 敌人 ribenwushi：1600×400，前 2 帧走、后 2 帧攻 */
const RIBEN_FRAME_W = 400;
const RIBEN_FRAME_H = 400;

export class WarriorWalkPreloadScene extends Scene {
  constructor() {
    super({ key: 'WarriorWalkPreloadScene' });
  }

  preload(): void {
    for (let i = 0; i < WARRIOR_WALK_BACKGROUND_FILES.length; i++) {
      this.load.image(`ww_bg_${i}`, `assets/images/background/${WARRIOR_WALK_BACKGROUND_FILES[i]}`);
    }
    this.load.image('road_ground', 'assets/images/background/路.jpg');
    this.load.spritesheet('peoples', 'assets/images/walk/peoples.png', {
      frameWidth: PEOPLES_FRAME_W,
      frameHeight: PEOPLES_FRAME_H,
    });
    this.load.spritesheet('warrior_walk', 'assets/images/walk/walk.png', {
      frameWidth: WALK_FRAME_W,
      frameHeight: WALK_FRAME_H,
    });
    this.load.spritesheet('warrior_attack', 'assets/images/walk/attack.png', {
      frameWidth: ATTACK_FRAME_W,
      frameHeight: ATTACK_FRAME_H,
    });
    this.load.spritesheet('fashi_walk', 'assets/images/walk/fashi_walk.png', {
      frameWidth: FASHI_WALK_FRAME_W,
      frameHeight: FASHI_WALK_FRAME_H,
    });
    this.load.spritesheet('fashi_attack', 'assets/images/walk/fashi_attack.png', {
      frameWidth: FASHI_ATTACK_FRAME_W,
      frameHeight: FASHI_ATTACK_FRAME_H,
    });
    this.load.spritesheet('huoqiu', 'assets/images/walk/huoqiu.png', {
      frameWidth: HUOQIU_FRAME_W,
      frameHeight: HUOQIU_FRAME_H,
    });
    this.load.spritesheet('ribenwushi', 'assets/images/walk/ribenwushi.png', {
      frameWidth: RIBEN_FRAME_W,
      frameHeight: RIBEN_FRAME_H,
    });
  }

  create(): void {
    this.scene.start('WarriorWalkSelectScene');
  }
}
