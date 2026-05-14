import { Component, inject, output } from '@angular/core';

import { GameBgmService } from '../../services/game-bgm.service';

/** 构建时由 angular.json 复制到输出目录 `assets/`，勿在组件 styles 里写 url()（会触发 angular-css-resource 解析失败） */
const HERO_BG = 'assets/images/kitchen/hamburger_bg.png';

@Component({
  selector: 'app-home-landing',
  standalone: true,
  template: `
    <div
      class="landing"
      role="application"
      aria-label="汉堡小英雄 首页"
      [style.background]="landingBg"
    >
      <button type="button" class="cta" (click)="onEnterClick()">进入游戏</button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 100%;
      }
      .landing {
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
      }
      .cta {
        cursor: pointer;
        border: none;
        border-radius: 16px;
        padding: 22px 56px;
        font-size: clamp(1.25rem, 4vw, 1.75rem);
        font-weight: 800;
        letter-spacing: 0.06em;
        color: #1a1008;
        background: linear-gradient(180deg, #ffca28, #ff8f00);
        box-shadow:
          0 8px 0 #e65100,
          0 14px 40px rgba(0, 0, 0, 0.45);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .cta:hover {
        transform: translateY(-2px);
        box-shadow:
          0 10px 0 #e65100,
          0 18px 44px rgba(0, 0, 0, 0.5);
      }
      .cta:active {
        transform: translateY(4px);
        box-shadow:
          0 4px 0 #e65100,
          0 8px 24px rgba(0, 0, 0, 0.4);
      }
    `,
  ],
})
export class HomeLandingComponent {
  private readonly menuBgm = inject(GameBgmService);

  readonly enter = output<void>();
  readonly landingBg = `#1a1209 url(${JSON.stringify(HERO_BG)}) center / cover no-repeat`;

  onEnterClick(): void {
    this.menuBgm.resumeMenuBgm();
    this.enter.emit();
  }
}
