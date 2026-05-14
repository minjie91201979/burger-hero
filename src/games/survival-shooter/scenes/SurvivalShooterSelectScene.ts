import { Scene } from 'phaser';

export type SurvivalShooterPlayClass = 'warrior' | 'mage';

const REGISTRY_KEY = 'survivalShooterClass';

export function getSurvivalShooterPlayClass(registry: Phaser.Data.DataManager): SurvivalShooterPlayClass {
  const v = registry.get(REGISTRY_KEY) as SurvivalShooterPlayClass | undefined;
  return v === 'mage' ? 'mage' : 'warrior';
}

export class SurvivalShooterSelectScene extends Scene {
  constructor() {
    super({ key: 'SurvivalShooterSelectScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x120a18, 1).setScrollFactor(0);

    this.add
      .text(width / 2, 52, '孤胆幸存者 · 选择角色', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#eceff1',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 88, '日本武士会从屏幕外包围过来，尽量活下去', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#90a4ae',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    const previewY = height * 0.52;
    const gap = 220;
    const cx = width / 2;
    const scale = 0.22;

    const mkCard = (x: number, label: string, frame: number, cls: SurvivalShooterPlayClass) => {
      const g = this.add.container(x, previewY);

      const bg = this.add
        .rectangle(0, 0, 200, 260, 0x311b3d, 0.9)
        .setStrokeStyle(2, 0xce93d8, 0.75);

      const spr = this.add
        .sprite(0, -8, 'peoples', frame)
        .setScale(scale)
        .setInteractive({ useHandCursor: true });

      const txt = this.add
        .text(0, 108, label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#f3e5f5',
        })
        .setOrigin(0.5, 0.5);

      g.add([bg, spr, txt]);

      const pick = () => {
        this.registry.set(REGISTRY_KEY, cls);
        this.scene.start('SurvivalShooterGameScene');
      };

      spr.on('pointerdown', pick);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', pick);
    };

    mkCard(cx - gap / 2, '武将', 0, 'warrior');
    mkCard(cx + gap / 2, '法师', 1, 'mage');

    this.add
      .text(width / 2, height - 36, '点击卡片开始 · 手机端可用虚拟摇杆与射击键', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#b0bec5',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);
  }
}
