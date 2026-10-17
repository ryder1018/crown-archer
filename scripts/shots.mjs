// Captures screenshots of the running dev server for visual checks.
// usage: node scripts/shots.mjs [baseUrl] [outDir] [level]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'shots';
const level = Number(process.argv[4] ?? 1);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-TW' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });

await page.goto(base + '?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 30000 });
await page.evaluate((lv) => window.game.debugSetLevel(lv), level);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/01-home.png` });

await page.evaluate(() => window.game.debugStart());
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/02-start.png` });

const steps = (process.env.STEPS ?? '3,3,3,3,4,4,5,6').split(',').map((v, i) => [Number(v), String(i + 3).padStart(2, '0')]);
for (const [sec, name] of steps) {
  await page.evaluate((s) => window.game.debugAutoplay(s), sec);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}-play.png` });
}
await page.evaluate(() => window.game.debugAutoplay(60));
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/99-result.png` });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
