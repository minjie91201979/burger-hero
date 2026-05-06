import { Scene } from 'phaser';

export type WarriorWalkPlayClass = 'warrior' | 'mage';

const REGISTRY_KEY = 'warriorWalkClass';

export function getWarriorWalkPlayClass(registry: Phaser.Data.DataManager): WarriorWalkPlayClass {
  const v = registry.get(REGISTRY_KEY) as WarriorWalkPlayClass | undefined;
  return v === 'mage' ? 'mage' : 'warrior';
}

export class WarriorWalkSelectScene extends Scene {
  constructor() {
    super({ key: 'WarriorWalkSelectScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .rectangle(width / 2, height / 2, width, height, 0x0d1642, 1)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 56, '选择角色', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#eceff1',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    const previewY = height * 0.52;
    const gap = 220;
    const cx = width / 2;
    const scale = 0.272;

    const mkCard = (x: number, label: string, frame: number, cls: WarriorWalkPlayClass) => {
      const g = this.add.container(x, previewY);

      const bg = this.add
        .rectangle(0, 0, 200, 260, 0x1a237e, 0.85)
        .setStrokeStyle(2, 0x7986cb, 0.9);

      const spr = this.add
        .sprite(0, -8, 'peoples', frame)
        .setScale(scale)
        .setInteractive({ useHandCursor: true });

      const txt = this.add
        .text(0, 108, label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: '#eceff1',
        })
        .setOrigin(0.5, 0.5);

      g.add([bg, spr, txt]);

      const pick = () => {
        this.registry.set(REGISTRY_KEY, cls);
        this.scene.start('WarriorWalkScene');
      };

      spr.on('pointerdown', pick);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', pick);
    };

    mkCard(cx - gap / 2, '武将', 0, 'warrior');
    mkCard(cx + gap / 2, '法师', 1, 'mage');

    this.add
      .text(width / 2, height - 36, '点击卡片开始', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#b0bec5',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);
  }
}
