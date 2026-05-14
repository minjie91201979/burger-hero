import { Component, DestroyRef, NgZone, afterNextRender, inject } from '@angular/core';

@Component({
  selector: 'app-hero-duel-game-container',
  standalone: true,
  template: `
    <div class="host-wrap">
      <div id="hero-duel-game" class="phaser-host"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: 1;
        min-height: 0;
        position: relative;
      }
      .host-wrap {
        width: 100%;
        height: 100%;
        min-height: 360px;
        background: radial-gradient(ellipse at 50% 15%, #4e342e 0%, #1b1210 50%, #0a0605 100%);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.12);
        touch-action: none;
      }
      .phaser-host {
        width: 100%;
        height: 100%;
        min-height: 360px;
        touch-action: none;
      }
    `,
  ],
})
export class HeroDuelGameContainerComponent {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private game?: import('phaser').Game;

  constructor() {
    afterNextRender(() => {
      void this.boot();
    });
    this.destroyRef.onDestroy(() => this.stopPhaser());
  }

  private stopPhaser(): void {
    if (!this.game) return;
    this.game.destroy(true);
    this.game = undefined;
  }

  private async boot(): Promise<void> {
    const Phaser = await import('phaser');
    const { HeroDuelPreloadScene } = await import('../../../games/hero-duel/scenes/HeroDuelPreloadScene');
    const { HeroDuelSelectScene } = await import('../../../games/hero-duel/scenes/HeroDuelSelectScene');
    const { HeroDuelBattleScene } = await import('../../../games/hero-duel/scenes/HeroDuelBattleScene');

    this.zone.runOutsideAngular(() => {
      const config: import('phaser').Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'hero-duel-game',
        width: 1280,
        height: 640,
        transparent: false,
        backgroundColor: '#1b1210',
        scene: [HeroDuelPreloadScene, HeroDuelSelectScene, HeroDuelBattleScene],
        input: {
          activePointers: 4,
          touch: { capture: true },
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            useTree: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };
      this.game = new Phaser.Game(config);
      this.hookPhaserScaleRefresh();
    });
  }

  private hookPhaserScaleRefresh(): void {
    const game = this.game;
    if (!game) return;
    const refresh = (): void => {
      game.scale.refresh();
    };
    globalThis.addEventListener('resize', refresh);
    const vv = globalThis.visualViewport;
    if (vv) {
      vv.addEventListener('resize', refresh);
    }
    this.destroyRef.onDestroy(() => {
      globalThis.removeEventListener('resize', refresh);
      vv?.removeEventListener('resize', refresh);
    });
  }
}
