import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { portraitUrlCandidates } from '../../data/customer-portraits';
import type { BurgerOrderSnapshot } from '../../models/burger-game.model';
import { GameEventsService } from '../../services/game-events.service';

const ING_LABEL: Record<string, string> = {
  bun_bottom: '底面包',
  bun_top: '顶面包',
  lettuce: '生菜',
  cheese: '芝士',
  patty_cooked: '熟肉饼',
  patty_burnt: '焦肉饼',
  patty_raw: '生肉',
};

@Component({
  selector: 'app-order-panel',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="panel">
      <h3>当前订单</h3>
      @if (!orders().length) {
        <p class="muted">等待顾客…</p>
      }
      @for (o of orders(); track o.id) {
        <div class="order-card">
          <div class="row head-row">
            <div class="avatar" aria-hidden="true">
              <span class="avatar-fallback">{{ o.customerName.charAt(0) }}</span>
              <img
                [src]="portraitSrc(o)"
                width="50"
                height="50"
                alt=""
                (error)="onPortraitError(o, $event)"
              />
            </div>
            <div class="name-block">
              <strong>{{ o.customerName }}</strong>
            </div>
            <span class="patience" [class.low]="o.patience < o.maxPatience * 0.25">
              耐心 {{ (o.patience / o.maxPatience * 100) | number: '1.0-0' }}%
            </span>
          </div>
          <ol>
            @for (ing of o.ingredients; track $index) {
              <li>{{ label(ing) }}</li>
            }
          </ol>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .panel {
        width: 100%;
        max-width: 280px;
        box-sizing: border-box;
        max-height: 52vh;
        overflow: auto;
        padding: 12px 14px;
        background: rgba(26, 22, 18, 0.92);
        border-radius: 10px;
        border: 1px solid rgba(129, 199, 132, 0.45);
        color: #eceff1;
      }
      h3 {
        margin: 0 0 10px;
        font-size: 16px;
        color: #c8e6c9;
      }
      .muted {
        margin: 0;
        font-size: 13px;
        color: #90a4ae;
      }
      .order-card {
        margin-bottom: 12px;
        padding: 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
      }
      .row.head-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .avatar {
        position: relative;
        width: 50px;
        height: 50px;
        flex-shrink: 0;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid rgba(129, 199, 132, 0.45);
        background: #37474f;
      }
      .avatar-fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 600;
        color: #eceff1;
        z-index: 0;
        pointer-events: none;
      }
      .avatar img {
        position: relative;
        z-index: 1;
        width: 50px;
        height: 50px;
        object-fit: cover;
        display: block;
      }
      .avatar img.is-broken {
        display: none;
      }
      .name-block {
        flex: 1;
        min-width: 0;
      }
      .name-block strong {
        font-size: 15px;
      }
      .patience {
        flex-shrink: 0;
        font-size: 12px;
        color: #aed581;
      }
      .patience.low {
        color: #ff8a65;
      }
      ol {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
        line-height: 1.45;
      }
    `,
  ],
})
export class OrderPanelComponent {
  private readonly events = inject(GameEventsService);
  readonly orders = signal<BurgerOrderSnapshot[]>([]);
  /** 每张订单当前尝试到第几个头像 URL（用于中文名 / ASCII 名回退） */
  private readonly portraitAttempt = signal<Map<string, number>>(new Map());

  constructor() {
    this.events.ordersChanged$.subscribe((list) => this.orders.set(list));
  }

  label(id: string): string {
    return ING_LABEL[id] ?? id;
  }

  portraitSrc(o: BurgerOrderSnapshot): string {
    const list = portraitUrlCandidates(o.customerName);
    const i = this.portraitAttempt().get(o.id) ?? 0;
    return list[Math.min(i, list.length - 1)]!;
  }

  onPortraitError(o: BurgerOrderSnapshot, ev: Event): void {
    const el = ev.target;
    if (!(el instanceof HTMLImageElement)) return;
    const list = portraitUrlCandidates(o.customerName);
    const cur = this.portraitAttempt().get(o.id) ?? 0;
    if (cur + 1 < list.length) {
      const next = new Map(this.portraitAttempt());
      next.set(o.id, cur + 1);
      this.portraitAttempt.set(next);
      el.classList.remove('is-broken');
    } else {
      el.classList.add('is-broken');
    }
  }
}
