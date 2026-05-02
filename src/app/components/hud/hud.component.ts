import { Component, inject, signal } from '@angular/core';

import { GameEventsService } from '../../services/game-events.service';

@Component({
  selector: 'app-hud',
  standalone: true,
  template: `
    <div class="hud">
      <span class="pill">金钱 {{ '$' + money() }}</span>
      <span class="pill">连击 x{{ combo() }}</span>
      <span class="pill">本局得分 {{ score() }}</span>
      @if (toast()) {
        <span class="toast">{{ toast() }}</span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .hud {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        padding: 10px 14px;
        background: rgba(20, 16, 12, 0.82);
        border-radius: 10px;
        border: 1px solid rgba(255, 193, 7, 0.35);
        pointer-events: auto;
      }
      .pill {
        font-size: 15px;
        font-weight: 600;
        color: #fff8e1;
      }
      .toast {
        flex-basis: 100%;
        font-size: 13px;
        color: #ffecb3;
        margin-top: 4px;
      }
    `,
  ],
})
export class HudComponent {
  private readonly events = inject(GameEventsService);
  readonly money = signal(100);
  readonly combo = signal(0);
  readonly score = signal(0);
  readonly toast = signal('');

  constructor() {
    this.events.money$.subscribe((v) => this.money.set(v));
    this.events.combo$.subscribe((v) => this.combo.set(v));
    this.events.score$.subscribe((v) => this.score.set(v));
    this.events.toast$.subscribe((m) => {
      this.toast.set(m);
      window.setTimeout(() => this.toast.set(''), 3200);
    });
  }
}
