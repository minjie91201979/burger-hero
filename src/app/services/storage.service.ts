import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import type { BurgerHeroStorageRoot, GameSaveData } from '../models/burger-game.model';
import { freshGameSave } from '../models/burger-game.model';
import { randomProfileId } from '../utils/random-id';

const ROOT_KEY = 'burgerHeroStorageRoot';
const LEGACY_SINGLE_SAVE_KEY = 'burgerHeroSave';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseSave(v: unknown): GameSaveData | null {
  if (!isRecord(v)) return null;
  if (typeof v['money'] !== 'number') return null;
  return {
    money: v['money'] as number,
    combo: typeof v['combo'] === 'number' ? v['combo'] : 0,
    upgrades: Array.isArray(v['upgrades']) ? (v['upgrades'] as string[]) : [],
    achievements: Array.isArray(v['achievements']) ? (v['achievements'] as string[]) : [],
    highScore: typeof v['highScore'] === 'number' ? v['highScore'] : 0,
  };
}

function normalizeRoot(raw: unknown): BurgerHeroStorageRoot {
  if (!isRecord(raw) || raw['version'] !== 1) {
    return { version: 1, profiles: [], activeProfileId: null };
  }
  const profilesRaw = raw['profiles'];
  const profiles: BurgerHeroStorageRoot['profiles'] = [];
  if (Array.isArray(profilesRaw)) {
    for (const p of profilesRaw) {
      if (!isRecord(p)) continue;
      const id = typeof p['id'] === 'string' ? p['id'] : '';
      const displayName = typeof p['displayName'] === 'string' ? p['displayName'] : '玩家';
      const createdAt = typeof p['createdAt'] === 'string' ? p['createdAt'] : new Date().toISOString();
      const save = parseSave(p['save']) ?? freshGameSave();
      if (id) profiles.push({ id, displayName, createdAt, save });
    }
  }
  const active =
    typeof raw['activeProfileId'] === 'string' ? (raw['activeProfileId'] as string) : null;
  return { version: 1, profiles, activeProfileId: active };
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);

  async readRoot(): Promise<BurgerHeroStorageRoot> {
    if (!isPlatformBrowser(this.platformId)) {
      return { version: 1, profiles: [], activeProfileId: null };
    }
    if (window.electronAPI?.loadStorageRoot) {
      const raw = await window.electronAPI.loadStorageRoot();
      return normalizeRoot(raw);
    }
    const rootJson = localStorage.getItem(ROOT_KEY);
    if (rootJson) {
      try {
        return normalizeRoot(JSON.parse(rootJson) as unknown);
      } catch {
        return { version: 1, profiles: [], activeProfileId: null };
      }
    }
    const legacy = localStorage.getItem(LEGACY_SINGLE_SAVE_KEY);
    if (legacy) {
      try {
        const save = parseSave(JSON.parse(legacy) as unknown) ?? freshGameSave();
        const id = randomProfileId();
        const migrated: BurgerHeroStorageRoot = {
          version: 1,
          profiles: [
            {
              id,
              displayName: '已迁移存档',
              createdAt: new Date().toISOString(),
              save,
            },
          ],
          activeProfileId: id,
        };
        localStorage.removeItem(LEGACY_SINGLE_SAVE_KEY);
        localStorage.setItem(ROOT_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        localStorage.removeItem(LEGACY_SINGLE_SAVE_KEY);
      }
    }
    return { version: 1, profiles: [], activeProfileId: null };
  }

  async writeRoot(root: BurgerHeroStorageRoot): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (window.electronAPI?.saveStorageRoot) {
      await window.electronAPI.saveStorageRoot(root);
      return;
    }
    localStorage.setItem(ROOT_KEY, JSON.stringify(root));
  }
}
