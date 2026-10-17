export const ROAD_HALF_WIDTH = 5;
export const ARMY_SPEED = 9;
export const ARROW_SPEED = 42;
export const ARROW_RANGE = 46;
export const MAX_ARROWS = 700;
export const MAX_ARMY_DISPLAY = 200;
export const FORMATION_SPACING = 0.21;

export interface Stats {
  startArmy: number;
  /** volleys per second */
  fireRate: number;
  /** damage per soldier per volley */
  damage: number;
  income: number;
}

export type GateOp = 'add' | 'mul' | 'div';

export interface GateSpec {
  x0: number;
  x1: number;
  op: GateOp;
  /** signed for 'add', factor for 'mul' / 'div' */
  value: number;
  /** damage needed to raise an 'add' gate by one */
  step: number;
  /** shown as "?" until the army walks through */
  mystery?: boolean;
}

export type RewardType = 'soldiers' | 'rapid' | 'multi' | 'coins' | 'fire' | 'freeze' | 'bomb';

export interface Reward {
  type: RewardType;
  amount: number;
}

export type EntitySpec =
  | { kind: 'gates'; d: number; gates: GateSpec[] }
  | { kind: 'squad'; d: number; x: number; count: number; charge: boolean; unit: UnitKind }
  | { kind: 'barrel'; d: number; x: number; hp: number; reward: Reward; small: boolean }
  | { kind: 'hazard'; d: number; x0: number; x1: number; lethality: number }
  | { kind: 'boss'; d: number; hp: number; damage: number; speed: number; boss: BossKind; abilities: BossAbility[] };

export type Theme = 'river' | 'meadow' | 'snow' | 'desert' | 'volcano' | 'night' | 'jungle' | 'swamp' | 'sky';

/** Enemy unit types. Skeletons are the lich's summons and fight like infantry. */
export type UnitKind = 'infantry' | 'cavalry' | 'archer' | 'armored' | 'skeleton' | 'goblin';

export type BossKind = 'giant' | 'troll' | 'frost' | 'warlord' | 'golem' | 'lich' | 'ape' | 'witch' | 'titan' | 'chest';

export type BossAbility = 'smash' | 'throw' | 'summon' | 'shield' | 'frost' | 'enrage' | 'leap' | 'poison' | 'lightning';

export type SkillKind = 'storm' | 'freeze' | 'horn';

export interface LevelSpec {
  level: number;
  theme: Theme;
  entities: EntitySpec[];
  bossD: number;
  /** treasure run: no enemies, a chest instead of a boss */
  bonus: boolean;
}

/** Passive bonuses from the hero leading the army; 1 / 0 means no effect. */
export interface Perks {
  /** multiplies soldiers lost in melee and to enemy archers */
  meleeTaken: number;
  /** multiplies soldiers lost to boss smashes and projectiles */
  bossTaken: number;
  /** multiplies spike trap lethality */
  hazardTaken: number;
  /** multiplies enemy and boss movement speed */
  enemySpeed: number;
  /** share of every destroyed squad that joins the army */
  raise: number;
  /** multiplies coins picked up during a run */
  coinMul: number;
  /** multiplies skill charge speed */
  skillCharge: number;
  /** skill charge at the start of a run */
  skillStart: number;
}

export const NO_PERKS: Perks = {
  meleeTaken: 1, bossTaken: 1, hazardTaken: 1, enemySpeed: 1, raise: 0, coinMul: 1, skillCharge: 1, skillStart: 0,
};
