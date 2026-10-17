// Captures raw App Store screenshots (1320x2868, 6.9") of key moments.
// usage: node scripts/store-shots.mjs [baseUrl] [locale]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const locale = process.argv[3] ?? 'zh-TW';
const out = `store/raw-${locale}`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, locale });
await page.goto(base + '?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'));
await page.addStyleTag({ content: '#hint,#banner{display:none!important}' });

const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const setup = (level, up = 6) => page.evaluate(([lv, u]) => {
  const seen = ['theme:meadow', 'theme:snow', 'theme:desert', 'theme:volcano', 'theme:night', 'boss:troll', 'boss:frost', 'boss:warlord', 'boss:golem', 'boss:lich',
    'unit:cavalry', 'unit:archer', 'unit:armored', 'item:fire', 'item:freeze', 'item:bomb', 'skill:storm', 'skill:freeze', 'skill:horn'];
  window.game.debugSetSave({ level: lv, coins: 12850, failStreak: 0, skill: 'storm', seen, upgrades: { army: u, rate: u, damage: u, income: u } });
}, [level, up]);

// Plays candidate levels until `cond` happens mid-run, so the shot shows that moment.
async function capture(name, levels, up, cond, freeze = [90, false]) {
  for (const lv of levels) {
    await setup(lv, up);
    await page.evaluate(() => window.game.debugStart());
    const ok = await page.evaluate((src) => {
      const fn = new Function('w', `return (${src})(w)`);
      window.game.debugAutoplayUntil(fn);
      return window.game.world.state === 'playing';
    }, cond.toString());
    if (ok) {
      // let a few frames render (particles, popups), then freeze the moment
      await page.evaluate(([f, sim]) => window.game.debugFreeze(f, sim), freeze);
      await shot(name);
      return;
    }
  }
  throw new Error(`no level produced ${name}`);
}

await capture('1-gates', [8, 10, 11, 12, 6], 5, (w) =>
  w.army.count > 20 && w.gates.some((x) => !x.passed && x.d - w.army.d < 12 && x.d - w.army.d > 8));
await capture('2-boss', [24, 23, 22], 15, (w) =>
  w.boss.shielded && w.shots.some((s) => s.t < s.total * 0.6) && w.boss.d - w.army.d < 34);
await capture('3-battle', [9, 10, 12, 15, 17], 3, (w) =>
  w.squads.some((s) => s.engaged && s.count > 8) || w.squads.some((s) => !s.gone && s.d - w.army.d < 9 && s.count > 12));
await capture('4-skill', [9, 10, 8, 6], 3, (w) => {
  const target = w.squads.some((s) => !s.gone && s.aggro && s.count > 30 && s.d - w.army.d < 36);
  if (w.skillCharge >= 1 && target && w.boss.state === 'idle') w.useSkill();
  return w.stormActive && target;
}, [55, true]);
await capture('5-region', [29, 27, 26], 18, (w) =>
  w.squads.some((s) => s.unit === 'skeleton' && !s.gone && s.d - w.army.d < 28) && w.boss.state === 'walk');
await capture('6-treasure', [14, 21, 28], 9, (w) => w.boss.chestTimer > 0 && w.boss.chestTimer < 10 && w.boss.hp < w.boss.maxHp * 0.7);

// home with upgrades and a skill
await setup(14, 7);
await page.waitForTimeout(600);
await shot('7-home');

await browser.close();
console.log('saved to', out);
