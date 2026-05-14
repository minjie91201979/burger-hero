import { Component, output } from '@angular/core';

export type SelectableGameId = 'burger' | 'warrior' | 'hero-duel' | 'survival-shooter';

@Component({
  selector: 'app-game-select',
  standalone: true,
  template: `
    <div class="page">
      <div class="panel">
        <h1 class="title">选择游戏</h1>
        <p class="hint">
          请先选择要玩的游戏。选「汉堡小英雄」需先登录存档账号；其余几款可直接开始。
        </p>

        <div class="cards">
          <button type="button" class="card card--burger" (click)="picked.emit('burger')">
            <span class="card-kicker">经营模拟</span>
            <span class="card-name">汉堡小英雄</span>
            <span class="card-desc">厨房烤架、叠汉堡、完成订单。</span>
          </button>
          <button type="button" class="card card--warrior" (click)="picked.emit('warrior')">
            <span class="card-kicker">横板演示</span>
            <span class="card-name">武将行军</span>
            <span class="card-desc">雪碧图行走：A 向左、D 向右。</span>
          </button>
          <button type="button" class="card card--hero-duel" (click)="picked.emit('hero-duel')">
            <span class="card-kicker">策略卡牌</span>
            <span class="card-name">英雄对决</span>
            <span class="card-desc">选将、横板移动、技能与手牌补牌（复用武将行军素材）。</span>
          </button>
          <button type="button" class="card card--survival" (click)="picked.emit('survival-shooter')">
            <span class="card-kicker">俯视生存</span>
            <span class="card-name">孤胆幸存者</span>
            <span class="card-desc">法师 / 武将大战日本武士；大地图四向移动，手机带虚拟摇杆与射击键。</span>
          </button>
        </div>

        <div class="footer-links">
          <button type="button" class="link-back" (click)="openAccounts.emit()">存档与账号</button>
          <span class="link-sep" aria-hidden="true">·</span>
          <button type="button" class="link-back" (click)="openHome.emit()">欢迎页</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 100%;
      }
      .page {
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(ellipse at 30% 20%, rgba(255, 183, 77, 0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(100, 181, 246, 0.1) 0%, transparent 45%),
          #121018;
      }
      .panel {
        width: min(920px, 100%);
        padding: 32px 28px 24px;
        border-radius: 20px;
        background: rgba(24, 20, 32, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
      }
      .title {
        margin: 0 0 8px;
        font-size: clamp(1.5rem, 3vw, 2rem);
        color: #ffe082;
        text-align: center;
      }
      .hint {
        margin: 0 0 28px;
        text-align: center;
        color: #90a4ae;
        font-size: 14px;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .card {
        cursor: pointer;
        text-align: left;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 20px 18px 22px;
        color: #eceff1;
        background: rgba(255, 255, 255, 0.04);
        transition:
          transform 0.15s ease,
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .card:hover {
        transform: translateY(-3px);
        border-color: rgba(255, 213, 79, 0.45);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      }
      .card--burger {
        background: linear-gradient(160deg, rgba(255, 152, 0, 0.12), rgba(255, 255, 255, 0.03));
      }
      .card--warrior {
        background: linear-gradient(160deg, rgba(66, 165, 245, 0.12), rgba(255, 255, 255, 0.03));
      }
      .card--hero-duel {
        background: linear-gradient(160deg, rgba(255, 152, 0, 0.14), rgba(183, 28, 28, 0.08));
      }
      .card--survival {
        background: linear-gradient(160deg, rgba(186, 104, 200, 0.18), rgba(49, 27, 61, 0.35));
      }
      .card-kicker {
        display: block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #b0bec5;
        margin-bottom: 8px;
      }
      .card-name {
        display: block;
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 10px;
        color: #fff8e1;
      }
      .card-desc {
        display: block;
        font-size: 13px;
        line-height: 1.5;
        color: #cfd8dc;
      }
      .footer-links {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 10px;
        margin-top: 8px;
      }
      .link-sep {
        color: #546e7a;
        user-select: none;
      }
      .link-back {
        cursor: pointer;
        border: none;
        background: none;
        color: #81d4fa;
        font-size: 14px;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .link-back:hover {
        color: #b3e5fc;
      }
    `,
  ],
})
export class GameSelectComponent {
  readonly picked = output<SelectableGameId>();
  readonly openAccounts = output<void>();
  readonly openHome = output<void>();
}
