import { describe, expect, it } from 'vitest';
import { isBonusLevel } from '../sim/content';
import { statsFor } from './progression';
import { earnedHeroes, heroForWin, heroPerks, heroStats, HEROES, regionFinalLevel } from './collection';

describe('collection', () => {
  it('awards each region boss once its last level is won', () => {
    expect(heroForWin(5)).toBe('giant');
    expect(heroForWin(6)).toBeNull();
    expect(heroForWin(25)).toBe('golem');
    expect(heroForWin(45)).toBe('titan');
    expect(heroForWin(60)).toBe('demon');
    expect(regionFinalLevel('sky')).toBe(45);
    // a region finale is never swapped for a treasure run
    expect(isBonusLevel(35)).toBe(false);
    expect(earnedHeroes(5)).toEqual([]);
    expect(earnedHeroes(31)).toEqual(['giant', 'troll', 'frost', 'warlord', 'golem', 'lich']);
    expect(earnedHeroes(400)).toHaveLength(12);
  });

  it('every boss region has a hero and perks stay neutral by default', () => {
    expect(HEROES.filter((h) => h.region)).toHaveLength(12);
    expect(heroPerks('king').meleeTaken).toBe(1);
    expect(heroPerks('knight').meleeTaken).toBe(0.75);
    const base = statsFor({ army: 2, rate: 0, damage: 0, income: 0 });
    expect(heroStats(base, 'king').startArmy).toBe(base.startArmy + 3);
    expect(heroStats(base, 'giant').startArmy).toBe(Math.round(base.startArmy * 1.2));
    expect(heroStats(base, 'ranger').fireRate).toBeCloseTo(base.fireRate * 1.12);
  });
});
