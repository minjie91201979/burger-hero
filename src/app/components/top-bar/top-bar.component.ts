import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  readonly gameTitle = input.required<string>();
  /** 为 false 时只渲染右侧按钮（标题由外层顶栏展示） */
  readonly showTitle = input(true);
  readonly toggleUpgrade = output<void>();
  readonly toggleAchievement = output<void>();
  readonly toggleSettings = output<void>();
  readonly returnToAccounts = output<void>();
  /** 返回「选择游戏」列表（不退出当前账号） */
  readonly chooseGame = output<void>();
}
