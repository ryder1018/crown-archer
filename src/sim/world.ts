import { applyMod } from './levelgen';
import { mulberry32, type Rng } from './rng';
import {
  ARMY_SPEED, ARROW_RANGE, ARROW_SPEED, FORMATION_SPACING, MAX_ARMY_DISPLAY, MAX_ARROWS, ROAD_HALF_WIDTH,
  type GateOp, type LevelSpec, type Reward, type Stats,
} from './types';

export interface Arrow { x: number; d: number; dmg: number; life: number; alive: boolean }

export interface Gate {
  id: number; row: number; d: number; x0: number; x1: number;
  op: GateOp; value: number; step: number; acc: number;
  passed: boolean; chosen: boolean; hitTime: number;
}

export interface Unit { ox: number; od: number; alive: boolean }

export interface Squad {
  id: number; d: number; x: number; count: number; startCount: number; per: number;
  units: Unit[]; halfW: number; halfD: number;
  charge: boolean; aggro: boolean; engaged: boolean; gone: boolean; tradeAcc: number;
}

export interface Barrel {
  id: number; d: number; x: number; r: number; hp: number; maxHp: number;
  reward: Reward; small: boolean; broken: boolean; gone: boolean; hitTime: number;
}

export interface Hazard { id: number; d: number; x0: number; x1: number; lethality: number; passed: boolean }

export type BossState = 'idle' | 'walk' | 'attack' | 'dead';

export interface Boss {
  d: number; x: number; hp: number; maxHp: number; damage: number; speed: number;
  state: BossState; attackTimer: number; hitTime: number; smashTime: number;
}

export interface Army {
  x: number; targetX: number; d: number; count: number;
  fireTimer: number; rapidTimer: number; multishot: number; engaged: boolean;
}

export type WorldEvent =
  | { type: 'fire'; n: number }
  | { type: 'unitDie'; x: number; d: number }
  | { type: 'soldierLoss'; n: number }
  | { type: 'gatePass'; delta: number; gate: Gate }
  | { type: 'barrelHit'; barrel: Barrel }
  | { type: 'barrelBreak'; barrel: Barrel }
  | { type: 'squadDead'; squad: Squad }
  | { type: 'hazardHit'; n: number; hazard: Hazard }
  | { type: 'bossHit' }
  | { type: 'bossSmash'; n: number }
  | { type: 'bossDead' }
  | { type: 'coins'; n: number; x: number; d: number }
  | { type: 'win' }
  | { type: 'lose' };

export type WorldState = 'playing' | 'won' | 'lost';

export const armyRadius = (count: number) =>
  0.3 + FORMATION_SPACING * Math.sqrt(Math.min(count, MAX_ARMY_DISPLAY));

const SQUAD_SPACING = 0.5;
const SQUAD_MAX_UNITS = 140;
const AGGRO_RANGE = 40;
const SQUAD_SPEED = 4.5;
const BOSS_WAKE_RANGE = 52;
const BOSS_ARENA_GAP = 26;
const BOSS_REACH = 2.4;
const BOSS_ATTACK_INTERVAL = 1.3;
export const BOSS_HALF_WIDTH = 2.2;

export class World {
  state: WorldState = 'playing';
  time = 0;
  coinsEarned = 0;
  readonly army: Army;
  readonly arrows: Arrow[] = [];
  readonly gates: Gate[] = [];
  readonly squads: Squad[] = [];
  readonly barrels: Barrel[] = [];
  readonly hazards: Hazard[] = [];
  readonly boss: Boss;
  readonly events: WorldEvent[] = [];
  private endTimer = -1;
  private readonly rng: Rng;

  constructor(readonly level: LevelSpec, readonly stats: Stats, seed = 1) {
    this.rng = mulberry32(seed);
    this.army = {
      x: 0, targetX: 0, d: 0, count: stats.startArmy,
      fireTimer: 0.2, rapidTimer: 0, multishot: 1, engaged: false,
    };
    let id = 0;
    let row = 0;
    let boss: Boss | undefined;
    for (const e of level.entities) {
      if (e.kind === 'gates') {
        for (const g of e.gates) {
          this.gates.push({ id: id++, row, d: e.d, ...g, acc: 0, passed: false, chosen: false, hitTime: -1 });
        }
        row++;
      } else if (e.kind === 'squad') {
        this.squads.push(makeSquad(id++, e.d, e.x, e.count, e.charge));
      } else if (e.kind === 'barrel') {
        this.barrels.push({
          id: id++, d: e.d, x: e.x, r: e.small ? 0.7 : 1.1, hp: e.hp, maxHp: e.hp,
          reward: e.reward, small: e.small, broken: false, gone: false, hitTime: -1,
        });
      } else if (e.kind === 'hazard') {
        this.hazards.push({ id: id++, d: e.d, x0: e.x0, x1: e.x1, lethality: e.lethality, passed: false });
      } else {
        boss = {
          d: e.d, x: 0, hp: e.hp, maxHp: e.hp, damage: e.damage, speed: e.speed,
          state: 'idle', attackTimer: 0.6, hitTime: -1, smashTime: -1,
        };
      }
    }
    if (!boss) throw new Error('level without boss');
    this.boss = boss;
  }

