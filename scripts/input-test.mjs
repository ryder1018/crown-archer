// Verifies that touch-dragging moves the army. usage: node scripts/input-test.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + '?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'));
await page.tap('#btn-play', { force: true });
await page.waitForTimeout(300);
const mode = await page.evaluate(() => document.body.dataset.mode);
const x0 = await page.evaluate(() => window.game.world.army.targetX);
// drag right with the mouse (pointer events)
await page.mouse.move(195, 600);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(195 + i * 10, 600);
await page.mouse.up();
const x1 = await page.evaluate(() => window.game.world.army.targetX);
await page.waitForTimeout(500);
const ax = await page.evaluate(() => window.game.world.army.x);
// pause / resume
await page.tap('#btn-pause');
const paused = await page.evaluate(() => document.body.dataset.mode + ':' + document.querySelector('#pause').classList.contains('show'));
const d0 = await page.evaluate(() => window.game.world.army.d);
await page.waitForTimeout(500);
const d1 = await page.evaluate(() => window.game.world.army.d);
await page.tap('#btn-resume');
await page.waitForTimeout(500);
const d2 = await page.evaluate(() => window.game.world.army.d);
console.log({ mode, x0, x1, ax, paused, frozenWhilePaused: d0 === d1, movesAfterResume: d2 > d1, errors });
await browser.close();
