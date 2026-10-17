// Screenshots of every region's boss fight and each enemy type, for visual review.
// usage: node scripts/content-shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'shots/content';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: 'zh-TW' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + '?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'));
await page.addStyleTag({ content: '#hint,#banner{display:none!important}' });

async function capture(name, levels, up, cond, after) {
  for (const lv of levels) {
    await page.evaluate(([l, u]) => window.game.debugSetSave({ level: l, upgrades: { army: u, rate: u, damage: u, income: 0 } }), [lv, up]);
    await page.evaluate(() => window.game.debugStart());
    const ok = await page.evaluate((src) => {
      const fn = new Function('w', `return (${src})(w)`);
      window.game.debugAutoplayUntil(fn, 150);
      return window.game.world.state === 'playing';
    }, cond.toString());
    if (ok) {
      if (after) await page.evaluate(after);
      await page.evaluate(() => window.game.debugFreeze());
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${name}.png` });
      return;
    }
  }
  console.log('missed', name);
}

await capture('b1-giant', [4, 5], 4, (w) => w.boss.state === 'attack' || (w.boss.state === 'walk' && w.boss.d - w.army.d < 24));
await capture('b2-troll', [9, 10], 6, (w) => w.shots.some((s) => s.t < s.total * 0.55));
await capture('b3-frost', [14, 13], 8, (w) => w.army.frostTimer > 0 || w.shots.some((s) => s.t < s.total * 0.55));
await capture('b4-warlord', [19, 18], 11, (w) => w.squads.some((s) => s.aggro && !s.gone && s.d > w.boss.d - 8));
await capture('b5-golem', [24, 23], 14, (w) => w.boss.shielded && w.boss.d - w.army.d < 40);
await capture('b6-lich', [29, 27], 17, (w) => w.squads.some((s) => s.unit === 'skeleton' && !s.gone) && w.shots.length > 0);
await capture('b7-chest', [14, 21], 9, (w) => w.boss.chestTimer > 0 && w.boss.chestTimer < 11);
await capture('u1-cavalry', [8, 9, 10], 5, (w) => w.squads.some((s) => s.unit === 'cavalry' && s.aggro && !s.gone && s.d - w.army.d < 32));
await capture('u2-archer', [13, 12, 15], 7, (w) => w.squads.some((s) => s.unit === 'archer' && s.holding && !s.gone));
await capture('u3-armored', [18, 17, 20], 10, (w) => w.squads.some((s) => s.unit === 'armored' && s.aggro && !s.gone && s.d - w.army.d < 22));
await capture('i1-fire', [8, 9, 10, 11], 5, (w) => w.army.burnTimer > 0 && w.army.burnTimer < 6.5);
await capture('i2-freeze', [12, 13, 15], 7, (w) => w.squads.some((s) => !s.gone && s.aggro && s.d - w.army.d < 26), () => { window.game.world.freezeTimer = 4; });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
