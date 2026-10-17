import { referenceStats } from '../meta/progression';
import { BOSSES, bossAbilities, bossFor, isBonusLevel, REWARD_FROM, themeFor, UNITS } from './content';
import { irange, mulberry32, pick, range, type Rng } from './rng';
import { ROAD_HALF_WIDTH, type EntitySpec, type GateSpec, type LevelSpec, type Reward, type UnitKind } from './types';

export { themeFor } from './content';

type Mod = Pick<GateSpec, 'op' | 'value'>;

export function applyMod(count: number, op: GateSpec['op'], value: number): number {
  if (op === 'add') return Math.max(0, count + value);
  if (op === 'mul') return count * value;
  return Math.ceil(count / value);
}

function goodMod(rng: Rng, e: number, level: number): Mod {
  const roll = rng();
  if (e < 400 && roll < 0.3) return { op: 'mul', value: level > 6 && rng() < 0.3 ? 3 : 2 };
  return { op: 'add', value: Math.round(e * range(rng, 0.35, 0.8) + irange(rng, 3, 8)) };
}

function badMod(rng: Rng, e: number, level: number): Mod {
  const roll = rng();
  // the first levels teach the gates: the worse choice is just a smaller bonus
  if (level <= 2) return { op: 'add', value: irange(rng, 1, 3) };
  if (roll < 0.25 && e > 6) return { op: 'div', value: 2 };
  if (roll < 0.4) return { op: 'add', value: irange(rng, 1, 4) };
  // never wipe out the expected army outright; be gentler while players learn the gates
  const cap = Math.max(1, Math.floor(e * (level <= 3 ? 0.4 : 0.75)));
  return { op: 'add', value: -Math.min(cap, Math.round(e * range(rng, 0.2, 0.55) + irange(rng, 2, 6))) };
}

/**
 * Builds a level as a list of encounters along the track. The generator tracks `e`, the army size a
 * reasonably played run is expected to have, and sizes every encounter relative to it.
 */
