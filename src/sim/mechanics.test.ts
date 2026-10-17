import { describe, expect, it } from 'vitest';
import { statsFor } from '../meta/progression';
import { generateLevel } from './levelgen';
import { bossAbilities, bossFor, isBonusLevel, themeFor, unlockedSkills } from './content';
import { botSteer } from './bot';
import { circleOverlap, World } from './world';
import { NO_PERKS, type BossAbility, type BossKind, type EntitySpec, type LevelSpec, type UnitKind } from './types';

const stats = (lv = 0) => statsFor({ army: lv, rate: lv, damage: lv, income: 0 });

function level(entities: EntitySpec[], bossD = 300, boss: BossKind = 'giant', abilities: BossAbility[] = ['smash'], hp = 1e9): LevelSpec {
  return {
    level: 10, theme: 'river', bossD, bonus: boss === 'chest',
    entities: [...entities, { kind: 'boss', d: bossD, hp, damage: 5, speed: 2, boss, abilities }],
  };
}

const squad = (d: number, count: number, unit: UnitKind = 'infantry'): EntitySpec => ({ kind: 'squad', d, x: 0, count, charge: false, unit });

const step = (w: World, seconds: number, each?: () => void) => {
  for (let i = 0; i < seconds * 60 && w.state === 'playing'; i++) {
    each?.();
    w.update(1 / 60);
  }
};

describe('content', () => {
  it('maps regions, bosses and unlocks', () => {
    expect(themeFor(1)).toBe('river');
    expect(themeFor(21)).toBe('volcano');
    expect(themeFor(30)).toBe('night');
    expect(themeFor(31)).toBe('jungle');
    expect(themeFor(45)).toBe('sky');
    expect(themeFor(46)).toBe('river');
    expect(bossFor(38)).toBe('witch');
    expect(bossFor(12)).toBe('frost');
    expect(bossAbilities(3, 'giant')).toEqual(['smash']);
    expect(bossAbilities(48, 'giant')).toContain('enrage');
    expect(isBonusLevel(7)).toBe(true);
    expect(isBonusLevel(8)).toBe(false);
    expect(unlockedSkills(2)).toEqual([]);
    expect(unlockedSkills(12)).toEqual(['storm', 'freeze']);
  });

  it('generates the new unit types and items in their regions', () => {
    const units = new Set<string>();
    const rewards = new Set<string>();
    for (let lv = 1; lv <= 30; lv++) {
      for (const e of generateLevel(lv).entities) {
        if (e.kind === 'squad') units.add(`${e.unit}@${lv}`);
        if (e.kind === 'barrel') rewards.add(`${e.reward.type}@${lv}`);
      }
    }
    const firstLevel = (prefix: string, set: Set<string>) =>
      Math.min(...[...set].filter((s) => s.startsWith(prefix + '@')).map((s) => Number(s.split('@')[1])));
    expect(firstLevel('cavalry', units)).toBeGreaterThanOrEqual(6);
    expect(firstLevel('archer', units)).toBeGreaterThanOrEqual(11);
    expect(firstLevel('armored', units)).toBeGreaterThanOrEqual(16);
    expect(firstLevel('cavalry', units)).toBeLessThan(11);
    expect(firstLevel('fire', rewards)).toBeGreaterThanOrEqual(6);
    expect(firstLevel('bomb', rewards)).toBeGreaterThanOrEqual(16);
  });
});

