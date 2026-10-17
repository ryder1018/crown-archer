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

export type RewardType = 'soldiers' | 'rapid' | 'multi' | 'coins';

export interface Reward {
  type: RewardType;
  amount: number;
}

export type EntitySpec =
  | { kind: 'gates'; d: number; gates: GateSpec[] }
  | { kind: 'squad'; d: number; x: number; count: number; charge: boolean }
  | { kind: 'barrel'; d: number; x: number; hp: number; reward: Reward; small: boolean }
  | { kind: 'boss'; d: number; hp: number; damage: number; speed: number };

export type Theme = 'river' | 'meadow' | 'snow' | 'desert';

export interface LevelSpec {
  level: number;
  theme: Theme;
  entities: EntitySpec[];
  bossD: number;
}
