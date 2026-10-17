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
await page.addStyleTag({ content: '#hint{display:none!important}' });

const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
};
const setup = (level, up = 6) => page.evaluate(([lv, u]) => {
  window.game.debugSetSave({ level: lv, coins: 12850, upgrades: { army: u, rate: u, damage: u, income: u } });
}, [level, up]);

// Plays candidate levels until `cond` happens mid-run, so the shot shows that moment.
async function capture(name, levels, up, cond) {
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
      await page.evaluate(() => window.game.debugFreeze());
      await shot(name);
      return;
    }
  }
  throw new Error(`no level produced ${name}`);
}

await capture('1-gates', [8, 10, 11, 12, 14, 6], 5, (w) =>
  w.army.count > 20 && w.gates.some((x) => !x.passed && x.d - w.army.d < 12 && x.d - w.army.d > 8));
await capture('2-battle', [9, 10, 12, 15, 17], 3, (w) =>
  w.squads.some((s) => s.engaged && s.count > 8) || w.squads.some((s) => !s.gone && s.d - w.army.d < 9 && s.count > 12));
await capture('3-boss', [10, 11, 12, 13], 6, (w) =>
  w.boss.state === 'attack' || (w.boss.state === 'walk' && w.boss.d - w.army.d < 24));

// 4. victory
await setup(10, 8);
await page.evaluate(() => window.game.debugStart());
await page.evaluate(() => window.game.debugAutoplayUntil(() => false, 120));
await page.waitForTimeout(1600);
await shot('4-victory');

// 5. home with upgrades
await setup(14, 7);
await page.waitForTimeout(600);
await shot('5-home');

await browser.close();
console.log('saved to', out);
