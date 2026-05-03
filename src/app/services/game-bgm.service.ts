import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

const MENU_BGM_SRC = 'assets/sound/generate_burger_music.wav';

/**
 * 首页 / 选账号页循环背景音乐；进入厨房（Phaser）时暂停，返回选账号时恢复。
 */
@Injectable({ providedIn: 'root' })
export class GameBgmService {
  private readonly platformId = inject(PLATFORM_ID);
  private audio?: HTMLAudioElement;

  private ensureAudio(): HTMLAudioElement | undefined {
    if (!isPlatformBrowser(this.platformId)) return undefined;
    if (!this.audio) {
      this.audio = new Audio(MENU_BGM_SRC);
      this.audio.loop = true;
      this.audio.volume = 0.28;
      this.audio.preload = 'auto';
    }
    return this.audio;
  }

  /** 在首页或选账号页尝试播放（用户点击后调用更可能通过浏览器自动播放策略） */
  resumeMenuBgm(): void {
    const a = this.ensureAudio();
    if (!a) return;
    void a.play().catch(() => {
      /* 无用户手势时浏览器可能拒绝播放，待下次点击再调 resumeMenuBgm */
    });
  }

  pauseMenuBgm(): void {
    if (!this.audio) return;
    this.audio.pause();
  }
}
