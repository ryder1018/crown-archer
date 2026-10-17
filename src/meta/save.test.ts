import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave } from './save';

describe('parseSave', () => {
  it('falls back to defaults for empty or corrupt data', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('{not json')).toEqual(defaultSave());
  });

  it('keeps known fields and fills new ones', () => {
    const s = parseSave(JSON.stringify({ level: 7, coins: 120.7, upgrades: { rate: 3 }, settings: { music: false } }));
    expect(s.level).toBe(7);
    expect(s.coins).toBe(120);
    expect(s.failStreak).toBe(0);
    expect(s.upgrades).toEqual({ army: 0, rate: 3, damage: 0, income: 0 });
    expect(s.settings).toEqual({ sound: true, music: false, haptics: true });
  });

  it('sanitises bad numbers', () => {
    const s = parseSave(JSON.stringify({ level: -4, coins: 'lots' }));
    expect(s.level).toBe(1);
    expect(s.coins).toBe(0);
  });
});
