import { Component, inject, output, signal } from '@angular/core';

import { GameBgmService } from '../../services/game-bgm.service';
import { ProfileService } from '../../services/profile.service';

const LOGIN_BG = 'assets/images/kitchen/hamburger_login_bg.png';

@Component({
  selector: 'app-account-gate',
  standalone: true,
  template: `
    <div class="gate" [style.background]="gateBg">
      <div class="card">
        <h1 class="title">汉堡小英雄</h1>
        <p class="subtitle">请选择已有账号，或新建账号后再进入游戏。</p>

        @if (!loaded()) {
          <p class="muted">正在读取存档…</p>
        } @else if (!profiles().length) {
          <p class="muted">还没有账号，请先创建一个。</p>
        } @else {
          <ul class="list" role="listbox" aria-label="账号列表">
            @for (p of profiles(); track p.id) {
              <li>
                <button
                  type="button"
                  class="row"
                  [class.active]="p.id === activeId()"
                  (click)="pick(p.id)"
                >
                  <span class="name">{{ p.displayName }}</span>
                  <span class="meta">金钱 {{ '$' + p.save.money }} · 最高分 {{ p.save.highScore }}</span>
                </button>
              </li>
            }
          </ul>
        }

        <div class="create">
          <input
            class="inp"
            type="text"
            maxlength="24"
            placeholder="新账号显示名称"
            [value]="newName()"
            (input)="newName.set($any($event.target).value)"
            (keydown.enter)="onCreate()"
          />
          <button type="button" class="btn secondary" [disabled]="!loaded()" (click)="onCreate()">
            创建账号
          </button>
        </div>

        <button
          type="button"
          class="btn primary"
          [disabled]="!canEnter()"
          (click)="onEnter()"
        >
          进入游戏
        </button>

        <button type="button" class="link-back" (click)="onBack()">返回选游戏</button>
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
      .gate {
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(440px, 100%);
        padding: 28px 24px;
        border-radius: 16px;
        background: rgba(22, 18, 14, 0.96);
        border: 1px solid rgba(255, 183, 77, 0.35);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
      }
      .title {
        margin: 0 0 8px;
        font-size: 1.5rem;
        color: #ffe082;
        text-align: center;
      }
      .subtitle {
        margin: 0 0 20px;
        font-size: 14px;
        line-height: 1.5;
        color: #b0bec5;
        text-align: center;
      }
      .muted {
        margin: 0 0 16px;
        font-size: 14px;
        color: #90a4ae;
        text-align: center;
      }
      .list {
        list-style: none;
        margin: 0 0 16px;
        padding: 0;
        max-height: 40vh;
        overflow: auto;
      }
      .row {
        width: 100%;
        text-align: left;
        margin-bottom: 8px;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #eceff1;
        cursor: pointer;
      }
      .row:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .row.active {
        border-color: rgba(129, 199, 132, 0.65);
        background: rgba(76, 175, 80, 0.12);
      }
      .name {
        display: block;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .meta {
        font-size: 12px;
        color: #90a4ae;
      }
      .create {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }
      .inp {
        flex: 1 1 160px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #546e7a;
        background: #1e272e;
        color: #eceff1;
      }
      .btn {
        cursor: pointer;
        border-radius: 10px;
        border: none;
        padding: 10px 16px;
        font-weight: 600;
        font-size: 14px;
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .btn.primary {
        width: 100%;
        background: linear-gradient(180deg, #ffb300, #ff8f00);
        color: #1a1008;
      }
      .btn.secondary {
        background: #37474f;
        color: #eceff1;
      }
      .link-back {
        display: block;
        width: 100%;
        margin-top: 14px;
        cursor: pointer;
        border: none;
        background: none;
        color: #90caf9;
        font-size: 14px;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .link-back:hover {
        color: #bbdefb;
      }
    `,
  ],
})
export class AccountGateComponent {
  private readonly profile = inject(ProfileService);
  private readonly menuBgm = inject(GameBgmService);

  readonly gateBg = `radial-gradient(ellipse at center, rgba(13, 8, 6, 0.35) 0%, rgba(13, 8, 6, 0.72) 100%), #1a1209 url(${JSON.stringify(LOGIN_BG)}) center / cover no-repeat`;

  readonly entered = output<void>();
  readonly back = output<void>();

  readonly profiles = this.profile.profiles;
  readonly activeId = this.profile.activeProfileId;
  readonly loaded = this.profile.loaded;
  readonly newName = signal('');

  pick(id: string): void {
    void this.profile.setActiveProfile(id);
  }

  canEnter(): boolean {
    return this.loaded() && this.profiles().length > 0 && this.activeId() != null;
  }

  onCreate(): void {
    void this.profile.createNewProfile(this.newName()).then(() => {
      this.newName.set('');
    });
  }

  onEnter(): void {
    if (!this.canEnter()) return;
    this.menuBgm.resumeMenuBgm();
    void (async () => {
      await this.profile.syncInitialFromActiveProfile();
      this.entered.emit();
    })();
  }

  onBack(): void {
    this.back.emit();
  }
}
