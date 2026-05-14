import { Component, DestroyRef, NgZone, afterNextRender, inject } from '@angular/core';

@Component({
  selector: 'app-survival-shooter-game-container',
  standalone: true,
  template: `
    <div class="host-wrap">
      <div id="survival-shooter-game" class="phaser-host"></div>
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
        background: radial-gradient(ellipse at 50% 12%, #4a148c 0%, #1a0d24 52%, #0a050e 100%);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: inset 0 0 0 1px rgba(206, 147, 216, 0.2);
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
export class SurvivalShooterGameContainerComponent {
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
    const { SurvivalShooterPreloadScene } = await import(
      '../../../games/survival-shooter/scenes/SurvivalShooterPreloadScene'
    );
    const { SurvivalShooterSelectScene } = await import(
      '../../../games/survival-shooter/scenes/SurvivalShooterSelectScene'
    );
    const { SurvivalShooterGameScene } = await import(
      '../../../games/survival-shooter/scenes/SurvivalShooterGameScene'
    );

    this.zone.runOutsideAngular(() => {
      const config: import('phaser').Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'survival-shooter-game',
        width: 1280,
        height: 720,
        transparent: false,
        backgroundColor: '#120a18',
        scene: [SurvivalShooterPreloadScene, SurvivalShooterSelectScene, SurvivalShooterGameScene],
        input: {
          /** 默认仅 1 点触摸，会导致一手摇杆一手射击无效 */
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
          // FIT：整画布落在容器内，避免 ENVELOP 放大后上下被裁切、底部虚拟键点不到
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };
      this.game = new Phaser.Game(config);
      this.hookPhaserScaleRefresh();
    });
  }

  /** 视口变化时让 Phaser 重新贴合父节点，避免画布高度与 DOM 不一致 */
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