export function generateLevel(level: number, failStreak = 0): LevelSpec {
  if (isBonusLevel(level)) return generateBonusLevel(level);
  // each failed attempt on the same level softens it a little, so nobody gets stuck for good
  const ease = 1 - 0.12 * Math.min(5, failStreak);
  // past the tutorial, enemies and bosses grow a little tougher than the expected army
  const hard = level <= 3 ? 1 : 1 + Math.min(HARD_MAX, (level - 3) * 0.03);
  const rng = mulberry32(level * 9973 + 17);
  const ref = referenceStats(level);
  const perSoldierDps = ref.fireRate * ref.damage;
  const gateStep = Math.max(1, Math.round(perSoldierDps * 9));
  const entities: EntitySpec[] = [];

  let e = ref.startArmy;
  let d = 28;
  const segments = 6 + Math.min(8, Math.floor(level / 3));
  let squadRun = 0;

  for (let i = 0; i < segments; i++) {
    const roll = rng();
    let type: 'gates' | 'crates' | 'squad' | 'hazard' | 'barrel' =
      i === 0 ? (level === 1 ? 'crates' : pick(rng, ['gates', 'crates'] as const))
      : roll < 0.36 ? 'gates'
      : roll < 0.66 ? 'squad'
      : roll < 0.8 ? 'crates'
      : roll < 0.9 && level >= 4 ? 'hazard'
      : 'barrel';
    // level 1 is a tutorial without enemies; later levels let the army grow before the first fight
    if (type === 'squad' && (level === 1 || i < 2)) type = rng() < 0.5 ? 'gates' : 'crates';
    // never more than two fights in a row: the army needs a chance to grow back
    if (type === 'squad' && squadRun >= 2) type = 'gates';
    squadRun = type === 'squad' ? squadRun + 1 : 0;

    if (type === 'gates') {
      const goodLeft = rng() < 0.5;
      const mk = (m: Mod, left: boolean, mystery = false): GateSpec => ({
        x0: left ? -ROAD_HALF_WIDTH : 0,
        x1: left ? 0 : ROAD_HALF_WIDTH,
        op: m.op,
        value: m.value,
        step: mystery ? 1e9 : gateStep,
        ...(mystery ? { mystery } : {}),
      });
      if (level >= MYSTERY_FROM && rng() < 0.22) {
        // a safe modest gate next to a "?" gate that is usually great, sometimes awful
        const safe: Mod = { op: 'add', value: Math.round(e * range(rng, 0.2, 0.35)) + irange(rng, 2, 5) };
        const lucky = rng() < 0.65;
        const gamble: Mod = lucky
          ? rng() < 0.5 ? { op: 'mul', value: 2 } : { op: 'add', value: Math.round(e * range(rng, 0.8, 1.1)) + 5 }
          : rng() < 0.5 && e > 6 ? { op: 'div', value: 2 } : { op: 'add', value: -Math.max(1, Math.round(e * 0.35)) };
        entities.push({ kind: 'gates', d, gates: [mk(safe, goodLeft), mk(gamble, !goodLeft, true)] });
        e = applyMod(e, safe.op, safe.value) * 0.95;
      } else {
        const good = goodMod(rng, e, level);
        const bad = badMod(rng, e, level);
        entities.push({ kind: 'gates', d, gates: [mk(good, goodLeft), mk(bad, !goodLeft)] });
        e = applyMod(e, good.op, good.value) * 0.95;
      }
      d += irange(rng, 26, 32);
    } else if (type === 'squad') {
      // the army shoots ~2.6s worth of volleys while a squad charges in; size squads so part of it arrives
      const unit = pickUnit(rng, level);
      const shotDown = e * perSoldierDps * 2.6 * UNIT_EXPOSURE[unit];
      const size = level <= 2 ? range(rng, 0.3, 0.5) : range(rng, 0.55, 0.95);
      const count = Math.max(3, Math.round((shotDown * size + e * range(rng, 0.1, 0.3)) * ease * hard));
      const x = range(rng, -2.2, 2.2);
      entities.push({ kind: 'squad', d: d + 6, x, count, charge: unit === 'cavalry' || (level > 3 && rng() < 0.5), unit });
      e = Math.max(ref.startArmy, e - Math.max(0, count - shotDown) * 0.9);
      d += irange(rng, 30, 36);
    } else if (type === 'hazard') {
      const left = rng() < 0.5;
      const width = range(rng, 4.2, 5.6);
      const x0 = left ? -ROAD_HALF_WIDTH : ROAD_HALF_WIDTH - width;
      entities.push({ kind: 'hazard', d, x0, x1: x0 + width, lethality: range(rng, 0.5, 0.7) });
      e *= 0.92;
      d += irange(rng, 22, 28);
    } else if (type === 'crates') {
      const n = irange(rng, 6, 9);
      const side = rng() < 0.5 ? -1 : 1;
      const per = Math.max(1, Math.round(e * 0.04 + level * 0.3));
      const hp = Math.max(1, Math.round(perSoldierDps * Math.max(3, e * 0.25)));
      for (let k = 0; k < n; k++) {
        entities.push({
          kind: 'barrel', d: d + k * 2.2, x: side * 3.4, hp, small: true,
          reward: { type: 'soldiers', amount: per },
        });
      }
      e += n * per * 0.75;
      d += n * 2.2 + irange(rng, 16, 22);
    } else {
      const pool: Reward[] = [
        { type: 'rapid', amount: 8 },
        { type: 'multi', amount: 1 },
        { type: 'soldiers', amount: Math.round(e * 0.5 + 5) },
        { type: 'coins', amount: 20 + level * 5 },
        { type: 'fire', amount: 8 },
        { type: 'freeze', amount: 4 },
        { type: 'bomb', amount: 1 },
      ];
      const available = pool.filter((r) => level >= REWARD_FROM[r.type]);
      // newly unlocked items show up more often in their debut region
      const fresh = available.filter((r) => REWARD_FROM[r.type] > 1 && level - REWARD_FROM[r.type] < 5);
      const reward: Reward = fresh.length && rng() < 0.5 ? pick(rng, fresh) : pick(rng, available);
      const hp = Math.round(perSoldierDps * e * range(rng, 1.6, 2.6));
      entities.push({ kind: 'barrel', d, x: range(rng, -2.8, 2.8), hp, small: false, reward });
      if (reward.type === 'soldiers') e += reward.amount * 0.8;
      d += irange(rng, 24, 30);
    }
  }

  const bossD = d + 36;
  const kind = bossFor(level);
  const bossTime = (level <= 2 ? 3.5 : 9 + Math.min(8, level * 0.45)) * ease * hard * BOSSES[kind].hpMul;
  entities.push({
    kind: 'boss',
    boss: kind,
    abilities: bossAbilities(level, kind),
    d: bossD,
    hp: Math.round(e * perSoldierDps * bossTime * BOSS_HP),
    damage: Math.ceil(e * (0.12 + Math.min(0.1, level * 0.004))) + 2,
    speed: 2.2 + Math.min(1.2, level * 0.03),
  });

  return { level, theme: themeFor(level), entities, bossD, bonus: false };
}

