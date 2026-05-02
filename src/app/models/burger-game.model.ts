export type IngredientId =
  | 'bun_bottom'
  | 'bun_top'
  | 'lettuce'
  | 'cheese'
  | 'patty_raw'
  | 'patty_cooked'
  | 'patty_burnt';

export interface BurgerOrderSnapshot {
  id: string;
  customerName: string;
  ingredients: IngredientId[];
  patience: number;
  maxPatience: number;
}

export interface GameSaveData {
  money: number;
  combo: number;
  upgrades: string[];
  achievements: string[];
  highScore: number;
}

export function freshGameSave(): GameSaveData {
  return {
    money: 100,
    combo: 0,
    upgrades: [],
    achievements: [],
    highScore: 0,
  };
}

export interface GameProfile {
  id: string;
  displayName: string;
  createdAt: string;
  save: GameSaveData;
}

export interface BurgerHeroStorageRoot {
  version: 1;
  profiles: GameProfile[];
  activeProfileId: string | null;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  price: number;
}

export const UPGRADE_CATALOG: UpgradeDef[] = [
  {
    id: 'faster_grill',
    name: '火力加强',
    description: '肉饼烹饪时间缩短约 20%。',
    price: 80,
  },
  {
    id: 'patience_boost',
    name: '顾客耐心',
    description: '顾客等待时间延长 25%。',
    price: 120,
  },
  {
    id: 'extra_slot',
    name: '双槽烤架',
    description: '烤架可同时烹饪两块肉饼。',
    price: 200,
  },
];
