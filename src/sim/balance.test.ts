import { it } from 'vitest';
import { levelReward, referenceStats, statsFor, upgradeCost, UPGRADE_KINDS, type UpgradeLevels } from '../meta/progression';
import { applyMod, generateLevel } from './levelgen';
import { mulberry32 } from './rng';
import { unlockedSkills } from './content';
import { botSteer } from './bot';
import { World } from './world';
import type { Stats } from './types';

/** A less precise player: sometimes picks the wrong gate, never shoots gates on purpose, wobbles. */
function sloppySteer(w: World, rng: () => number, mem: Map<number, number>) {
  const a = w.army;
  const row = w.gates.filter((g) => !g.passed && g.d > a.d && g.d < a.d + 30).sort((p, q) => p.d - q.d);
  if (row.length) {
    const r = row[0].row;
    if (!mem.has(r)) {
      const opts = row.filter((g) => g.row === r);
      const best = opts.reduce((p, q) => (applyMod(a.count, q.op, q.value) > applyMod(a.count, p.op, p.value) ? q : p));
      const pick = rng() < 0.8 ? best : opts.find((g) => g !== best) ?? best;
      mem.set(r, (pick.x0 + pick.x1) / 2);
    }
    w.setTargetX(mem.get(r)! + Math.sin(w.time * 2) * 0.8);
    return;
  }
  botSteer(w);
  w.setTargetX(a.targetX + Math.sin(w.time * 1.3) * 1.2);
}

function run(level: number, stats: Stats, sloppy: boolean, seed: number, failStreak = 0) {
  // players have the arrow storm from level 3 on
  const w = new World(generateLevel(level, failStreak), stats, seed, unlockedSkills(level)[0] ?? null);
  const rng = mulberry32(seed * 31);
  const mem = new Map<number, number>();
  for (let i = 0; i < 60 * 240 && w.state === 'playing'; i++) {
    if (sloppy) sloppySteer(w, rng, mem);
    else botSteer(w);
    w.update(1 / 60);
  }
  return w;
}

it('balance report', () => {
  const none = statsFor({ army: 0, rate: 0, damage: 0, income: 0 });
  const lines = ['lvl  ref  sloppyRef  noUpg  sloppyNoUpg   (win rate over 5 seeds; avg secs)'];
  for (const lv of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 22, 24, 26, 29, 30, 32, 34, 36, 38, 40, 43, 45, 48, 55]) {
    const ref = referenceStats(lv);
    const cell = (stats: Stats, sloppy: boolean) => {
      let wins = 0;
      let t = 0;
      for (let s = 1; s <= 5; s++) {
        const w = run(lv, stats, sloppy, s);
        if (w.state === 'won') wins++;
        t += w.time;
      }
      return `${wins}/5 ${Math.round(t / 5)}s`.padEnd(11);
    };
    lines.push(`${String(lv).padEnd(4)} ${cell(ref, false)} ${cell(ref, true)} ${cell(none, false)} ${cell(none, true)}`);
  }
  console.log(lines.join('\n'));
}, 120000);

it('campaign pacing with a sloppy player who buys the cheapest upgrade', () => {
  const up: UpgradeLevels = { army: 0, rate: 0, damage: 0, income: 0 };
  let coins = 0;
  const attempts: number[] = [];
  const behind: string[] = [];
  let seed = 1;
  for (let lv = 1; lv <= 55; lv++) {
    let tries = 0;
    for (;;) {
      tries++;
      const stats = statsFor(up);
      const w = run(lv, stats, true, seed++, tries - 1);
      const won = w.state === 'won';
      coins += levelReward(lv, won, w.army.count, w.progress, stats.income) + w.coinsEarned;
      for (;;) {
        const kind = UPGRADE_KINDS.reduce((p, q) => (upgradeCost(q, up[q]) < upgradeCost(p, up[p]) ? q : p));
        const cost = upgradeCost(kind, up[kind]);
        if (coins < cost) break;
        coins -= cost;
        up[kind]++;
      }
      if (won || tries >= 15) break;
    }
    attempts.push(tries);
    if (lv % 5 === 0) behind.push(`L${lv}:${UPGRADE_KINDS.map((k) => up[k]).join('/')} vs ref ${referenceStats(lv).startArmy / 2 - 1.5}`);
  }
  console.log('upgrades vs reference:', behind.join('  '));
  console.log('attempts per level:', attempts.join(' '));
  console.log('final upgrades', JSON.stringify(up));
}, 300000);
