import { referenceStats } from '../meta/progression';
import { irange, mulberry32, pick, range, type Rng } from './rng';
import { ROAD_HALF_WIDTH, type EntitySpec, type GateSpec, type LevelSpec, type Reward, type Theme } from './types';

const THEMES: Theme[] = ['river', 'meadow', 'snow', 'desert'];

export function themeFor(level: number): Theme {
  return THEMES[Math.floor((level - 1) / 5) % THEMES.length];
}

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
  // each failed attempt on the same level softens it a little, so nobody gets stuck for good
  const ease = 1 - 0.1 * Math.min(5, failStreak);
  const rng = mulberry32(level * 9973 + 17);
  const ref = referenceStats(level);
  const perSoldierDps = ref.fireRate * ref.damage;
  const gateStep = Math.max(1, Math.round(perSoldierDps * 9));
  const entities: EntitySpec[] = [];

  let e = ref.startArmy;
  let d = 28;
  const segments = 6 + Math.min(8, Math.floor(level / 3));

  for (let i = 0; i < segments; i++) {
    const roll = rng();
    let type =
      i === 0 ? (level === 1 ? 'crates' : pick(rng, ['gates', 'crates'] as const))
      : roll < 0.36 ? 'gates'
      : roll < 0.66 ? 'squad'
      : roll < 0.8 ? 'crates'
      : roll < 0.9 && level >= 4 ? 'hazard'
      : 'barrel';
    // level 1 is a tutorial without enemies; later levels let the army grow before the first fight
    if (type === 'squad' && (level === 1 || i < 2)) type = rng() < 0.5 ? 'gates' : 'crates';

    if (type === 'gates') {
      const good = goodMod(rng, e, level);
      const bad = badMod(rng, e, level);
      const goodLeft = rng() < 0.5;
      const mk = (m: Mod, left: boolean): GateSpec => ({
        x0: left ? -ROAD_HALF_WIDTH : 0,
        x1: left ? 0 : ROAD_HALF_WIDTH,
        op: m.op,
        value: m.value,
        step: gateStep,
      });
      entities.push({ kind: 'gates', d, gates: [mk(good, goodLeft), mk(bad, !goodLeft)] });
      e = applyMod(e, good.op, good.value) * 0.95;
      d += irange(rng, 26, 32);
    } else if (type === 'squad') {
      // the army shoots ~2.6s worth of volleys while a squad charges in; size squads so part of it arrives
      const shotDown = e * perSoldierDps * 2.6;
      const size = level <= 2 ? range(rng, 0.3, 0.5) : range(rng, 0.55, 0.95);
      const count = Math.max(3, Math.round((shotDown * size + e * range(rng, 0.1, 0.3)) * ease));
      const x = range(rng, -2.2, 2.2);
      entities.push({ kind: 'squad', d: d + 6, x, count, charge: level > 3 && rng() < 0.5 });
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
      const reward: Reward = pick(rng, [
        { type: 'rapid', amount: 8 },
        { type: 'multi', amount: 1 },
        { type: 'soldiers', amount: Math.round(e * 0.5 + 5) },
        { type: 'coins', amount: 20 + level * 5 },
      ] as Reward[]);
      const hp = Math.round(perSoldierDps * e * range(rng, 1.6, 2.6));
      entities.push({ kind: 'barrel', d, x: range(rng, -2.8, 2.8), hp, small: false, reward });
      if (reward.type === 'soldiers') e += reward.amount * 0.8;
      d += irange(rng, 24, 30);
    }
  }

  const bossD = d + 36;
  const bossTime = (level <= 2 ? 3.5 : 7 + Math.min(9, level * 0.35)) * ease;
  entities.push({
    kind: 'boss',
    d: bossD,
    hp: Math.round(e * perSoldierDps * bossTime),
    damage: Math.ceil(e * (0.12 + Math.min(0.1, level * 0.004))) + 2,
    speed: 2.2 + Math.min(1.2, level * 0.03),
  });

  return { level, theme: themeFor(level), entities, bossD };
}
