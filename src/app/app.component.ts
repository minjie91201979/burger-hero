import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { HomeLandingComponent } from './components/home-landing/home-landing.component';
import { GameBgmService } from './services/game-bgm.service';
import { AccountGateComponent } from './components/account-gate/account-gate.component';
import { GameContainerComponent } from './components/game-container/game-container.component';
import { GameSelectComponent, type SelectableGameId } from './components/game-select/game-select.component';
import { WarriorWalkGameContainerComponent } from './components/warrior-walk-game-container/warrior-walk-game-container.component';
import { HeroDuelGameContainerComponent } from './components/hero-duel-game-container/hero-duel-game-container.component';
import { SurvivalShooterGameContainerComponent } from './components/survival-shooter-game-container/survival-shooter-game-container.component';
import { HudComponent } from './components/hud/hud.component';
import { OrderPanelComponent } from './components/order-panel/order-panel.component';
import { UpgradePanelComponent } from './components/upgrade-panel/upgrade-panel.component';
import { AchievementComponent } from './components/achievement/achievement.component';
import { SettingsComponent } from './components/settings/settings.component';
import { TopBarComponent } from './components/top-bar/top-bar.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HomeLandingComponent,
    AccountGateComponent,
    GameContainerComponent,
    GameSelectComponent,
    WarriorWalkGameContainerComponent,
    HeroDuelGameContainerComponent,
    SurvivalShooterGameContainerComponent,
    TopBarComponent,
    HudComponent,
    OrderPanelComponent,
    UpgradePanelComponent,
    AchievementComponent,
    SettingsComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly menuBgm = inject(GameBgmService);

  readonly title = '汉堡小英雄';
  /** 启动即进入「选择游戏」 */
  readonly phase = signal<'home' | 'gate' | 'game-select' | 'play'>('game-select');
  /** 仅在 `phase === 'play'` 时有效 */
  readonly playGameId = signal<SelectableGameId | null>(null);
  /**
   * 进入账号门时期望登录后继续的游戏；`burger` 表示选过汉堡或从汉堡内切换账号；
   * `null` 表示仅从欢迎页/武将侧进入账号，登录后回到选择游戏。
   */
  readonly gateResumeGame = signal<'burger' | null>(null);
  readonly showUpgrade = signal(false);
  readonly showAchievement = signal(false);
  readonly showSettings = signal(false);
  /** 横板类游戏在手机端隐藏顶栏时，用角落菜单代替「返回 / 切换账号」 */
  readonly warriorMobileMenuOpen = signal(false);

  constructor() {
    effect(() => {
      if (this.phase() === 'play') {
        this.menuBgm.pauseMenuBgm();
      } else {
        this.menuBgm.resumeMenuBgm();
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeCloseModals(): void {
    if (this.warriorMobileMenuOpen()) {
      this.warriorMobileMenuOpen.set(false);
      return;
    }
    if (!this.showUpgrade() && !this.showAchievement() && !this.showSettings()) return;
    this.showUpgrade.set(false);
    this.showAchievement.set(false);
    this.showSettings.set(false);
  }

  toggleUpgrade(): void {
    const open = !this.showUpgrade();
    this.showUpgrade.set(open);
    if (open) {
      this.showAchievement.set(false);
      this.showSettings.set(false);
    }
  }

  toggleAchievement(): void {
    const open = !this.showAchievement();
    this.showAchievement.set(open);
    if (open) {
      this.showUpgrade.set(false);
      this.showSettings.set(false);
    }
  }

  toggleSettings(): void {
    const open = !this.showSettings();
    this.showSettings.set(open);
    if (open) {
      this.showUpgrade.set(false);
      this.showAchievement.set(false);
    }
  }

  onLeaveHome(): void {
    this.gateResumeGame.set(null);
    this.phase.set('gate');
  }

  onEnteredGame(): void {
    const resume = this.gateResumeGame();
    this.gateResumeGame.set(null);
    if (resume === 'burger') {
      this.playGameId.set('burger');
      this.phase.set('play');
    } else {
      this.playGameId.set(null);
      this.phase.set('game-select');
    }
  }

  onPickGame(id: SelectableGameId): void {
    if (id === 'warrior' || id === 'hero-duel' || id === 'survival-shooter') {
      this.playGameId.set(id);
      this.phase.set('play');
      return;
    }
    this.gateResumeGame.set('burger');
    this.phase.set('gate');
  }

  /** 选择页：仅管理存档账号（不预选汉堡） */
  onOpenAccountsFromPicker(): void {
    this.gateResumeGame.set(null);
    this.phase.set('gate');
  }

  /** 选择页：进入欢迎页 */
  onOpenHomeFromPicker(): void {
    this.phase.set('home');
  }

  /** 账号门：返回选择游戏 */
  onBackFromGateToGameSelect(): void {
    this.gateResumeGame.set(null);
    this.phase.set('game-select');
  }

  /** 汉堡游玩中：切换账号，登录后继续汉堡 */
  onReturnToAccountsAfterBurger(): void {
    this.showUpgrade.set(false);
    this.showAchievement.set(false);
    this.showSettings.set(false);
    this.playGameId.set(null);
    this.gateResumeGame.set('burger');
    this.phase.set('gate');
  }

  /** 横板类游玩中：切换账号，登录后回选择游戏 */
  onReturnToAccountsAfterWarrior(): void {
    this.showUpgrade.set(false);
    this.showAchievement.set(false);
    this.showSettings.set(false);
    this.playGameId.set(null);
    this.gateResumeGame.set(null);
    this.phase.set('gate');
  }

  onReturnToGameSelect(): void {
    this.showUpgrade.set(false);
    this.showAchievement.set(false);
    this.showSettings.set(false);
    this.warriorMobileMenuOpen.set(false);
    this.playGameId.set(null);
    this.gateResumeGame.set(null);
    this.phase.set('game-select');
  }

  toggleWarriorMobileMenu(): void {
    this.warriorMobileMenuOpen.update((open) => !open);
  }

  onWarriorMenuReturnSelect(): void {
    this.warriorMobileMenuOpen.set(false);
    this.onReturnToGameSelect();
  }

  onWarriorMenuAccounts(): void {
    this.warriorMobileMenuOpen.set(false);
    this.onReturnToAccountsAfterWarrior();
  }

}