/** Extra toughness of enemies and bosses at its peak (reached around level 15). */
export const HARD_MAX = 0.35;
/** Overall boss toughness on top of the expected fight length. */
const BOSS_HP = 1.15;

/** Mystery "?" gates show up from this level. */
export const MYSTERY_FROM = 8;

/** How much of a squad the army can shoot down before contact, relative to plain infantry. */
const UNIT_EXPOSURE: Record<UnitKind, number> = { infantry: 1, cavalry: 0.65, archer: 1.1, armored: 0.5, skeleton: 1, goblin: 0.8 };

function pickUnit(rng: Rng, level: number): UnitKind {
  const kinds = (['cavalry', 'archer', 'armored', 'goblin'] as const).filter((k) => level >= UNITS[k].from);
  if (!kinds.length || rng() < 0.45) return 'infantry';
  // the newest unit type appears more often in the region that introduces it
  const newest = kinds[kinds.length - 1];
  if (level - UNITS[newest].from < 5 && rng() < 0.6) return newest;
  return pick(rng, kinds);
}

/** Treasure run: generous gates, crates and coin barrels, then a chest to crack within a time limit. */
function generateBonusLevel(level: number): LevelSpec {
  const rng = mulberry32(level * 7919 + 3);
  const ref = referenceStats(level);
  const perSoldierDps = ref.fireRate * ref.damage;
  const entities: EntitySpec[] = [];
  let e = ref.startArmy;
  let d = 26;
  for (let i = 0; i < 7; i++) {
    if (i % 2 === 0) {
      const a = goodMod(rng, e, level);
      const b: Mod = { op: 'add', value: Math.round(e * range(rng, 0.2, 0.4)) + 3 };
      const left = rng() < 0.5;
      entities.push({
        kind: 'gates', d, gates: [
          { x0: left ? -ROAD_HALF_WIDTH : 0, x1: left ? 0 : ROAD_HALF_WIDTH, op: a.op, value: a.value, step: 1e9 },
          { x0: left ? 0 : -ROAD_HALF_WIDTH, x1: left ? ROAD_HALF_WIDTH : 0, op: b.op, value: b.value, step: 1e9 },
        ],
      });
      e = applyMod(e, a.op, a.value) * 0.9;
      d += 24;
    } else {
      const side = rng() < 0.5 ? -1 : 1;
      for (let k = 0; k < 6; k++) {
        const coin = k % 2 === 0;
        entities.push({
          kind: 'barrel', d: d + k * 2.6, x: coin ? -side * 2.6 : side * 3.4,
          hp: Math.max(1, Math.round(perSoldierDps * e * (coin ? 0.5 : 0.2))), small: !coin,
          reward: coin ? { type: 'coins', amount: 10 + level * 2 } : { type: 'soldiers', amount: Math.max(2, Math.round(e * 0.05)) },
        });
      }
      e *= 1.15;
      d += 6 * 2.6 + 16;
    }
  }
  const bossD = d + 36;
  entities.push({
    kind: 'boss', boss: 'chest', abilities: [], d: bossD,
    hp: Math.round(e * perSoldierDps * 8), damage: 0, speed: 0,
  });
  return { level, theme: themeFor(level), entities, bossD, bonus: true };
}

/** Coins inside a treasure chest. */
export const chestCoins = (level: number) => 60 + level * 18;
