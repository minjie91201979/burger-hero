import { Scene } from 'phaser';
import { HEROES, type HeroDef } from '../data/game-data';

const REGISTRY_KEY = 'heroDuelHeroId';

export function getSelectedHeroId(registry: Phaser.Data.DataManager): string {
  const v = registry.get(REGISTRY_KEY) as string | undefined;
  return v && HEROES.some((h) => h.heroId === v) ? v : 'zhao_yun';
}

export class HeroDuelSelectScene extends Scene {
  constructor() {
    super({ key: 'HeroDuelSelectScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a0a0a, 1).setScrollFactor(0);

    this.add
      .text(width / 2, 48, '横板策略卡牌：英雄对决', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '26px',
        color: '#ffecb3',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.add
      .text(width / 2, 86, '选择英雄', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#eceff1',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const previewY = height * 0.52;
    const n = HEROES.length;
    const totalW = Math.min(width * 0.92, 220 * n + 32 * (n - 1));
    const startX = width / 2 - totalW / 2 + 110;
    const gap = 32;
    const scale = 0.22;

    HEROES.forEach((hero, i) => {
      const x = startX + i * (220 + gap);
      this.mkHeroCard(x, previewY, scale, hero);
    });

    this.add
      .text(width / 2, height - 40, '点击英雄卡片开始 · 战斗中 A/D 移动 · 1~4 技能 · 左下角点击出牌', {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#b0bec5',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  private mkHeroCard(x: number, y: number, scale: number, hero: HeroDef): void {
    const g = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, 210, 280, 0x3e2723, 0.92)
      .setStrokeStyle(2, 0xff8f00, 0.75);

    const spr = this.add.sprite(0, -12, 'peoples', hero.peoplesFrame).setScale(scale);
    if (hero.tint !== undefined) {
      spr.setTint(hero.tint);
    }
    spr.setInteractive({ useHandCursor: true });

    const hpLine = `生命 ${hero.maxHp}${hero.heroId === 'zhang_fei' ? '（刚体+10%）' : ''}`;
    const skillLines = hero.skills.map((s) => `${s.keyIndex}.${s.name}`).join(' · ');

    const txt = this.add
      .text(0, 92, `${hero.name}\n${hpLine}\n${skillLines}`, {
        fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        color: '#fff8e1',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0.5);

    g.add([bg, spr, txt]);

    const pick = () => {
      this.registry.set(REGISTRY_KEY, hero.heroId);
      this.scene.start('HeroDuelBattleScene');
    };

    spr.on('pointerdown', pick);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', pick);
  }
}
