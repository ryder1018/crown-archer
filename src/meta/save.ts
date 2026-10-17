import { Preferences } from '@capacitor/preferences';
import type { SkillKind } from '../sim/types';
import { HEROES, SKINS, type HeroId, type SkinId } from './collection';
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
  /** equipped active skill */
  skill: SkillKind | null;
  /** content the player has been introduced to, e.g. "boss:frost" */
  seen: string[];
  /** hero leading the army, and every hero the player owns */
  hero: HeroId;
  heroes: HeroId[];
  skin: SkinId;
  skins: SkinId[];
  /** day the daily chest was last opened, see todayKey() */
  daily: string;
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
    skill: null,
    seen: [],
    hero: 'king',
    heroes: ['king'],
    skin: 'azure',
    skins: ['azure'],
    daily: '',
  };
}

const HERO_IDS = new Set<string>(HEROES.map((h) => h.id));
const SKIN_IDS = new Set<string>(SKINS.map((s) => s.id));

function idList<T extends string>(raw: unknown, valid: Set<string>, base: T): T[] {
  const list = Array.isArray(raw) ? raw.filter((x): x is T => typeof x === 'string' && valid.has(x)) : [];
  return [...new Set([base, ...list])];
}

export function parseSave(raw: string | null): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    const out: SaveData = {
      ...base,
      ...data,
      version: 1,
      level: Math.max(1, Math.floor(Number(data.level) || 1)),
      failStreak: Math.max(0, Math.floor(Number(data.failStreak) || 0)),
      coins: Math.max(0, Math.floor(Number(data.coins) || 0)),
      upgrades: { ...base.upgrades, ...data.upgrades },
      settings: { ...base.settings, ...data.settings },
      stats: { ...base.stats, ...data.stats },
      skill: data.skill === 'storm' || data.skill === 'freeze' || data.skill === 'horn' ? data.skill : null,
      seen: Array.isArray(data.seen) ? data.seen.filter((x): x is string => typeof x === 'string') : [],
      heroes: idList(data.heroes, HERO_IDS, base.hero),
      skins: idList(data.skins, SKIN_IDS, base.skin),
      daily: typeof data.daily === 'string' ? data.daily : '',
    };
    if (!out.heroes.includes(out.hero)) out.hero = base.hero;
    if (!out.skins.includes(out.skin)) out.skin = base.skin;
    return out;
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
