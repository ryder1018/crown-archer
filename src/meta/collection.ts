import { bossFor, CYCLE, isRegionFinal, LEVELS_PER_THEME, THEME_ORDER } from '../sim/content';
import { NO_PERKS, type BossKind, type Perks, type Stats, type Theme } from '../sim/types';

/** Bosses become playable heroes once their region is cleared. */
export type BossHero = Exclude<BossKind, 'chest'>;
export type HeroId = 'king' | 'knight' | 'ranger' | 'mage' | BossHero;

export interface HeroDef {
  id: HeroId;
  /** coins to buy it; boss heroes are earned instead */
  price: number;
  /** region whose final boss grants this hero */
  region: Theme | null;
  perks: Partial<Perks>;
  stats: { armyAdd?: number; armyMul?: number; rate?: number; damage?: number };
}

const hero = (id: HeroId, price: number, region: Theme | null, perks: Partial<Perks>, stats: HeroDef['stats'] = {}): HeroDef =>
  ({ id, price, region, perks, stats });

export const HEROES: HeroDef[] = [
  hero('king', 0, null, {}, { armyAdd: 3 }),
  hero('knight', 900, null, { meleeTaken: 0.75 }),
  hero('ranger', 1800, null, {}, { rate: 1.12 }),
  hero('mage', 3200, null, { skillCharge: 1.4, skillStart: 0.3 }),
  hero('giant', 0, 'river', {}, { armyMul: 1.2 }),
  hero('troll', 0, 'meadow', { hazardTaken: 0.4 }),
  hero('frost', 0, 'snow', { enemySpeed: 0.8 }),
  hero('warlord', 0, 'desert', { coinMul: 1.25 }),
  hero('golem', 0, 'volcano', { bossTaken: 0.7 }),
  hero('lich', 0, 'night', { raise: 0.1 }),
  hero('ape', 0, 'jungle', {}, { damage: 1.15 }),
  hero('witch', 0, 'swamp', { skillStart: 1 }),
  hero('titan', 0, 'sky', {}, { rate: 1.1, damage: 1.1 }),
];

export const heroDef = (id: HeroId) => HEROES.find((h) => h.id === id) ?? HEROES[0];

export const isBossHero = (id: HeroId): id is BossHero => heroDef(id).region !== null;

export function heroPerks(id: HeroId): Perks {
  return { ...NO_PERKS, ...heroDef(id).perks };
}

/** Applies the hero's stat bonuses on top of the upgrades. */
export function heroStats(base: Stats, id: HeroId): Stats {
  const s = heroDef(id).stats;
  return {
    ...base,
    startArmy: Math.round((base.startArmy + (s.armyAdd ?? 0)) * (s.armyMul ?? 1)),
    fireRate: base.fireRate * (s.rate ?? 1),
    damage: base.damage * (s.damage ?? 1),
  };
}

/** The level that ends `region` on the first pass through the campaign. */
export const regionFinalLevel = (region: Theme) => (THEME_ORDER.indexOf(region) + 1) * LEVELS_PER_THEME;

/** Boss hero recruited by winning `level`, if it ends a region. */
export function heroForWin(level: number): BossHero | null {
  return isRegionFinal(level) ? bossFor(level) : null;
}

/** Boss heroes a player at `level` has already earned (used to backfill older saves). */
export function earnedHeroes(level: number): BossHero[] {
  const out: BossHero[] = [];
  for (let l = LEVELS_PER_THEME; l < level && l <= CYCLE; l += LEVELS_PER_THEME) out.push(bossFor(l));
  return out;
}

export type SkinId = 'azure' | 'emerald' | 'violet' | 'sunset' | 'sakura' | 'shadow' | 'gold';

export interface SkinDef {
  id: SkinId;
  price: number;
  /** earned by clearing the whole campaign instead of bought */
  champion?: boolean;
  /** tunic, trim / hat, arrow fletching */
  colors: [number, number, number];
}

export const SKINS: SkinDef[] = [
  { id: 'azure', price: 0, colors: [0x2f7bff, 0x1d4fb8, 0xff6a3d] },
  { id: 'emerald', price: 500, colors: [0x2fb85a, 0x1d7a3a, 0xffe066] },
  { id: 'violet', price: 900, colors: [0x8a4fff, 0x5a2fb8, 0x7fe8ff] },
  { id: 'sunset', price: 1400, colors: [0xff8a1a, 0xc05a00, 0xffffff] },
  { id: 'sakura', price: 2000, colors: [0xff7ab8, 0xd04a8a, 0xffffff] },
  { id: 'shadow', price: 3000, colors: [0x3a3f4a, 0x1e2128, 0xb05cff] },
  { id: 'gold', price: 0, champion: true, colors: [0xffc93c, 0xc98700, 0xff4a4a] },
];

export const skinDef = (id: SkinId) => SKINS.find((s) => s.id === id) ?? SKINS[0];

/** Daily chest: a coin gift once per calendar day that grows with progress. */
export const dailyCoins = (level: number) => 60 + level * 15;

export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
