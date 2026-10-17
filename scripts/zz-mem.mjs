import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173/?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'));
for (let lv = 1; lv <= 25; lv++) {
  const info = await page.evaluate((l) => {
    const g = window.game;
    g.debugSetSave({ level: l, upgrades: { army: l, rate: l, damage: l, income: 0 } });
    g.debugStart();
    g.debugAutoplayUntil(() => false, 120);
    g.view.render(g.world, 1 / 60);
    const m = g.view.renderer.info.memory;
    return { lv: l, state: g.world.state, geo: m.geometries, tex: m.textures, dom: document.querySelectorAll('#overlay > *').length };
  }, lv);
  if (lv % 5 === 0 || lv === 1) console.log(JSON.stringify(info));
}
console.log(errors.length ? errors : 'no errors');
await browser.close();
