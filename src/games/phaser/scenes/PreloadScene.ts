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
    const gw = 1024;
    const gh = 720;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillGradientStyle(0x3d2914, 0x3d2914, 0x1a1209, 0x1a1209, 1);
    g.fillRect(0, 0, gw, gh);
    g.generateTexture('kitchen_bg', gw, gh);
    g.destroy();

    roundedRectTexture(this, 'grill', 220, 130, 0x4a4a4a, 0x888888);
    roundedRectTexture(this, 'bun_bottom', 72, 36, 0xd4a574, 0x8b5a2b);
    roundedRectTexture(this, 'bun_top', 72, 36, 0xc49464, 0x7a4a1b);
    roundedRectTexture(this, 'lettuce', 56, 28, 0x3cb371, 0x1e6b3a);
    roundedRectTexture(this, 'cheese', 60, 24, 0xffd54f, 0xc49000);
    roundedRectTexture(this, 'patty_raw', 64, 40, 0xcd5c5c, 0x8b0000);
    roundedRectTexture(this, 'patty_cooked', 64, 40, 0x6b3e26, 0x3d2215);
    roundedRectTexture(this, 'patty_burnt', 64, 40, 0x2b2b2b, 0x000000);
    roundedRectTexture(this, 'btn_spawn', 88, 40, 0x8b4513, 0xffe4c4);
    roundedRectTexture(this, 'plate', 200, 160, 0xf5f5dc, 0xc4b896);
    roundedRectTexture(this, 'serve_btn', 100, 44, 0xe65100, 0xffcc80);
    roundedRectTexture(this, 'clear_btn', 80, 36, 0x546e7a, 0xb0bec5);
    roundedRectTexture(this, 'customer_body', 64, 96, 0x5c6bc0, 0x1a237e);
  }
}
