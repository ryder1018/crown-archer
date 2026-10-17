// Screenshots of the regions, bosses and collection added in the second content pass.
// usage: node scripts/new-content-shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'shots/new';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: 'zh-TW' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + '?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'));
await page.addStyleTag({ content: '#hint,#banner{display:none!important}' });

async function capture(name, levels, up, cond, opts = {}) {
  for (const lv of levels) {
    await page.evaluate(([l, u, hero]) => window.game.debugSetSave({ level: l, hero: hero ?? 'king', upgrades: { army: u, rate: u, damage: u, income: 0 } }), [lv, up, opts.hero]);
    await page.evaluate(() => window.game.debugStart());
    const ok = await page.evaluate((src) => {
      const fn = new Function('w', `return (${src})(w)`);
      window.game.debugAutoplayUntil(fn, 150);
      return window.game.world.state === 'playing';
    }, cond.toString());
    if (ok) {
      await page.evaluate((f) => window.game.debugFreeze(f), opts.frames ?? 90);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${name}.png` });
      return;
    }
  }
  console.log('missed', name);
}

await capture('r7-jungle', [31, 32], 16, (w) => w.army.d > 60);
await capture('r8-swamp', [36, 37], 18, (w) => w.army.d > 60);
await capture('r9-sky', [41, 43], 20, (w) => w.army.d > 60);
await capture('b8-ape-leap', [33, 34, 32], 11, (w) => w.boss.leaping && w.shots.some((s) => s.kind === 'leap' && s.t < s.total * 0.5), { frames: 1 });
await capture('b9-witch', [38, 39, 37], 12, (w) => w.pools.length > 0 && w.shots.length > 0, { frames: 30 });
await capture('b10-titan', [43, 44], 14, (w) => w.shots.filter((s) => s.kind === 'bolt').length >= 2 && w.shots.some((s) => s.t < 0.5), { frames: 1 });
await capture('u4-goblin', [32, 33, 34], 16, (w) => w.squads.some((s) => s.unit === 'goblin' && s.aggro && !s.gone && s.d - w.army.d < 26));
await capture('g1-mystery', [8, 9, 10, 11, 12, 13], 6, (w) => w.gates.some((g) => g.mystery && !g.passed && g.d - w.army.d < 22 && g.d - w.army.d > 8));
await capture('h1-golem-hero', [12], 8, (w) => w.army.d > 40, { hero: 'golem' });
await capture('h2-mage-hero', [12], 8, (w) => w.army.d > 40, { hero: 'mage' });

// home and the collection
await page.evaluate(() => window.game.debugSetSave({ level: 26, coins: 2400, hero: 'king', heroes: ['king', 'giant', 'troll', 'frost', 'warlord', 'golem'], skins: ['azure', 'violet'], skin: 'violet', daily: '' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/c0-home.png` });
await page.click('#btn-collection');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/c1-heroes.png` });
await page.evaluate(() => document.querySelector('#col-grid').scrollTo(0, 2000));
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/c2-heroes-bottom.png` });
await page.click('#tab-skins');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/c3-skins.png` });
await page.click('.col-card:nth-child(2)');
await page.waitForTimeout(300);
await page.click('#btn-col-close');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/c4-home-emerald.png` });
await page.click('#btn-daily');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/c5-daily.png` });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