describe('mechanics', () => {
  it('computes circle overlaps', () => {
    expect(circleOverlap(10, 1, 1)).toBe(0);
    expect(circleOverlap(0, 2, 1)).toBeCloseTo(Math.PI);
    const half = circleOverlap(1, 1, 1);
    expect(half).toBeGreaterThan(0.9);
    expect(half).toBeLessThan(1.4);
  });

  it('boss projectiles only hurt an army that stays put', () => {
    const run = (dodge: boolean) => {
      const w = new World(level([], 60, 'troll', ['throw']), stats(10));
      const start = w.army.count;
      step(w, 6, () => {
        if (dodge && w.shots.length) w.setTargetX(w.shots[0].x > 0 ? -4.5 : 4.5);
      });
      return { lost: start - w.army.count, w };
    };
    const still = run(false);
    const dodging = run(true);
    expect(still.lost).toBeGreaterThan(0);
    expect(dodging.lost).toBeLessThan(still.lost * 0.5);
  });

  it('armoured squads shrug off arrows', () => {
    const left = (unit: UnitKind) => {
      const w = new World(level([squad(60, 500, unit)]), stats(5));
      step(w, 3.5);
      return w.squads[0].count;
    };
    expect(left('armored')).toBeGreaterThan(left('infantry'));
  });

  it('enemy archers shoot from range', () => {
    const w = new World(level([squad(45, 300, 'archer')]), stats(10));
    let volleys = 0;
    step(w, 4, () => {
      volleys += w.events.filter((e) => e.type === 'enemyVolley').length;
    });
    expect(volleys).toBeGreaterThan(0);
  });

  it('freeze stops squads in their tracks', () => {
    const w = new World(level([squad(40, 50)]), stats(0), 1, 'freeze');
    w.skillCharge = 1;
    step(w, 0.5);
    const before = w.squads[0].d;
    expect(w.useSkill()).toBe(true);
    step(w, 1);
    expect(w.frozen).toBe(true);
    expect(w.squads[0].d).toBe(before);
  });

  it('the arrow storm and war horn work', () => {
    const storm = new World(level([squad(30, 400)]), stats(5), 1, 'storm');
    const calm = new World(level([squad(30, 400)]), stats(5), 1, null);
    storm.skillCharge = 1;
    step(storm, 0.1);
    step(calm, 0.1);
    storm.useSkill();
    step(storm, 1);
    step(calm, 1);
    expect(storm.squads[0].count).toBeLessThan(calm.squads[0].count);

    const horn = new World(level([]), stats(10), 1, 'horn');
    horn.skillCharge = 1;
    const n = horn.army.count;
    horn.useSkill();
    expect(horn.army.count).toBeGreaterThanOrEqual(n + 10);
    expect(horn.useSkill()).toBe(false);
  });

  it('shields soak up damage and summons add squads', () => {
    const w = new World(level([], 40, 'lich', ['shield', 'summon'], 1e12), stats(10));
    let shieldUp = 0;
    step(w, 12, () => {
      shieldUp += w.events.filter((e) => e.type === 'shieldUp').length;
    });
    expect(shieldUp).toBeGreaterThan(0);
    expect(w.squads.some((s) => s.unit === 'skeleton')).toBe(true);
  });

  it('enrage kicks in at low health', () => {
    const w = new World(level([], 40, 'warlord', ['enrage'], 2000), stats(10));
    let enraged = false;
    step(w, 30, () => {
      enraged ||= w.boss.enraged;
    });
    expect(enraged).toBe(true);
  });

  it('treasure levels end with coins from the chest', () => {
    const w = new World(generateLevel(7), stats(5));
    expect(w.level.bonus).toBe(true);
    expect(w.squads.length).toBe(0);
    let chest = 0;
    step(w, 120, () => {
      botSteer(w);
      for (const e of w.events) if (e.type === 'chestOpen') chest += e.coins;
    });
    expect(w.state).toBe('won');
    expect(chest).toBeGreaterThan(0);
  });

  it('the ape leaps into melee and crushes an army that stays put', () => {
    const run = (dodge: boolean) => {
      const w = new World(level([], 70, 'ape', ['leap']), stats(10));
      const start = w.army.count;
      let landed = false;
      step(w, 8, () => {
        if (dodge && w.shots.length) w.setTargetX(w.shots[0].x > 0 ? -4.5 : 4.5);
        landed ||= w.events.some((e) => e.type === 'shotLand' && e.shot.kind === 'leap');
      });
      return { w, landed, lost: start - w.army.count };
    };
    const still = run(false);
    expect(still.landed).toBe(true);
    expect(still.w.boss.state).toBe('attack');
    expect(run(true).lost).toBeLessThan(still.lost);
  });

  it('poison pools drain only the soldiers standing in them', () => {
    const run = (dodge: boolean) => {
      const w = new World(level([], 60, 'witch', ['poison']), stats(10));
      let pools = 0;
      step(w, 9, () => {
        const threats = [...w.shots, ...w.pools];
        if (dodge && threats.length) w.setTargetX(threats[0].x > 0 ? -4.5 : 4.5);
        pools = Math.max(pools, w.pools.length);
      });
      return { pools, count: w.army.count };
    };
    const still = run(false);
    expect(still.pools).toBeGreaterThan(0);
    expect(run(true).count).toBeGreaterThan(still.count);
  });

  it('lightning strikes in threes and leaves a gap', () => {
    const w = new World(level([], 50, 'titan', ['lightning']), stats(10));
    let bolts = 0;
    step(w, 5, () => {
      bolts = Math.max(bolts, w.shots.filter((s) => s.kind === 'bolt').length);
    });
    expect(bolts).toBeGreaterThanOrEqual(2);
  });

  it('arrows fly through mystery gates and the gate is applied on entry', () => {
    const gates: EntitySpec = {
      kind: 'gates', d: 30, gates: [
        { x0: -5, x1: 0, op: 'mul', value: 2, step: 1e9, mystery: true },
        { x0: 0, x1: 5, op: 'add', value: 3, step: 1, mystery: false },
      ],
    };
    const w = new World(level([gates]), stats(5));
    w.setTargetX(-2.5);
    const start = w.army.count;
    step(w, 1.5);
    expect(w.gates[0].hitTime).toBe(-1);
    step(w, 3);
    expect(w.army.count).toBe(start * 2);
  });

  it('hero perks cut losses and raise fallen enemies', () => {
    const fight = (meleeTaken: number, raise: number) => {
      // arrows that barely scratch, so the squad reaches the army and it comes down to melee
      const weak = { startArmy: 200, fireRate: 1.5, damage: 0.01, income: 1 };
      const w = new World(level([squad(20, 120)]), weak, 1, null, { ...NO_PERKS, meleeTaken, raise });
      let raised = 0;
      step(w, 8, () => {
        for (const e of w.events) if (e.type === 'raise') raised += e.n;
      });
      return { count: w.army.count, raised };
    };
    const plain = fight(1, 0);
    expect(fight(0.5, 0).count).toBeGreaterThan(plain.count);
    expect(fight(1, 0.1).raised).toBe(12);
  });
});