  get progress() {
    return Math.min(1, this.army.d / (this.level.bossD - BOSS_ARENA_GAP));
  }

  get armyRadius() {
    return armyRadius(this.army.count);
  }

  setTargetX(x: number) {
    this.army.targetX = clamp(x, -ROAD_HALF_WIDTH + 0.5, ROAD_HALF_WIDTH - 0.5);
  }

  update(dt: number) {
    this.events.length = 0;
    if (this.state !== 'playing') return;
    this.time += dt;
    if (this.endTimer >= 0) {
      this.endTimer -= dt;
      this.updateArrows(dt);
      if (this.endTimer < 0) {
        this.state = 'won';
        this.events.push({ type: 'win' });
      }
      return;
    }
    this.moveArmy(dt);
    this.fire(dt);
    this.updateArrows(dt);
    this.updateGates();
    this.updateBarrels();
    this.updateHazards();
    this.updateSquads(dt);
    this.updateBoss(dt);
    if (this.army.count <= 0) {
      this.army.count = 0;
      this.state = 'lost';
      this.events.push({ type: 'lose' });
    }
  }

  private moveArmy(dt: number) {
    const a = this.army;
    // keep big formations on the bridge
    const limit = ROAD_HALF_WIDTH - 0.5 - Math.max(0, this.armyRadius - 0.8) * 0.8;
    a.x += (clamp(a.targetX, -limit, limit) - a.x) * Math.min(1, dt * 12);
    a.engaged = this.squads.some((s) => s.engaged);
    const arenaD = this.boss.d - BOSS_ARENA_GAP;
    if (!a.engaged && a.d < arenaD) a.d = Math.min(arenaD, a.d + ARMY_SPEED * dt);
    if (a.rapidTimer > 0) a.rapidTimer = Math.max(0, a.rapidTimer - dt);
  }

  private fire(dt: number) {
    const a = this.army;
    if (a.count <= 0) return;
    const rate = this.stats.fireRate * (a.rapidTimer > 0 ? 2 : 1);
    a.fireTimer -= dt;
    while (a.fireTimer <= 0) {
      a.fireTimer += 1 / rate;
      const shooters = Math.min(Math.ceil(a.count), 18);
      const dmg = (a.count * this.stats.damage) / shooters;
      const r = this.armyRadius * 0.85;
      let spawned = 0;
      for (let i = 0; i < shooters; i++) {
        const ang = this.rng() * Math.PI * 2;
        const rad = Math.sqrt(this.rng()) * r;
        const x = a.x + Math.cos(ang) * rad;
        const d = a.d + Math.sin(ang) * rad;
        for (let m = 0; m < a.multishot; m++) {
          const off = (m - (a.multishot - 1) / 2) * 0.35;
          if (this.spawnArrow(x + off, d, dmg)) spawned++;
        }
      }
      this.events.push({ type: 'fire', n: spawned });
    }
  }

  private spawnArrow(x: number, d: number, dmg: number) {
    let arrow = this.arrows.find((ar) => !ar.alive);
    if (!arrow) {
      if (this.arrows.length >= MAX_ARROWS) return false;
      arrow = { x: 0, d: 0, dmg: 0, life: 0, alive: false };
      this.arrows.push(arrow);
    }
    arrow.x = clamp(x, -ROAD_HALF_WIDTH + 0.1, ROAD_HALF_WIDTH - 0.1);
    arrow.d = d;
    arrow.dmg = dmg;
    arrow.life = ARROW_RANGE / ARROW_SPEED;
    arrow.alive = true;
    return true;
  }

