import { Component, DestroyRef, NgZone, afterNextRender, inject } from '@angular/core';

@Component({
  selector: 'app-warrior-walk-game-container',
  standalone: true,
  template: `
    <div class="host-wrap">
      <div id="warrior-walk-game" class="phaser-host"></div>
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
        background: radial-gradient(ellipse at 50% 20%, #3949ab 0%, #0d1642 55%, #050814 100%);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      }
      .phaser-host {
        width: 100%;
        height: 100%;
        min-height: 360px;
      }
    `,
  ],
})
export class WarriorWalkGameContainerComponent {
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
    const { WarriorWalkPreloadScene } = await import('../../../games/warrior-walk/scenes/WarriorWalkPreloadScene');
    const { WarriorWalkScene } = await import('../../../games/warrior-walk/scenes/WarriorWalkScene');

    this.zone.runOutsideAngular(() => {
      const config: import('phaser').Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'warrior-walk-game',
        width: 1280,
        height: 420,
        transparent: false,
        backgroundColor: '#0d1642',
        scene: [WarriorWalkPreloadScene, WarriorWalkScene],
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };
      this.game = new Phaser.Game(config);
    });
  }
}
