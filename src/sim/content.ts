import type { BossAbility, BossKind, RewardType, SkillKind, Theme, UnitKind } from './types';

/** The campaign loops through these regions, five levels each. */
export const THEME_ORDER: Theme[] = ['river', 'meadow', 'snow', 'desert', 'volcano', 'night'];
export const LEVELS_PER_THEME = 5;
export const CYCLE = THEME_ORDER.length * LEVELS_PER_THEME;

export function themeFor(level: number): Theme {
  return THEME_ORDER[Math.floor((level - 1) / LEVELS_PER_THEME) % THEME_ORDER.length];
}

/** Every 7th level is a treasure run. */
export const isBonusLevel = (level: number) => level >= 7 && level % 7 === 0;

export interface BossDef {
  theme: Theme;
  abilities: BossAbility[];
  /** multiplies the level's base HP; bosses with defensive tricks get less raw HP */
  hpMul: number;
  throwInterval: number;
  summonInterval: number;
}

export const BOSSES: Record<Exclude<BossKind, 'chest'>, BossDef> = {
  giant: { theme: 'river', abilities: ['smash'], hpMul: 1, throwInterval: 0, summonInterval: 0 },
  troll: { theme: 'meadow', abilities: ['smash', 'throw'], hpMul: 0.95, throwInterval: 3.4, summonInterval: 0 },
  frost: { theme: 'snow', abilities: ['smash', 'frost', 'throw'], hpMul: 0.9, throwInterval: 4, summonInterval: 0 },
  warlord: { theme: 'desert', abilities: ['smash', 'summon', 'enrage'], hpMul: 0.75, throwInterval: 0, summonInterval: 4.5 },
  golem: { theme: 'volcano', abilities: ['smash', 'shield', 'throw'], hpMul: 0.72, throwInterval: 3.2, summonInterval: 0 },
  lich: { theme: 'night', abilities: ['smash', 'summon', 'throw', 'shield', 'enrage'], hpMul: 0.55, throwInterval: 3.6, summonInterval: 5.5 },
};

export function bossFor(level: number): Exclude<BossKind, 'chest'> {
  const theme = themeFor(level);
  return (Object.keys(BOSSES) as (keyof typeof BOSSES)[]).find((k) => BOSSES[k].theme === theme)!;
}

/** Abilities of the boss at `level`; after the first loop every boss also enrages. */
export function bossAbilities(level: number, kind: BossKind): BossAbility[] {
  if (kind === 'chest') return [];
  const list = [...BOSSES[kind].abilities];
  if (level > CYCLE && !list.includes('enrage')) list.push('enrage');
  return list;
}

export interface UnitDef {
  speed: number;
  /** share of incoming arrow damage that lands */
  armor: number;
  /** level where the unit starts to appear */
  from: number;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  infantry: { speed: 4.5, armor: 1, from: 1 },
  cavalry: { speed: 10, armor: 1, from: 6 },
  archer: { speed: 4.5, armor: 1, from: 11 },
  armored: { speed: 3.4, armor: 0.45, from: 16 },
  skeleton: { speed: 5, armor: 1, from: Infinity },
};

/** Barrel rewards and the level they start to drop from. */
export const REWARD_FROM: Record<RewardType, number> = {
  soldiers: 1, rapid: 1, multi: 1, coins: 1, fire: 6, freeze: 11, bomb: 16,
};

export const SKILL_UNLOCK: Record<SkillKind, number> = { storm: 3, freeze: 12, horn: 22 };
export const SKILLS: SkillKind[] = ['storm', 'freeze', 'horn'];

export const unlockedSkills = (level: number) => SKILLS.filter((s) => level >= SKILL_UNLOCK[s]);