  private updateArrows(dt: number) {
    const reach = this.army.d + ARROW_RANGE + 4;
    const gates = this.gates.filter((g) => !g.passed && g.op === 'add' && g.d < reach);
    const barrels = this.barrels.filter((b) => !b.broken && !b.gone && b.d < reach);
    const squads = this.squads.filter((s) => !s.gone && s.count > 0 && s.d - s.halfD < reach);
    const boss = this.boss.state !== 'dead' && this.boss.d < reach ? this.boss : null;

    for (const ar of this.arrows) {
      if (!ar.alive) continue;
      const d0 = ar.d;
      ar.d += ARROW_SPEED * dt;
      ar.life -= dt;
      if (ar.life <= 0) {
        ar.alive = false;
        continue;
      }
      const d1 = ar.d;
      if (this.hitGates(ar, d0, d1, gates)) continue;
      if (this.hitBarrels(ar, d0, d1, barrels)) continue;
      if (this.hitSquads(ar, d0, d1, squads)) continue;
      if (boss && Math.abs(ar.x - boss.x) < BOSS_HALF_WIDTH && d1 >= boss.d - 1.2 && d0 <= boss.d + 1.2) {
        ar.alive = false;
        boss.hp -= ar.dmg;
        boss.hitTime = this.time;
        this.events.push({ type: 'bossHit' });
        if (boss.hp <= 0) {
          boss.hp = 0;
          boss.state = 'dead';
          this.events.push({ type: 'bossDead' });
          this.endTimer = 1.6;
        }
      }
    }
  }

  private hitGates(ar: Arrow, d0: number, d1: number, gates: Gate[]) {
    for (const g of gates) {
      if (g.d < d0 || g.d > d1 || ar.x < g.x0 || ar.x > g.x1) continue;
      ar.alive = false;
      g.acc += ar.dmg;
      if (g.acc >= g.step) {
        const inc = Math.floor(g.acc / g.step);
        g.acc -= inc * g.step;
        g.value += inc;
      }
      g.hitTime = this.time;
      return true;
    }
    return false;
  }

  private hitBarrels(ar: Arrow, d0: number, d1: number, barrels: Barrel[]) {
    for (const b of barrels) {
      if (b.broken || Math.abs(ar.x - b.x) > b.r || b.d + b.r < d0 || b.d - b.r > d1) continue;
      ar.alive = false;
      b.hp -= ar.dmg;
      b.hitTime = this.time;
      this.events.push({ type: 'barrelHit', barrel: b });
      if (b.hp <= 0) this.breakBarrel(b);
      return true;
    }
    return false;
  }

  private breakBarrel(b: Barrel) {
    b.hp = 0;
    b.broken = true;
    const a = this.army;
    const r = b.reward;
    if (r.type === 'soldiers') a.count += r.amount;
    else if (r.type === 'rapid') a.rapidTimer = Math.max(a.rapidTimer, r.amount);
    else if (r.type === 'multi') a.multishot = Math.min(3, a.multishot + r.amount);
    else {
      this.coinsEarned += r.amount;
      this.events.push({ type: 'coins', n: r.amount, x: b.x, d: b.d });
    }
    this.events.push({ type: 'barrelBreak', barrel: b });
  }

  private hitSquads(ar: Arrow, d0: number, d1: number, squads: Squad[]) {
    for (const s of squads) {
      if (s.count <= 0) continue;
      if (Math.abs(ar.x - s.x) > s.halfW + 0.25 || s.d - s.halfD > d1 || s.d + s.halfD < d0) continue;
      ar.alive = false;
      this.damageSquad(s, ar.dmg, ar.x);
      return true;
    }
    return false;
  }

  private damageSquad(s: Squad, dmg: number, nearX: number) {
    s.count = Math.max(0, s.count - dmg);
    const target = Math.ceil(s.count / s.per - 1e-9);
    let alive = 0;
    for (const u of s.units) if (u.alive) alive++;
    while (alive > target) {
      let best: Unit | null = null;
      let bestScore = Infinity;
      for (const u of s.units) {
        if (!u.alive) continue;
        const score = Math.abs(s.x + u.ox - nearX) + u.od * 1.5;
        if (score < bestScore) {
          bestScore = score;
          best = u;
        }
      }
      if (!best) break;
      best.alive = false;
      alive--;
      this.events.push({ type: 'unitDie', x: s.x + best.ox, d: s.d + best.od });
    }
    if (s.count <= 0) {
      s.gone = true;
      s.engaged = false;
      this.events.push({ type: 'squadDead', squad: s });
    }
  }

