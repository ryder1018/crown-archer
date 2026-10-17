import { Preferences } from '@capacitor/preferences';
import type { UpgradeLevels } from './progression';

export interface SaveData {
  version: 1;
  level: number;
  /** consecutive losses on the current level */
  failStreak: number;
  coins: number;
  upgrades: UpgradeLevels;
  settings: { sound: boolean; music: boolean; haptics: boolean };
  stats: { wins: number; losses: number; bestArmy: number };
}

const KEY = 'crown-archers-save';

export function defaultSave(): SaveData {
  return {
    version: 1,
    level: 1,
    failStreak: 0,
    coins: 0,
    upgrades: { army: 0, rate: 0, damage: 0, income: 0 },
    settings: { sound: true, music: true, haptics: true },
    stats: { wins: 0, losses: 0, bestArmy: 0 },
  };
}

export function parseSave(raw: string | null): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...base,
      ...data,
      version: 1,
      level: Math.max(1, Math.floor(Number(data.level) || 1)),
      failStreak: Math.max(0, Math.floor(Number(data.failStreak) || 0)),
      coins: Math.max(0, Math.floor(Number(data.coins) || 0)),
      upgrades: { ...base.upgrades, ...data.upgrades },
      settings: { ...base.settings, ...data.settings },
      stats: { ...base.stats, ...data.stats },
    };
  } catch {
    return base;
  }
}

export async function loadSave(): Promise<SaveData> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    return parseSave(value);
  } catch {
    return defaultSave();
  }
}

let pending: Promise<void> = Promise.resolve();

export function writeSave(data: SaveData) {
  const value = JSON.stringify(data);
  pending = pending.then(() => Preferences.set({ key: KEY, value })).catch(() => undefined);
  return pending;
}
