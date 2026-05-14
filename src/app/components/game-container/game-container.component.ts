import { Component, DestroyRef, inject, NgZone, afterNextRender } from '@angular/core';
import type { GameSaveData } from '../../models/burger-game.model';
import { GameEventsService } from '../../services/game-events.service';
import { ProfileService } from '../../services/profile.service';

const GAME_BG = 'assets/images/kitchen/game_bg.png';

@Component({
  selector: 'app-game-container',
  standalone: true,
  template: `
    <div class="play-surface" [style.background]="playSurfaceBg">
      <div id="burger-game" class="burger-host"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: absolute;
        inset: 0;
        z-index: 0;
      }
      .play-surface {
        width: 100%;
        height: 100%;
        min-height: 100%;
        position: relative;
        box-sizing: border-box;
        touch-action: none;
      }
      .burger-host {
        width: 100%;
        height: 100%;
        min-height: 100%;
        position: relative;
        touch-action: none;
      }
    `,
  ],
})
export class GameContainerComponent {
  readonly playSurfaceBg = `#1a1209 url(${JSON.stringify(GAME_BG)}) center / cover no-repeat`;
  private readonly zone = inject(NgZone);
  private readonly events = inject(GameEventsService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private game?: import('phaser').Game;
  private readonly saveHandler = (payload: GameSaveData) => {
    void this.profile.persistGameSave(payload);
  };

  constructor() {
    afterNextRender(() => {
      void this.boot();
    });

    this.destroyRef.onDestroy(() => {
      const snap = this.events.readSnapshot();
      if (snap) {
        void this.profile.persistGameSave(snap);
      }
      this.stopPhaser();
    });
  }

  private async boot(): Promise<void> {
    await this.profile.waitUntilLoaded();
    await this.startPhaser();
  }

  private stopPhaser(): void {
    if (!this.game) return;
    this.game.registry.events.off('burger-save', this.saveHandler, this);
    this.events.clearSnapshotReader();
    this.game.destroy(true);
    this.game = undefined;
  }

  private async startPhaser(): Promise<void> {
    const Phaser = await import('phaser');
    const { PreloadScene } = await import('../../../games/phaser/scenes/PreloadScene');
    const { KitchenScene } = await import('../../../games/phaser/scenes/KitchenScene');

    this.zone.runOutsideAngular(() => {
      const config: import('phaser').Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'burger-game',
        width: 1024,
        height: 720,
        transparent: true,
        scene: [PreloadScene, KitchenScene],
        input: {
          activePointers: 4,
          touch: { capture: true },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        callbacks: {
          preBoot: (game) => {
            game.registry.set('eventService', this.events);
            game.registry.set('initialSave', this.events.initialSave);
          },
        },
      };
      this.game = new Phaser.Game(config);
      this.game.registry.events.on('burger-save', this.saveHandler, this);
      this.events.registerSnapshotReader(() => {
        const fn = this.game?.registry.get('getSaveSnapshot') as (() => GameSaveData) | undefined;
        return fn?.() ?? null;
      });
    });
  }
}
