import { applyMod } from './levelgen';
import { ROAD_HALF_WIDTH } from './types';
import type { World } from './world';

/** Simple autopilot used by balance tests and the attract-mode demo. */
export function botSteer(w: World) {
  const a = w.army;
  // fire the skill once it is charged and there is something worth hitting
  if (w.skillCharge >= 1 && (w.boss.state === 'walk' || w.boss.state === 'attack' || w.squads.some((s) => !s.gone && s.aggro && s.count > a.count * 0.5))) {
    w.useSkill();
  }
  // step out of the landing zone of incoming boss attacks and out of poison on the road
  const danger = [...w.shots, ...w.pools.filter((p) => Math.abs(p.d - a.d) < p.r + w.armyRadius + 3)];
  if (danger.length) {
    let bestX = a.x;
    let bestScore = -Infinity;
    for (let x = -ROAD_HALF_WIDTH + 0.5; x <= ROAD_HALF_WIDTH - 0.5; x += 0.5) {
      const clearance = Math.min(...danger.map((s) => Math.abs(x - s.x) - s.r));
      const score = Math.min(clearance, w.armyRadius + 0.5) - Math.abs(x - a.x) * 0.05;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }
    w.setTargetX(bestX);
    return;
  }
  const ahead = (d: number) => d > a.d - 0.5 && d < a.d + 44;

  const row = w.gates.filter((g) => !g.passed && ahead(g.d)).sort((p, q) => p.d - q.d);
  if (row.length) {
    const first = row.filter((g) => g.row === row[0].row);
    const best = first.reduce((p, q) => (applyMod(a.count, q.op, q.value) > applyMod(a.count, p.op, p.value) ? q : p));
    const worst = first.find((g) => g !== best && g.op === 'add' && g.value < 0);
    // shoot the bad gate while far away, then slide into the good one
    if (worst && row[0].d - a.d > 18) w.setTargetX((worst.x0 + worst.x1) / 2);
    else w.setTargetX((best.x0 + best.x1) / 2);
    return;
  }
  // dodge traps when one is close
  const trap = w.hazards.find((h) => !h.passed && h.d > a.d && h.d - a.d < 14);
  if (trap) {
    const left = trap.x0 + ROAD_HALF_WIDTH;
    const right = ROAD_HALF_WIDTH - trap.x1;
    w.setTargetX(left > right ? (-ROAD_HALF_WIDTH + trap.x0) / 2 : (trap.x1 + ROAD_HALF_WIDTH) / 2);
    return;
  }
  const squad = w.squads.find((s) => !s.gone && ahead(s.d));
  if (squad) {
    w.setTargetX(squad.x);
    return;
  }
  const barrel = w.barrels.filter((b) => !b.broken && !b.gone && ahead(b.d)).sort((p, q) => p.d - q.d)[0];
  if (barrel) {
    w.setTargetX(barrel.x);
    return;
  }
  w.setTargetX(w.boss.x);
}
