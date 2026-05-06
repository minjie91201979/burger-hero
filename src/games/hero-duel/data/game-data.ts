/** 英雄对决 — 数据驱动配置（可后续改为 JSON 加载） */

export type HeroVisual = 'warrior' | 'mage' | 'warrior_tint';

export interface SkillDef {
  skillId: string;
  name: string;
  description: string;
  cooldown: number;
  keyIndex: 1 | 2 | 3 | 4;
}

export interface HeroDef {
  heroId: string;
  name: string;
  maxHp: number;
  visual: HeroVisual;
  /** peoples.png 选择界面用帧 */
  peoplesFrame: number;
  tint?: number;
  skills: SkillDef[];
}

export type CardId = 'sha' | 'shan' | 'tao';

export interface CardDef {
  cardId: CardId;
  name: string;
  type: 'Basic';
  description: string;
}

export const GAME_CONFIG = {
  handCardLimit: 10,
  refillInterval: 10,
  startHandCardCount: 5,
  globalCardPool: ['sha', 'shan', 'tao'] as CardId[],
  /** 每局随机生成该范围内的敌人数 */
  enemyCountMin: 1,
  enemyCountMax: 2,
  /** 单个敌人生命值 */
  enemyMaxHp: 10,
  enemyContactDamage: 6,
  enemyContactCooldownMs: 900,
} as const;

export const CARDS: Record<CardId, CardDef> = {
  sha: {
    cardId: 'sha',
    name: '杀',
    type: 'Basic',
    description: '对最近敌人造成 8 点伤害',
  },
  shan: {
    cardId: 'shan',
    name: '闪',
    type: 'Basic',
    description: '抵消下一次受到的伤害',
  },
  tao: {
    cardId: 'tao',
    name: '桃',
    type: 'Basic',
    description: '回复 5 点生命（不超过上限）',
  },
};

export const HEROES: HeroDef[] = [
  {
    heroId: 'zhao_yun',
    name: '赵云',
    maxHp: 9,
    visual: 'warrior',
    peoplesFrame: 0,
    skills: [
      {
        skillId: 'skill_longdan',
        name: '龙胆',
        description: '向前突进，路径上敌人受到 15 伤害',
        cooldown: 4,
        keyIndex: 1,
      },
      {
        skillId: 'skill_danji',
        name: '单骑',
        description: '30% 移速提升，持续 3 秒',
        cooldown: 8,
        keyIndex: 2,
      },
      {
        skillId: 'skill_qitan',
        name: '七探',
        description: '前方连续打击，总计 30 伤害',
        cooldown: 6,
        keyIndex: 3,
      },
    ],
  },
  {
    heroId: 'zhuge_liang',
    name: '诸葛亮',
    maxHp: 7,
    visual: 'mage',
    peoplesFrame: 1,
    skills: [
      {
        skillId: 'skill_guanxing',
        name: '观星',
        description: '敌人 5 秒内受伤 +20%',
        cooldown: 12,
        keyIndex: 1,
      },
      {
        skillId: 'skill_dongfeng',
        name: '东风',
        description: '风墙掠过，敌人眩晕 1 秒',
        cooldown: 10,
        keyIndex: 2,
      },
      {
        skillId: 'skill_kongcheng',
        name: '空城',
        description: '1.5 秒无敌，随后回复 5 生命',
        cooldown: 15,
        keyIndex: 3,
      },
      {
        skillId: 'skill_bazhen',
        name: '八阵',
        description: '三颗雷球环绕，触碰造成 12 伤害',
        cooldown: 9,
        keyIndex: 4,
      },
    ],
  },
  {
    heroId: 'zhang_fei',
    name: '张飞',
    maxHp: 10,
    visual: 'warrior_tint',
    peoplesFrame: 0,
    tint: 0xc62828,
    skills: [
      {
        skillId: 'skill_heduan',
        name: '喝断',
        description: '前方敌人后退并受到 8 伤害',
        cooldown: 5,
        keyIndex: 1,
      },
      {
        skillId: 'skill_paoxiao',
        name: '咆哮',
        description: '6 秒内卡牌伤害 +35%',
        cooldown: 10,
        keyIndex: 2,
      },
      {
        skillId: 'skill_wanjun',
        name: '万军',
        description: '跃起范围重击，20 伤害并减速',
        cooldown: 8,
        keyIndex: 3,
      },
      {
        skillId: 'skill_gangti',
        name: '刚体',
        description: '被动：最大生命 +10%',
        cooldown: 0,
        keyIndex: 4,
      },
    ],
  },
];

export function getHeroDef(id: string): HeroDef | undefined {
  return HEROES.find((h) => h.heroId === id);
}
