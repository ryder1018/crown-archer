// Screenshots of the menus on several phone sizes. usage: node scripts/layout-shots.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
mkdirSync('shots/layout', { recursive: true });
const sizes = [['se', 375, 667], ['pro', 390, 844], ['max', 440, 956]];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const locale of ['zh-TW', 'en-US']) {
  for (const [name, width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, locale });
    await page.goto(base + '?debug');
    await page.waitForFunction(() => document.body.classList.contains('ready'));
    await page.evaluate(() => window.game.debugSetSave({ level: 23, coins: 5400, upgrades: { army: 12, rate: 11, damage: 12, income: 9 } }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `shots/layout/${locale}-${name}-1home.png` });
    await page.click('#btn-settings');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/layout/${locale}-${name}-2settings.png` });
    await page.click('#btn-settings-close');
    await page.evaluate(() => { window.game.debugStart(); window.game.debugAutoplayUntil(() => false, 200); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/layout/${locale}-${name}-3result.png` });
    await page.close();
  }
}
await browser.close();
