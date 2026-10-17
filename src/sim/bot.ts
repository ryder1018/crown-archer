import { applyMod } from './levelgen';
import type { World } from './world';

/** Simple autopilot used by balance tests and the attract-mode demo. */
export function botSteer(w: World) {
  const a = w.army;
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