  private updateGates() {
    const a = this.army;
    for (const g of this.gates) {
      if (g.passed || a.d < g.d) continue;
      const row = this.gates.filter((o) => o.row === g.row);
      for (const o of row) o.passed = true;
      const chosen = row.find((o) => a.x >= o.x0 && a.x <= o.x1) ?? row[0];
      chosen.chosen = true;
      const before = Math.round(a.count);
      a.count = Math.round(applyMod(a.count, chosen.op, chosen.value));
      this.events.push({ type: 'gatePass', delta: a.count - before, gate: chosen });
    }
  }

  private updateHazards() {
    const a = this.army;
    for (const h of this.hazards) {
      if (h.passed || a.d < h.d) continue;
      h.passed = true;
      // soldiers are spread over [x - r, x + r]; the overlapping share walks into the spikes
      const r = this.armyRadius;
      const overlap = Math.max(0, Math.min(a.x + r, h.x1) - Math.max(a.x - r, h.x0));
      const n = Math.round(a.count * (overlap / (2 * r)) * h.lethality);
      if (n > 0) {
        a.count = Math.max(0, a.count - n);
        this.events.push({ type: 'hazardHit', n, hazard: h });
      }
    }
  }

  private updateBarrels() {
    for (const b of this.barrels) {
      if (!b.broken && !b.gone && b.d < this.army.d - 1.5) b.gone = true;
    }
  }

  private updateSquads(dt: number) {
    const a = this.army;
    const ar = this.armyRadius;
    for (const s of this.squads) {
      if (s.gone) continue;
      const front = s.d - s.halfD;
      if (!s.aggro && front - a.d < AGGRO_RANGE) s.aggro = true;
      const lateral = Math.abs(s.x - a.x) < s.halfW + ar * 0.8;
      if (s.aggro && !s.engaged) {
        s.d -= SQUAD_SPEED * dt;
        if (s.charge) s.x += clamp(a.x - s.x, -1, 1) * 1.6 * dt;
        if (lateral && s.d - s.halfD <= a.d + ar) s.engaged = true;
      }
      if (s.engaged) {
        if (!lateral) {
          s.engaged = false;
          continue;
        }
        s.tradeAcc += dt * Math.max(10, Math.min(a.count, s.count) * 2.5);
        const k = Math.min(Math.floor(s.tradeAcc), Math.ceil(s.count), Math.ceil(a.count));
        if (k > 0) {
          s.tradeAcc -= k;
          a.count = Math.max(0, a.count - k);
          this.events.push({ type: 'soldierLoss', n: k });
          this.damageSquad(s, k, a.x);
        }
      }
      if (!s.gone && s.d + s.halfD < a.d - 3) s.gone = true;
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    const a = this.army;
    if (b.state === 'dead') return;
    if (b.state === 'idle' && b.d - a.d < BOSS_WAKE_RANGE) b.state = 'walk';
    if (b.state === 'walk') {
      b.d -= b.speed * dt;
      b.x += (a.x - b.x) * Math.min(1, dt * 0.8);
      if (b.d - BOSS_REACH <= a.d + this.armyRadius) b.state = 'attack';
    }
    if (b.state === 'attack') {
      b.x += (a.x - b.x) * Math.min(1, dt * 2);
      b.attackTimer -= dt;
      if (b.attackTimer <= 0) {
        b.attackTimer += BOSS_ATTACK_INTERVAL;
        b.smashTime = this.time;
        const n = Math.min(Math.ceil(a.count), b.damage);
        a.count -= n;
        this.events.push({ type: 'bossSmash', n });
      }
    }
  }
}

function makeSquad(id: number, d: number, x: number, count: number, charge: boolean): Squad {
  const per = Math.max(1, Math.ceil(count / SQUAD_MAX_UNITS));
  const n = Math.ceil(count / per);
  const cols = Math.max(3, Math.min(14, Math.ceil(Math.sqrt(n * 1.6))));
  const rows = Math.ceil(n / cols);
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const jitter = ((i * 7919) % 100) / 100 - 0.5;
    units.push({
      ox: (c - (cols - 1) / 2) * SQUAD_SPACING + jitter * 0.12,
      od: (r - (rows - 1) / 2) * SQUAD_SPACING + jitter * 0.1,
      alive: true,
    });
  }
  const halfW = ((cols - 1) / 2) * SQUAD_SPACING + 0.3;
  const halfD = ((rows - 1) / 2) * SQUAD_SPACING + 0.3;
  return {
    id, d, x: clamp(x, -ROAD_HALF_WIDTH + halfW, ROAD_HALF_WIDTH - halfW), count, startCount: count, per, units,
    halfW, halfD, charge, aggro: false, engaged: false, gone: false, tradeAcc: 0,
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
