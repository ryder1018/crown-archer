import { BOSSES, UNITS } from './content';
import { applyMod, chestCoins } from './levelgen';
import { mulberry32, type Rng } from './rng';
import {
  ARMY_SPEED, ARROW_RANGE, ARROW_SPEED, FORMATION_SPACING, MAX_ARMY_DISPLAY, MAX_ARROWS, ROAD_HALF_WIDTH,
  type BossAbility, type BossKind, type GateOp, type LevelSpec, type Reward, type SkillKind, type Stats, type UnitKind,
} from './types';

export interface Arrow { x: number; d: number; dmg: number; life: number; alive: boolean; fire: boolean }

export interface Gate {
  id: number; row: number; d: number; x0: number; x1: number;
  op: GateOp; value: number; step: number; acc: number;
  passed: boolean; chosen: boolean; hitTime: number;
}

export interface Unit { ox: number; od: number; alive: boolean }

export interface Squad {
  id: number; unit: UnitKind; d: number; x: number; count: number; startCount: number; per: number;
  units: Unit[]; halfW: number; halfD: number; speed: number; armor: number;
  charge: boolean; aggro: boolean; engaged: boolean; gone: boolean; tradeAcc: number;
  /** enemy archers: time until the next volley, and whether they hold their firing line */
  volleyTimer: number; holding: boolean;
}

export interface Barrel {
  id: number; d: number; x: number; r: number; hp: number; maxHp: number;
  reward: Reward; small: boolean; broken: boolean; gone: boolean; hitTime: number;
}

export interface Hazard { id: number; d: number; x0: number; x1: number; lethality: number; passed: boolean }

/** A projectile thrown by the boss, aimed at where the army stood when it was thrown. */
export interface BossShot { id: number; x: number; d: number; r: number; t: number; total: number; lethality: number; fromX: number; fromD: number }

export type BossState = 'idle' | 'walk' | 'attack' | 'dead';

export interface Boss {
  kind: BossKind; abilities: Set<BossAbility>;
  d: number; x: number; hp: number; maxHp: number; damage: number; speed: number;
  state: BossState; attackTimer: number; hitTime: number; smashTime: number;
  throwTimer: number; summonTimer: number; shieldTimer: number; shielded: boolean; enraged: boolean;
  /** treasure chest: seconds left once the army reaches it */
  chestTimer: number;
}

export interface Army {
  x: number; targetX: number; d: number; count: number;
  fireTimer: number; rapidTimer: number; multishot: number; engaged: boolean;
  /** fire arrows buff */
  burnTimer: number;
  /** frost debuff from the frost giant: halves the fire rate */
  frostTimer: number;
}

export type WorldEvent =
  | { type: 'fire'; n: number }
  | { type: 'unitDie'; x: number; d: number; unit: UnitKind }
  | { type: 'soldierLoss'; n: number }
  | { type: 'gatePass'; delta: number; gate: Gate }
  | { type: 'barrelHit'; barrel: Barrel }
  | { type: 'barrelBreak'; barrel: Barrel }
  | { type: 'squadDead'; squad: Squad }
  | { type: 'hazardHit'; n: number; hazard: Hazard }
  | { type: 'enemyVolley'; squad: Squad; n: number }
  | { type: 'bossHit' }
  | { type: 'bossSmash'; n: number; frost: boolean }
  | { type: 'bossThrow'; shot: BossShot }
  | { type: 'shotLand'; shot: BossShot; n: number }
  | { type: 'bossSummon'; squad: Squad }
  | { type: 'shieldUp' }
  | { type: 'shieldDown' }
  | { type: 'bossEnrage' }
  | { type: 'bossDead' }
  | { type: 'chestOpen'; coins: number }
  | { type: 'bomb'; points: { x: number; d: number }[] }
  | { type: 'freeze' }
  | { type: 'skill'; skill: SkillKind; gained?: number }
  | { type: 'stormTick'; points: { x: number; d: number }[] }
  | { type: 'coins'; n: number; x: number; d: number }
  | { type: 'win' }
  | { type: 'lose' };

