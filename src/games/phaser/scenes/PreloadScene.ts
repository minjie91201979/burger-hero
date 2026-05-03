import { Scene } from 'phaser';

function roundedRectTexture(
  scene: Scene,
  key: string,
  w: number,
  h: number,
  color: number,
  strokeColor?: number,
): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, w, h, 8);
  if (strokeColor !== undefined) {
    g.lineStyle(2, strokeColor, 1);
    g.strokeRoundedRect(1, 1, w - 2, h - 2, 6);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

export class PreloadScene extends Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.load.image('kitchen_bg', 'assets/images/kitchen/game_bg.png');
    const ing = 'assets/images/ingredients';
    this.load.image('bun_bottom', `${ing}/mianbao_b.png`);
    this.load.image('bun_top', `${ing}/mianbao_t.png`);
    this.load.image('lettuce', `${ing}/shengcai.png`);
    this.load.image('cheese', `${ing}/zhishi.png`);
    this.load.image('patty_raw', `${ing}/meet_s.png`);
    this.load.image('patty_cooked', `${ing}/meet_shu.png`);
    this.load.image('patty_burnt', `${ing}/meet_j.png`);
    this.load.image('kaopan', `${ing}/kaopan.png`);
    this.load.image('cipan', `${ing}/cipan.png`);
    this.load.image('kongpan', `${ing}/kongpan.png`);
    this.load.image('jisuanqi', `${ing}/jisuanqi.png`);
    this.load.audio('kaorou_zizi', 'assets/sound/kaorou_zizi.wav');
    this.load.audio('lingdang', 'assets/sound/lingdang.wav');
    this.load.audio('jinbi', 'assets/sound/jinbi.wav');
  }

  create(): void {
    const bar = this.add.graphics();
    const box = this.add.graphics();
    box.fillStyle(0x222222, 0.85);
    box.fillRect(240, 310, 320, 50);
    bar.fillStyle(0xffaa00, 1);
    bar.fillRect(250, 320, 90, 30);
    this.add.text(360, 285, '准备厨房…', { fontSize: '16px', color: '#ffffff' });

    this.buildPlaceholderTextures();

    bar.clear();
    bar.fillStyle(0xffaa00, 1);
    bar.fillRect(250, 320, 300, 30);
    bar.destroy();
    box.destroy();

    this.scene.start('KitchenScene');
  }

  private buildPlaceholderTextures(): void {
    roundedRectTexture(this, 'customer_body', 64, 96, 0x5c6bc0, 0x1a237e);
  }
}
