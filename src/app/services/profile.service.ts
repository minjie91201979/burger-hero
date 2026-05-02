import { Injectable, NgZone, inject, signal } from '@angular/core';

import type { BurgerHeroStorageRoot, GameProfile, GameSaveData } from '../models/burger-game.model';
import { freshGameSave } from '../models/burger-game.model';
import { randomProfileId } from '../utils/random-id';
import { GameEventsService } from './game-events.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly storage = inject(StorageService);
  private readonly events = inject(GameEventsService);
  private readonly ngZone = inject(NgZone);

  readonly profiles = signal<GameProfile[]>([]);
  readonly activeProfileId = signal<string | null>(null);
  readonly loaded = signal(false);

  private hydratePromise: Promise<void>;

  constructor() {
    this.hydratePromise = this.hydrate();
  }

  waitUntilLoaded(): Promise<void> {
    return this.hydratePromise;
  }

  activeDisplayName(): string {
    const id = this.activeProfileId();
    const p = this.profiles().find((x) => x.id === id);
    return p?.displayName ?? '—';
  }

  /** 在账号门界面切换当前账号（无 Phaser，不写快照） */
  async setActiveProfile(profileId: string): Promise<void> {
    const root = await this.storage.readRoot();
    if (!root.profiles.some((p) => p.id === profileId)) return;
    const next: BurgerHeroStorageRoot = { ...root, activeProfileId: profileId };
    await this.storage.writeRoot(next);
    this.ngZone.run(() => {
      this.applyRoot(next);
      const p = next.profiles.find((x) => x.id === profileId);
      this.events.initialSave = p ? { ...p.save } : null;
    });
  }

  /** 新建账号并设为当前（用于开始游戏前） */
  async createNewProfile(displayName: string): Promise<string> {
    const name = displayName.trim() || '新玩家';
    const root = await this.storage.readRoot();
    const id = randomProfileId();
    const profile: GameProfile = {
      id,
      displayName: name,
      createdAt: new Date().toISOString(),
      save: freshGameSave(),
    };
    const next: BurgerHeroStorageRoot = {
      version: 1,
      profiles: [...root.profiles, profile],
      activeProfileId: id,
    };
    await this.storage.writeRoot(next);
    this.ngZone.run(() => {
      this.applyRoot(next);
      this.events.initialSave = { ...profile.save };
    });
    return id;
  }

  /** 进入厨房前从磁盘刷新当前账号的存档到 `initialSave` */
  async syncInitialFromActiveProfile(): Promise<void> {
    const root = await this.storage.readRoot();
    const id = root.activeProfileId;
    this.ngZone.run(() => {
      if (!id) {
        this.events.initialSave = null;
      } else {
        const p = root.profiles.find((x) => x.id === id);
        this.events.initialSave = p ? { ...p.save } : null;
      }
    });
  }

  async persistGameSave(data: GameSaveData): Promise<void> {
    const id = this.activeProfileId();
    if (!id) return;
    const root = await this.storage.readRoot();
    const i = root.profiles.findIndex((p) => p.id === id);
    if (i < 0) return;
    root.profiles[i] = { ...root.profiles[i], save: { ...data } };
    await this.storage.writeRoot(root);
    this.ngZone.run(() => this.profiles.set([...root.profiles]));
  }

  private async flushCurrentToDisk(): Promise<void> {
    const id = this.activeProfileId();
    const snap = this.events.readSnapshot();
    if (!id || !snap) return;
    const root = await this.storage.readRoot();
    const i = root.profiles.findIndex((p) => p.id === id);
    if (i < 0) return;
    root.profiles[i] = { ...root.profiles[i], save: { ...snap } };
    await this.storage.writeRoot(root);
    this.ngZone.run(() => this.profiles.set([...root.profiles]));
  }

  private applyRoot(root: BurgerHeroStorageRoot): void {
    this.profiles.set([...root.profiles]);
    this.activeProfileId.set(root.activeProfileId);
  }

  private async hydrate(): Promise<void> {
    let root = await this.storage.readRoot();
    if (root.profiles.length === 0) {
      this.ngZone.run(() => {
        this.applyRoot({ version: 1, profiles: [], activeProfileId: null });
        this.events.initialSave = null;
        this.loaded.set(true);
      });
      return;
    }
    if (
      !root.activeProfileId ||
      !root.profiles.some((p) => p.id === root.activeProfileId)
    ) {
      root = { ...root, activeProfileId: root.profiles[0].id };
      await this.storage.writeRoot(root);
    }
    this.ngZone.run(() => {
      this.applyRoot(root);
      const active = root.profiles.find((p) => p.id === root.activeProfileId);
      this.events.initialSave = active ? { ...active.save } : null;
      this.loaded.set(true);
    });
  }
}
