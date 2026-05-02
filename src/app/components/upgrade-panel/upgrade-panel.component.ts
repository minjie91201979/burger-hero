import { Component, inject, output, signal } from '@angular/core';

import { UPGRADE_CATALOG } from '../../models/burger-game.model';
import { GameEventsService } from '../../services/game-events.service';

@Component({
  selector: 'app-upgrade-panel',
  standalone: true,
  template: `
    <div class="panel">
      <h3 id="modal-upgrade-title">店铺升级</h3>
      <p class="hint">购买后由厨房立即生效（金钱从游戏内扣除）。</p>
      <ul>
        @for (u of catalog; track u.id) {
          <li>
            <div class="title">{{ u.name }}</div>
            <div class="desc">{{ u.description }}</div>
            <div class="buy">
              <span class="price">{{ '$' + u.price }}</span>
              <button
                type="button"
                [disabled]="owned().has(u.id)"
                (click)="buy(u.id)"
              >
                {{ owned().has(u.id) ? '已拥有' : '购买' }}
              </button>
            </div>
          </li>
        }
      </ul>
      <button type="button" class="close" (click)="closed.emit()">关闭</button>
    </div>
  `,
  styles: [
    `
      .panel {
        width: 100%;
        max-width: 440px;
        box-sizing: border-box;
        max-height: min(78vh, 640px);
        overflow: auto;
        padding: 14px 16px;
        background: rgba(22, 18, 14, 0.96);
        border-radius: 12px;
        border: 1px solid rgba(255, 183, 77, 0.5);
        color: #eceff1;
      }
      h3 {
        margin: 0 0 6px;
        color: #ffe082;
      }
      .hint {
        margin: 0 0 12px;
        font-size: 12px;
        color: #b0bec5;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .title {
        font-weight: 600;
        color: #fff9c4;
      }
      .desc {
        font-size: 13px;
        margin: 4px 0 8px;
        color: #cfd8dc;
      }
      .buy {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .price {
        font-weight: 700;
        color: #a5d6a7;
      }
      button {
        cursor: pointer;
        border-radius: 8px;
        border: none;
        padding: 6px 14px;
        font-weight: 600;
        background: #ff8f00;
        color: #1a1008;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .close {
        width: 100%;
        margin-top: 8px;
        background: #37474f;
        color: #eceff1;
      }
    `,
  ],
})
export class UpgradePanelComponent {
  private readonly events = inject(GameEventsService);
  readonly catalog = UPGRADE_CATALOG;
  readonly owned = signal(new Set<string>());
  readonly closed = output<void>();

  constructor() {
    this.events.purchasedUpgrades$.subscribe((ids) => this.owned.set(new Set(ids)));
  }

  buy(id: string): void {
    if (this.owned().has(id)) return;
    this.events.emitUpgradePurchased(id);
  }
}
