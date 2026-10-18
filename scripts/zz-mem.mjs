import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto((process.argv[2] ?? 'http://localhost:5173/') + '?debug');
await page.waitForFunction(() => document.body.classList.contains('ready'));
const heroes = ['king', 'knight', 'ranger', 'mage', 'valkyrie', 'ninja', 'giant', 'golem', 'lich', 'ape', 'titan', 'pirate', 'samurai', 'demon'];
const skins = ['azure', 'emerald', 'ocean', 'magma', 'royal', 'gold'];
for (let lv = 1; lv <= 62; lv++) {
  const info = await page.evaluate(([l, hs, ss]) => {
    const g = window.game;
    const up = Math.floor(l * 0.5);
    // every run swaps the hero and the outfit too, to catch leaks when models are rebuilt
    g.debugSetSave({ level: l, hero: hs[l % hs.length], skin: ss[l % ss.length], upgrades: { army: up, rate: up, damage: up, income: 0 } });
    g.debugStart();
    g.debugAutoplayUntil(() => false, 120);
    g.view.render(g.world, 1 / 60);
    const m = g.view.renderer.info.memory;
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1;
    return { heap,  lv: l, state: g.world.state, geo: m.geometries, tex: m.textures, dom: document.querySelectorAll('#overlay > *').length };
  }, [lv, heroes, skins]);
  if (lv % 6 === 0 || lv === 1) console.log(JSON.stringify(info));
}
console.log(errors.length ? errors : 'no errors');
await browser.close();
