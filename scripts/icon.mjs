// Renders icon.html to resources/icon.png (1024x1024). usage: node scripts/icon.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
mkdirSync('resources', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.goto(base + 'icon.html');
await page.waitForFunction(() => document.body.dataset.done === '1');
await page.locator('#c').screenshot({ path: 'resources/icon.png' });
await browser.close();
console.log('wrote resources/icon.png');
