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

export type Theme = 'river' | 'meadow' | 'snow' | 'desert' | 'volcano' | 'night';

/** Enemy unit types. Skeletons are the lich's summons and fight like infantry. */
export type UnitKind = 'infantry' | 'cavalry' | 'archer' | 'armored' | 'skeleton';

export type BossKind = 'giant' | 'troll' | 'frost' | 'warlord' | 'golem' | 'lich' | 'chest';

export type BossAbility = 'smash' | 'throw' | 'summon' | 'shield' | 'frost' | 'enrage';

export type SkillKind = 'storm' | 'freeze' | 'horn';

export interface LevelSpec {
  level: number;
  theme: Theme;
  entities: EntitySpec[];
  bossD: number;
  /** treasure run: no enemies, a chest instead of a boss */
  bonus: boolean;
}
