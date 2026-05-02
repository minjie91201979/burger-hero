import { Component, HostListener, signal } from '@angular/core';
import { AccountGateComponent } from './components/account-gate/account-gate.component';
import { GameContainerComponent } from './components/game-container/game-container.component';
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
    AccountGateComponent,
    GameContainerComponent,
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
  readonly title = '汉堡小英雄';
  readonly phase = signal<'gate' | 'play'>('gate');
  readonly showUpgrade = signal(false);
  readonly showAchievement = signal(false);
  readonly showSettings = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeCloseModals(): void {
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

  onEnteredGame(): void {
    this.phase.set('play');
  }

  onReturnToAccounts(): void {
    this.showUpgrade.set(false);
    this.showAchievement.set(false);
    this.showSettings.set(false);
    this.phase.set('gate');
  }
}
