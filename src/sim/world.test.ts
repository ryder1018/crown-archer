import { describe, expect, it } from 'vitest';
import { referenceStats, statsFor } from '../meta/progression';
import { botSteer } from './bot';
import { applyMod, generateLevel } from './levelgen';
import { World } from './world';
import type { LevelSpec, Stats } from './types';

function play(level: LevelSpec, stats: Stats, seed = 1) {
  const w = new World(level, stats, seed);
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 240 && w.state === 'playing'; i++) {
    botSteer(w);
    w.update(dt);
  }
  return w;
}

describe('levelgen', () => {
  it('is deterministic and ends with a boss', () => {
    const a = generateLevel(7);
    const b = generateLevel(7);
    expect(a).toEqual(b);
    expect(a.entities.at(-1)?.kind).toBe('boss');
  });

  it('applies gate math', () => {
    expect(applyMod(10, 'add', -15)).toBe(0);
    expect(applyMod(10, 'mul', 3)).toBe(30);
    expect(applyMod(11, 'div', 2)).toBe(6);
  });
});

describe('world', () => {
  it('passing a gate applies the gate under the army', () => {
    const level: LevelSpec = {
      level: 1, theme: 'river', bossD: 200, bonus: false,
      entities: [
        { kind: 'gates', d: 10, gates: [
          { x0: -5, x1: 0, op: 'add', value: 7, step: 1000 },
          { x0: 0, x1: 5, op: 'mul', value: 2, step: 1000 },
        ] },
        { kind: 'boss', d: 200, hp: 10, damage: 1, speed: 0, boss: 'giant', abilities: ['smash'] },
      ],
    };
    const w = new World(level, statsFor({ army: 0, rate: 0, damage: 0, income: 0 }));
    w.setTargetX(3);
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    expect(w.army.count).toBe(6);
  });

  it('shooting an add gate raises its value', () => {
    const level: LevelSpec = {
      level: 1, theme: 'river', bossD: 300, bonus: false,
      entities: [
        { kind: 'gates', d: 40, gates: [
          { x0: -5, x1: 0, op: 'add', value: -10, step: 1 },
          { x0: 0, x1: 5, op: 'add', value: -10, step: 1 },
        ] },
        { kind: 'boss', d: 300, hp: 10, damage: 1, speed: 0, boss: 'giant', abilities: ['smash'] },
      ],
    };
    const w = new World(level, statsFor({ army: 5, rate: 0, damage: 0, income: 0 }));
    w.setTargetX(-2.5);
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    expect(w.gates[0].value).toBeGreaterThan(-10);
    expect(w.gates[1].value).toBe(-10);
  });

  it('the boss dies exactly once even when many arrows land together', () => {
    const level: LevelSpec = {
      level: 1, theme: 'river', bossD: 40, bonus: false,
      entities: [{ kind: 'boss', d: 40, hp: 1, damage: 1, speed: 0, boss: 'giant', abilities: ['smash'] }],
    };
    const w = new World(level, statsFor({ army: 40, rate: 10, damage: 0, income: 0 }));
    let deaths = 0;
    let wins = 0;
    for (let i = 0; i < 600 && w.state === 'playing'; i++) {
      w.update(1 / 60);
      deaths += w.events.filter((e) => e.type === 'bossDead').length;
      wins += w.events.filter((e) => e.type === 'win').length;
    }
    expect(deaths).toBe(1);
    expect(wins).toBe(1);
  });

  it('spike traps hit only the soldiers that overlap them', () => {
    const level: LevelSpec = {
      level: 1, theme: 'river', bossD: 200, bonus: false,
      entities: [
        { kind: 'hazard', d: 10, x0: -5, x1: 0, lethality: 1 },
        { kind: 'hazard', d: 20, x0: 0, x1: 5, lethality: 1 },
        { kind: 'boss', d: 200, hp: 10, damage: 1, speed: 0, boss: 'giant', abilities: ['smash'] },
      ],
    };
    const w = new World(level, statsFor({ army: 20, rate: 0, damage: 0, income: 0 }));
    w.setTargetX(-4);
    for (let i = 0; i < 70; i++) w.update(1 / 60);
    expect(w.army.d).toBeGreaterThan(10);
    const afterFirst = w.army.count;
    expect(afterFirst).toBeLessThan(43);
    w.setTargetX(-4);
    for (let i = 0; i < 70; i++) w.update(1 / 60);
    expect(w.army.d).toBeGreaterThan(20);
    expect(w.army.count).toBe(afterFirst);
  });

  it('bot with reference upgrades clears the early game', () => {
    for (let lv = 1; lv <= 10; lv++) {
      const w = play(generateLevel(lv), referenceStats(lv));
      expect(w.state, `level ${lv}`).toBe('won');
    }
  });

  it('prints a balance table', () => {
    const rows: string[] = [];
    for (const lv of [1, 2, 3, 5, 8, 12, 16, 20, 25, 30, 40, 60]) {
      const ref = play(generateLevel(lv), referenceStats(lv));
      const weak = play(generateLevel(lv), referenceStats(Math.max(1, lv - 8)));
      rows.push(
        `L${lv}\tref:${ref.state}(${Math.round(ref.army.count)}, t=${ref.time.toFixed(0)}s, boss ${Math.round(ref.boss.hp)}/${ref.boss.maxHp})` +
          `\tweak:${weak.state}(${Math.round(weak.army.count)}, boss ${Math.round(weak.boss.hp)}/${weak.boss.maxHp})`,
      );
    }
    console.log(rows.join('\n'));
  });
});