export type WorldState = 'playing' | 'won' | 'lost';

export const armyRadius = (count: number) =>
  0.3 + FORMATION_SPACING * Math.sqrt(Math.min(count, MAX_ARMY_DISPLAY));

const SQUAD_SPACING = 0.5;
const SQUAD_MAX_UNITS = 140;
const AGGRO_RANGE = 40;
const ARCHER_HOLD = 18;
const ARCHER_RANGE = 27;
const ARCHER_INTERVAL = 1.3;
const BOSS_WAKE_RANGE = 52;
const BOSS_ARENA_GAP = 26;
const BOSS_REACH = 2.4;
const BOSS_ATTACK_INTERVAL = 1.3;
const SHOT_FLIGHT = 1.4;
const SHIELD_UP = 2.5;
const SHIELD_DOWN = 5.5;
const SHIELD_FACTOR = 0.15;
const ENRAGE_AT = 0.35;
const CHEST_TIME = 14;
const SKILL_CHARGE_TIME = 22;
const STORM_TIME = 2.4;
const STORM_TICK = 0.12;
export const FREEZE_TIME = 5;
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
  readonly shots: BossShot[] = [];
  readonly boss: Boss;
  readonly events: WorldEvent[] = [];
  /** enemies are frozen solid while this runs */
  freezeTimer = 0;
  skillCharge = 0;
  private stormTimer = 0;
  private stormTick = 0;
  private endTimer = -1;
  private nextId = 0;
  private readonly rng: Rng;

  constructor(readonly level: LevelSpec, readonly stats: Stats, seed = 1, readonly skill: SkillKind | null = null) {
    this.rng = mulberry32(seed);
    this.army = {
      x: 0, targetX: 0, d: 0, count: stats.startArmy,
      fireTimer: 0.2, rapidTimer: 0, multishot: 1, engaged: false, burnTimer: 0, frostTimer: 0,
    };
    let row = 0;
    let boss: Boss | undefined;
    for (const e of level.entities) {
      if (e.kind === 'gates') {
        for (const g of e.gates) {
          this.gates.push({ id: this.nextId++, row, d: e.d, ...g, acc: 0, passed: false, chosen: false, hitTime: -1 });
        }
        row++;
      } else if (e.kind === 'squad') {
        this.squads.push(makeSquad(this.nextId++, e.d, e.x, e.count, e.charge, e.unit));
      } else if (e.kind === 'barrel') {
        this.barrels.push({
          id: this.nextId++, d: e.d, x: e.x, r: e.small ? 0.7 : 1.1, hp: e.hp, maxHp: e.hp,
          reward: e.reward, small: e.small, broken: false, gone: false, hitTime: -1,
        });
      } else if (e.kind === 'hazard') {
        this.hazards.push({ id: this.nextId++, d: e.d, x0: e.x0, x1: e.x1, lethality: e.lethality, passed: false });
      } else {
        const def = e.boss === 'chest' ? null : BOSSES[e.boss];
        boss = {
          kind: e.boss, abilities: new Set(e.abilities),
          d: e.d, x: 0, hp: e.hp, maxHp: e.hp, damage: e.damage, speed: e.speed,
          state: 'idle', attackTimer: 0.6, hitTime: -1, smashTime: -1,
          throwTimer: def ? def.throwInterval * 0.6 : 0, summonTimer: def ? def.summonInterval * 0.5 : 0,
          shieldTimer: 3, shielded: false, enraged: false, chestTimer: -1,
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

  get frozen() {
    return this.freezeTimer > 0;
  }

  get stormActive() {
    return this.stormTimer > 0;
  }

  setTargetX(x: number) {
    this.army.targetX = clamp(x, -ROAD_HALF_WIDTH + 0.5, ROAD_HALF_WIDTH - 0.5);
  }

  /** Fires the equipped skill if it is fully charged. */
  useSkill(): boolean {
    if (!this.skill || this.skillCharge < 1 || this.state !== 'playing' || this.endTimer >= 0) return false;
    this.skillCharge = 0;
    const a = this.army;
    if (this.skill === 'storm') {
      this.stormTimer = STORM_TIME;
      this.stormTick = 0;
      this.events.push({ type: 'skill', skill: 'storm' });
    } else if (this.skill === 'freeze') {
      this.freezeTimer = Math.max(this.freezeTimer, FREEZE_TIME);
      this.events.push({ type: 'skill', skill: 'freeze' });
      this.events.push({ type: 'freeze' });
    } else {
      const gained = Math.max(10, Math.round(a.count * 0.3));
      a.count += gained;
      this.events.push({ type: 'skill', skill: 'horn', gained });
    }
    return true;
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
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.skill && this.skillCharge < 1) this.skillCharge = Math.min(1, this.skillCharge + dt / SKILL_CHARGE_TIME);
    this.moveArmy(dt);
    this.fire(dt);
    this.updateArrows(dt);
    this.updateStorm(dt);
    this.updateGates();
    this.updateBarrels();
    this.updateHazards();
    this.updateSquads(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
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
    if (a.burnTimer > 0) a.burnTimer = Math.max(0, a.burnTimer - dt);
    if (a.frostTimer > 0) a.frostTimer = Math.max(0, a.frostTimer - dt);
  }

  private fire(dt: number) {
    const a = this.army;
    if (a.count <= 0) return;
    const rate = this.stats.fireRate * (a.rapidTimer > 0 ? 2 : 1) * (a.frostTimer > 0 ? 0.5 : 1);
    const fire = a.burnTimer > 0;
    a.fireTimer -= dt;
    while (a.fireTimer <= 0) {
      a.fireTimer += 1 / rate;
      const shooters = Math.min(Math.ceil(a.count), 18);
      const dmg = ((a.count * this.stats.damage) / shooters) * (fire ? 1.75 : 1);
      const r = this.armyRadius * 0.85;
      let spawned = 0;
      for (let i = 0; i < shooters; i++) {
        const ang = this.rng() * Math.PI * 2;
        const rad = Math.sqrt(this.rng()) * r;
        const x = a.x + Math.cos(ang) * rad;
        const d = a.d + Math.sin(ang) * rad;
        for (let m = 0; m < a.multishot; m++) {
          const off = (m - (a.multishot - 1) / 2) * 0.35;
          if (this.spawnArrow(x + off, d, dmg, fire)) spawned++;
        }
      }
      this.events.push({ type: 'fire', n: spawned });
    }
  }

  private spawnArrow(x: number, d: number, dmg: number, fire: boolean) {
    let arrow = this.arrows.find((ar) => !ar.alive);
    if (!arrow) {
      if (this.arrows.length >= MAX_ARROWS) return false;
      arrow = { x: 0, d: 0, dmg: 0, life: 0, alive: false, fire: false };
      this.arrows.push(arrow);
    }
    arrow.x = clamp(x, -ROAD_HALF_WIDTH + 0.1, ROAD_HALF_WIDTH - 0.1);
    arrow.d = d;
    arrow.dmg = dmg;
    arrow.fire = fire;
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
      if (boss && boss.state !== 'dead' && Math.abs(ar.x - boss.x) < BOSS_HALF_WIDTH && d1 >= boss.d - 1.2 && d0 <= boss.d + 1.2) {
        ar.alive = false;
        this.damageBoss(ar.dmg);
      }
    }
  }

  private damageBoss(dmg: number) {
    const b = this.boss;
    if (b.state === 'dead') return;
    b.hp -= dmg * (b.shielded ? SHIELD_FACTOR : 1);
    b.hitTime = this.time;
    this.events.push({ type: 'bossHit' });
    if (b.abilities.has('enrage') && !b.enraged && b.hp > 0 && b.hp < b.maxHp * ENRAGE_AT) {
      b.enraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    if (b.hp <= 0) {
      b.hp = 0;
      b.state = 'dead';
      b.shielded = false;
      if (b.kind === 'chest') this.openChest(1);
      else this.events.push({ type: 'bossDead' });
      this.endTimer = 1.6;
    }
  }

  private openChest(share: number) {
    const coins = Math.round(chestCoins(this.level.level) * share);
    this.coinsEarned += coins;
    this.events.push({ type: 'chestOpen', coins });
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
    this.chargeSkill(b.small ? 0.01 : 0.08);
    if (r.type === 'soldiers') a.count += r.amount;
    else if (r.type === 'rapid') a.rapidTimer = Math.max(a.rapidTimer, r.amount);
    else if (r.type === 'multi') a.multishot = Math.min(3, a.multishot + r.amount);
    else if (r.type === 'fire') a.burnTimer = Math.max(a.burnTimer, r.amount);
    else if (r.type === 'freeze') {
      this.freezeTimer = Math.max(this.freezeTimer, r.amount);
      this.events.push({ type: 'freeze' });
    } else if (r.type === 'bomb') this.bomb();
    else {
      this.coinsEarned += r.amount;
      this.events.push({ type: 'coins', n: r.amount, x: b.x, d: b.d });
    }
    this.events.push({ type: 'barrelBreak', barrel: b });
  }

  /** Blasts everything on the road ahead. */
  private bomb() {
    const a = this.army;
    const points: { x: number; d: number }[] = [];
    for (const s of this.squads) {
      if (s.gone || s.count <= 0 || s.d - a.d > 44 || s.d < a.d - 2) continue;
      points.push({ x: s.x, d: s.d });
      this.damageSquad(s, s.count * 0.7 + 5, s.x, true);
    }
    const b = this.boss;
    if (b.state !== 'dead' && b.d - a.d < 48) {
      points.push({ x: b.x, d: b.d });
      this.damageBoss(a.count * this.stats.damage * this.stats.fireRate * 4);
    }
    if (!points.length) points.push({ x: a.x, d: a.d + 20 });
    this.events.push({ type: 'bomb', points });
  }

  private chargeSkill(amount: number) {
    if (this.skill) this.skillCharge = Math.min(1, this.skillCharge + amount);
  }

  private updateStorm(dt: number) {
    if (this.stormTimer <= 0) return;
    this.stormTimer -= dt;
    this.stormTick -= dt;
    if (this.stormTick > 0) return;
    this.stormTick += STORM_TICK;
    const a = this.army;
    // the storm deals about five seconds of the army's damage output to everything in range
    const tick = (a.count * this.stats.damage * this.stats.fireRate * 5 * STORM_TICK) / STORM_TIME;
    const points: { x: number; d: number }[] = [];
    for (const s of this.squads) {
      if (s.gone || s.count <= 0 || s.d - a.d > 46 || s.d < a.d - 2) continue;
      points.push({ x: s.x + (this.rng() - 0.5) * s.halfW * 2, d: s.d + (this.rng() - 0.5) * s.halfD * 2 });
      this.damageSquad(s, tick, s.x, true);
    }
    const b = this.boss;
    if (b.state !== 'dead' && b.d - a.d < 48) {
      points.push({ x: b.x + (this.rng() - 0.5) * 3, d: b.d + (this.rng() - 0.5) * 2 });
      this.damageBoss(tick);
    }
    for (let i = points.length; i < 4; i++) points.push({ x: (this.rng() - 0.5) * 8, d: a.d + 8 + this.rng() * 30 });
    this.events.push({ type: 'stormTick', points });
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

  /** `ignoreArmor` is for blasts and melee, which hurt armoured units just as much. */
  private damageSquad(s: Squad, dmg: number, nearX: number, ignoreArmor = false) {
    s.count = Math.max(0, s.count - dmg * (ignoreArmor ? 1 : s.armor));
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
      this.chargeSkill(0.004);
      this.events.push({ type: 'unitDie', x: s.x + best.ox, d: s.d + best.od, unit: s.unit });
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
    const frozen = this.frozen;
    for (const s of this.squads) {
      if (s.gone) continue;
      const front = s.d - s.halfD;
      if (!s.aggro && front - a.d < AGGRO_RANGE) s.aggro = true;
      const lateral = Math.abs(s.x - a.x) < s.halfW + ar * 0.8;
      if (s.aggro && !s.engaged && !frozen) {
        // archers stop at their firing line and shoot until the army reaches them
        s.holding = s.unit === 'archer' && front - a.d <= ARCHER_HOLD;
        if (!s.holding) s.d -= s.speed * dt;
        if (s.charge) s.x += clamp(a.x - s.x, -1, 1) * (s.unit === 'cavalry' ? 2.4 : 1.6) * dt;
        if (lateral && s.d - s.halfD <= a.d + ar) s.engaged = true;
      }
      if (s.unit === 'archer' && s.aggro && !frozen && s.count > 0 && front - a.d < ARCHER_RANGE && front > a.d) {
        s.volleyTimer -= dt;
        if (s.volleyTimer <= 0) {
          s.volleyTimer += ARCHER_INTERVAL;
          const n = Math.min(Math.ceil(a.count), Math.max(1, Math.round(s.count * 0.08)));
          a.count = Math.max(0, a.count - n);
          this.events.push({ type: 'enemyVolley', squad: s, n });
        }
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
          // frozen enemies cannot fight back
          if (!frozen) {
            a.count = Math.max(0, a.count - k);
            this.events.push({ type: 'soldierLoss', n: k });
          }
          this.damageSquad(s, k, a.x, true);
        }
      }
      if (!s.gone && s.d + s.halfD < a.d - 3) s.gone = true;
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    const a = this.army;
    if (b.state === 'dead') return;
    if (b.kind === 'chest') {
      this.updateChest(dt);
      return;
    }
    if (b.state === 'idle' && b.d - a.d < BOSS_WAKE_RANGE) b.state = 'walk';
    if (b.state === 'idle' || this.frozen) return;
    const rage = b.enraged ? 1.7 : 1;
    if (b.state === 'walk') {
      b.d -= b.speed * rage * dt;
      b.x += (a.x - b.x) * Math.min(1, dt * 0.8);
      if (b.d - BOSS_REACH <= a.d + this.armyRadius) b.state = 'attack';
    }
    if (b.state === 'attack') {
      b.x += (a.x - b.x) * Math.min(1, dt * 2);
      b.attackTimer -= dt;
      if (b.attackTimer <= 0) {
        b.attackTimer += BOSS_ATTACK_INTERVAL / (b.enraged ? 1.5 : 1);
        b.smashTime = this.time;
        const n = Math.min(Math.ceil(a.count), b.damage);
        a.count -= n;
        const frost = b.abilities.has('frost');
        if (frost) a.frostTimer = 3;
        this.events.push({ type: 'bossSmash', n, frost });
      }
    }
    const def = BOSSES[b.kind];
    if (b.abilities.has('throw')) {
      b.throwTimer -= dt;
      if (b.throwTimer <= 0) {
        b.throwTimer = def.throwInterval * (b.enraged ? 0.7 : 1);
        // aim where the marching army will be when the shot lands, so only sidestepping avoids it
        const arenaD = b.d - BOSS_ARENA_GAP;
        const leadD = a.engaged ? a.d : Math.min(Math.max(a.d, arenaD), a.d + ARMY_SPEED * SHOT_FLIGHT);
        const shot: BossShot = {
          // the blast scales with the formation so dodging matters equally for small and big armies
          id: this.nextId++, x: a.x, d: leadD, r: clamp(this.armyRadius * 0.6, 1.2, 2.2),
          t: SHOT_FLIGHT, total: SHOT_FLIGHT, lethality: 0.5, fromX: b.x, fromD: b.d,
        };
        this.shots.push(shot);
        this.events.push({ type: 'bossThrow', shot });
      }
    }
    if (b.abilities.has('summon')) {
      b.summonTimer -= dt;
      if (b.summonTimer <= 0) {
        b.summonTimer = def.summonInterval * (b.enraged ? 0.7 : 1);
        const count = Math.max(4, Math.round(b.damage * 1.6));
        const unit: UnitKind = b.kind === 'lich' ? 'skeleton' : 'infantry';
        const x = clamp(b.x + (this.rng() - 0.5) * 3, -2.5, 2.5);
        const squad = makeSquad(this.nextId++, b.d - 3.5, x, count, true, unit);
        squad.aggro = true;
        this.squads.push(squad);
        this.events.push({ type: 'bossSummon', squad });
      }
    }
    if (b.abilities.has('shield')) {
      b.shieldTimer -= dt;
      if (b.shieldTimer <= 0) {
        b.shielded = !b.shielded;
        b.shieldTimer = b.shielded ? SHIELD_UP : SHIELD_DOWN;
        this.events.push({ type: b.shielded ? 'shieldUp' : 'shieldDown' });
      }
    }
  }

  private updateChest(dt: number) {
    const b = this.boss;
    const arenaD = b.d - BOSS_ARENA_GAP;
    if (b.chestTimer < 0 && this.army.d >= arenaD - 0.01) b.chestTimer = CHEST_TIME;
    if (b.chestTimer < 0) return;
    b.chestTimer -= dt;
    if (b.chestTimer <= 0) {
      // time is up: whatever was knocked loose still counts
      b.state = 'dead';
      this.openChest(0.6 * (1 - b.hp / b.maxHp));
      this.endTimer = 1.2;
    }
  }

  private updateShots(dt: number) {
    const a = this.army;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.shots.splice(i, 1);
      const R = this.armyRadius;
      const share = circleOverlap(Math.hypot(a.x - s.x, a.d - s.d), R, s.r) / (Math.PI * R * R);
      const n = Math.min(Math.ceil(a.count), Math.round(a.count * share * s.lethality));
      if (n > 0) a.count = Math.max(0, a.count - n);
      this.events.push({ type: 'shotLand', shot: s, n });
    }
  }
}

/** Area shared by two circles whose centres are `dist` apart. */
export function circleOverlap(dist: number, r1: number, r2: number) {
  if (dist >= r1 + r2) return 0;
  if (dist <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a = r1 * r1 * Math.acos((dist * dist + r1 * r1 - r2 * r2) / (2 * dist * r1));
  const b = r2 * r2 * Math.acos((dist * dist + r2 * r2 - r1 * r1) / (2 * dist * r2));
  const c = 0.5 * Math.sqrt((-dist + r1 + r2) * (dist + r1 - r2) * (dist - r1 + r2) * (dist + r1 + r2));
  return a + b - c;
}

function makeSquad(id: number, d: number, x: number, count: number, charge: boolean, unit: UnitKind): Squad {
  const per = Math.max(1, Math.ceil(count / SQUAD_MAX_UNITS));
  const n = Math.ceil(count / per);
  const cols = Math.max(3, Math.min(14, Math.ceil(Math.sqrt(n * 1.6))));
  const rows = Math.ceil(n / cols);
  const spacing = unit === 'cavalry' ? SQUAD_SPACING * 1.35 : SQUAD_SPACING;
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const jitter = ((i * 7919) % 100) / 100 - 0.5;
    units.push({
      ox: (c - (cols - 1) / 2) * spacing + jitter * 0.12,
      od: (r - (rows - 1) / 2) * spacing + jitter * 0.1,
      alive: true,
    });
  }
  const halfW = ((cols - 1) / 2) * spacing + 0.3;
  const halfD = ((rows - 1) / 2) * spacing + 0.3;
  const def = UNITS[unit];
  return {
    id, unit, d, x: clamp(x, -ROAD_HALF_WIDTH + halfW, ROAD_HALF_WIDTH - halfW), count, startCount: count, per, units,
    halfW, halfD, speed: def.speed, armor: def.armor, charge, aggro: false, engaged: false, gone: false, tradeAcc: 0,
    volleyTimer: 0.4, holding: false,
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
