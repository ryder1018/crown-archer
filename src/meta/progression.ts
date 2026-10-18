import type { Stats } from '../sim/types';

export type UpgradeKind = 'army' | 'rate' | 'damage' | 'income';
export const UPGRADE_KINDS: UpgradeKind[] = ['army', 'rate', 'damage', 'income'];

export type UpgradeLevels = Record<UpgradeKind, number>;

export function statsFor(up: UpgradeLevels): Stats {
  return {
    startArmy: 3 + 2 * up.army,
    fireRate: 1.5 * (1 + 0.07 * up.rate),
    damage: 1 + 0.1 * up.damage,
    income: 1 + 0.12 * up.income,
  };
}

/** Stats a player is assumed to have when reaching `level`; levels are tuned against this. */
export function referenceStats(level: number): Stats {
  // upgrade costs grow faster than rewards, so later on players can afford fewer upgrades per level
  const lv = level <= 26 ? Math.floor(Math.max(0, level - 1) * 0.6) : Math.floor(15 + (level - 26) * 0.32);
  return statsFor({ army: lv, rate: lv, damage: lv, income: lv });
}

export function upgradeCost(kind: UpgradeKind, lv: number): number {
  const base = kind === 'income' ? 60 : 40;
  return Math.round(base * Math.pow(1.25, lv) + 10 * lv);
}

export function levelReward(level: number, won: boolean, survivors: number, progress: number, income: number): number {
  const raw = won
    ? 30 + level * 12 + Math.min(survivors, 2000) * 0.2
    : 10 + level * 4 + progress * (20 + level * 10);
  return Math.round(raw * income);
}
