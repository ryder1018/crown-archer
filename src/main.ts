import './style.css';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { sfx } from './audio';
import { formatCount, t } from './i18n';
import { levelReward, statsFor, upgradeCost, UPGRADE_KINDS, type UpgradeKind } from './meta/progression';
import { loadSave, writeSave, type SaveData } from './meta/save';
import { GameView } from './render/view';
import { botSteer } from './sim/bot';
import { generateLevel } from './sim/levelgen';
import { ROAD_HALF_WIDTH } from './sim/types';
import { World } from './sim/world';

type Mode = 'home' | 'playing' | 'paused' | 'result';

const STEP = 1 / 60;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const UPGRADE_ICONS: Record<UpgradeKind, string> = {
  army: '<svg viewBox="0 0 24 24"><path d="M12 2l3 3-1 1v3h3l1-1 3 3-3 3-1-1h-3v6h-4v-6H7l-1 1-3-3 3-3 1 1h3V6l-1-1z"/></svg>',
  rate: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
  damage: '<svg viewBox="0 0 24 24"><path d="M3 21l3-1 9-9-2-2-9 9zm11-13l2 2 5-5V3h-2z"/><path d="M5 13l6 6-1.5 1.5-6-6z"/></svg>',
  income: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path fill="#fff6" d="M11 6h2v2h2v2h-4v1h3a2 2 0 012 2v1a2 2 0 01-2 2h-1v2h-2v-2H9v-2h4v-1h-3a2 2 0 01-2-2v-1a2 2 0 012-2h1z"/></svg>',
};

class Game {
  private save!: SaveData;
  private world!: World;
  private readonly view: GameView;
  private mode: Mode = 'home';
  private acc = 0;
  private last = performance.now();
  private dragging = false;
  private dragStartX = 0;
  private dragStartTarget = 0;
  private bossAnnounced = false;
  private gateTipShown = false;
  private hintShown = false;
  private readonly isNative = Capacitor.isNativePlatform();

  constructor() {
    this.view = new GameView($('#scene'), $('#overlay'));
  }

  async boot() {
    this.save = await loadSave();
    sfx.soundOn = this.save.settings.sound;
    sfx.musicOn = this.save.settings.music;
    try {
      await document.fonts.load('64px "Lilita One"');
    } catch {
      /* fallback fonts are fine */
    }
    this.bindUi();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.newWorld();
    this.showHome();
    requestAnimationFrame((ts) => this.frame(ts));
    if (this.isNative) {
      void StatusBar.hide().catch(() => undefined);
      void SplashScreen.hide().catch(() => undefined);
      void CapApp.addListener('pause', () => this.onBackground());
      void CapApp.addListener('resume', () => sfx.resume());
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onBackground();
      else sfx.resume();
    });
    document.body.classList.add('ready');
  }

  private onBackground() {
    if (this.mode === 'playing') this.pause();
    sfx.suspend();
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.view.resize(w, h);
  }

  private newWorld() {
    const level = generateLevel(this.save.level, this.save.failStreak);
    this.world = new World(level, statsFor(this.save.upgrades), (Date.now() & 0xffff) + 1);
    this.view.load(this.world);
    this.bossAnnounced = false;
    this.gateTipShown = false;
  }

  // ---------- loop ----------

  private frame(ts: number) {
    const dt = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;
    if (this.mode === 'playing') {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.world.update(STEP);
        this.onEvents();
        this.acc -= STEP;
        steps++;
      }
      if (steps === 6) this.acc = 0;
      this.updateHud();
    }
    this.view.render(this.world, this.mode === 'paused' ? 0 : dt);
    requestAnimationFrame((n) => this.frame(n));
  }

  private onEvents() {
    const w = this.world;
    this.view.handleEvents(w.events, w);
    for (const ev of w.events) {
      switch (ev.type) {
        case 'fire':
          if (ev.n > 0) sfx.bow();
          break;
        case 'unitDie':
          sfx.hit();
          break;
        case 'soldierLoss':
          sfx.clash();
          break;
        case 'gatePass':
          if (ev.delta >= 0) {
            sfx.gateGood();
            this.haptic('light');
          } else {
            sfx.gateBad();
            this.haptic('medium');
          }
          break;
        case 'barrelBreak':
          if (ev.barrel.small) sfx.pop();
          else sfx.crash();
          if (ev.barrel.reward.type === 'coins') sfx.coin();
          this.haptic('light');
          break;
        case 'coins':
          this.bumpCoins();
          break;
        case 'bossSmash':
          sfx.smash();
          this.haptic('heavy');
          break;
        case 'bossDead':
          sfx.crash();
          this.haptic('success');
          break;
        case 'win':
          this.finish(true);
          break;
        case 'lose':
          this.finish(false);
          break;
        default:
          break;
      }
    }
    if (!this.gateTipShown && this.save.level >= 3 && this.save.level <= 4) {
      const g = w.gates.find((x) => !x.passed && x.op === 'add' && x.value < 0 && x.d - w.army.d < 34);
      if (g) {
        this.gateTipShown = true;
        this.banner(t.gateTip, 'tip');
      }
    }
    if (!this.bossAnnounced && w.boss.state === 'walk') {
      this.bossAnnounced = true;
      sfx.roar();
      this.banner(t.bossIncoming);
    }
  }

  private haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') {
    if (!this.save.settings.haptics || !this.isNative) return;
    const run = async () => {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'error') await Haptics.notification({ type: NotificationType.Error });
      else await Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy });
    };
    void run().catch(() => undefined);
  }

  // ---------- input ----------

  private bindUi() {
    const app = $('#app');
    app.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'playing' || (e.target as HTMLElement).closest('button')) return;
      this.dragging = true;
      this.dragStartX = e.clientX;
      this.dragStartTarget = this.world.army.targetX;
      this.hideHint();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging || this.mode !== 'playing') return;
      const scale = (ROAD_HALF_WIDTH * 2.6) / Math.min(window.innerWidth, 600);
      this.world.setTargetX(this.dragStartTarget + (e.clientX - this.dragStartX) * scale);
    });
    const end = () => (this.dragging = false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    $('#btn-play').addEventListener('click', () => this.start());
    $('#btn-pause').addEventListener('click', () => this.pause());
    $('#btn-resume').addEventListener('click', () => this.resume());
    $('#btn-restart').addEventListener('click', () => {
      this.click();
      this.hideModal('#pause');
      this.newWorld();
      this.start();
    });
    $('#btn-quit').addEventListener('click', () => {
      this.click();
      this.hideModal('#pause');
      this.newWorld();
      this.showHome();
    });
    $('#btn-next').addEventListener('click', () => {
      this.click();
      this.hideModal('#result');
      this.newWorld();
      this.showHome();
    });
    $('#btn-settings').addEventListener('click', () => {
      this.click();
      this.renderSettings();
      this.showModal('#settings');
    });
    $('#btn-settings-close').addEventListener('click', () => {
      this.click();
      this.hideModal('#settings');
    });
    for (const key of ['sound', 'music', 'haptics'] as const) {
      $(`#set-${key}`).addEventListener('click', () => {
        this.save.settings[key] = !this.save.settings[key];
        sfx.soundOn = this.save.settings.sound;
        sfx.setMusic(this.save.settings.music);
        if (key === 'music' && this.save.settings.music) sfx.startMusic();
        void writeSave(this.save);
        this.renderSettings();
        this.click();
      });
    }

    const list = $('#upgrades');
    for (const kind of UPGRADE_KINDS) {
      const b = document.createElement('button');
      b.className = 'upgrade';
      b.dataset.kind = kind;
      b.innerHTML = `<div class="up-icon">${UPGRADE_ICONS[kind]}</div><div class="up-name"></div><div class="up-lv"></div><div class="up-cost"><i class="coin"></i><span></span></div>`;
      b.addEventListener('click', () => this.buy(kind));
      list.appendChild(b);
    }

    // static text
    $('#title').textContent = t.title;
    $('#subtitle').textContent = t.subtitle;
    $('#btn-play-label').textContent = t.tapToPlay;
    $('#hint-text').textContent = t.dragHint;
    $('#pause-title').textContent = t.paused;
    $('#btn-resume').textContent = t.resume;
    $('#btn-restart').textContent = t.restartLevel;
    $('#btn-quit').textContent = t.home;
    $('#settings-title').textContent = t.settings;
    $('#lbl-sound').textContent = t.sound;
    $('#lbl-music').textContent = t.music;
    $('#lbl-haptics').textContent = t.haptics;
    $('#lbl-privacy').textContent = t.privacy;
    $('#btn-settings-close').textContent = t.close;
    $('#version').textContent = `${t.version} ${__APP_VERSION__}`;
  }

  private click() {
    sfx.unlock();
    sfx.click();
  }

  // ---------- screens ----------

  private showHome() {
    for (const m of document.querySelectorAll('.modal')) m.classList.remove('show');
    this.hideHint();
    this.mode = 'home';
    document.body.dataset.mode = 'home';
    $('#home-level').textContent = t.level(this.save.level);
    this.renderCoins();
    this.renderUpgrades();
  }

  private start() {
    sfx.unlock();
    if (this.save.settings.music) sfx.startMusic();
    this.click();
    if (this.world.state !== 'playing' || this.world.time > 0) this.newWorld();
    this.mode = 'playing';
    document.body.dataset.mode = 'playing';
    $('#hud-level').textContent = t.level(this.save.level);
    this.hudCoins = this.save.coins;
    this.renderHudCoins();
    if (this.save.level <= 2 && !this.hintShown) {
      this.hintShown = true;
      $('#hint').classList.add('show');
    }
  }

  private pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.dragging = false;
    this.showModal('#pause');
  }

  private resume() {
    this.click();
    this.hideModal('#pause');
    this.mode = 'playing';
    this.last = performance.now();
  }

  private hideHint() {
    $('#hint').classList.remove('show');
  }

  private finish(won: boolean) {
    const w = this.world;
    const reward = levelReward(this.save.level, won, w.army.count, w.progress, statsFor(this.save.upgrades).income) + w.coinsEarned;
    const level = this.save.level;
    this.save.coins += reward;
    if (won) {
      this.save.level++;
      this.save.failStreak = 0;
      this.save.stats.wins++;
      this.save.stats.bestArmy = Math.max(this.save.stats.bestArmy, Math.round(w.army.count));
    } else {
      this.save.stats.losses++;
      this.save.failStreak++;
    }
    void writeSave(this.save);
    this.hideHint();
    window.setTimeout(() => {
      this.mode = 'result';
      document.body.dataset.mode = 'result';
      if (won) sfx.win();
      else sfx.lose();
      this.haptic(won ? 'success' : 'error');
      $('#result .result-card').classList.toggle('won', won);
      $('#result-title').textContent = won ? t.victory : t.defeat;
      $('#result-level').textContent = t.level(level);
      $('#result-detail').textContent = won ? t.survivors(Math.round(w.army.count)) : t.reached(Math.round(w.progress * 100));
      $('#btn-next').textContent = won ? t.next : t.retry;
      this.countUp($('#result-coins'), reward);
      this.showModal('#result');
    }, won ? 200 : 900);
  }

  private countUp(el: HTMLElement, target: number) {
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / 900);
      el.textContent = `+${formatCount(Math.round(target * (1 - Math.pow(1 - f, 3))))}`;
      if (f < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private showModal(sel: string) {
    $(sel).classList.add('show');
  }

  private hideModal(sel: string) {
    $(sel).classList.remove('show');
  }

  private banner(text: string, kind: 'boss' | 'tip' = 'boss') {
    const b = $('#banner');
    b.textContent = text;
    b.classList.toggle('tip', kind === 'tip');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  // ---------- economy ----------

  private buy(kind: UpgradeKind) {
    sfx.unlock();
    const lv = this.save.upgrades[kind];
    const cost = upgradeCost(kind, lv);
    if (this.save.coins < cost) {
      sfx.gateBad();
      const card = document.querySelector(`.upgrade[data-kind="${kind}"]`);
      card?.classList.remove('deny');
      void (card as HTMLElement | null)?.offsetWidth;
      card?.classList.add('deny');
      return;
    }
    this.save.coins -= cost;
    this.save.upgrades[kind] = lv + 1;
    void writeSave(this.save);
    sfx.coin();
    this.haptic('light');
    this.renderCoins();
    this.renderUpgrades();
    this.newWorld();
    const card = document.querySelector(`.upgrade[data-kind="${kind}"]`);
    card?.classList.remove('bought');
    void (card as HTMLElement | null)?.offsetWidth;
    card?.classList.add('bought');
  }

  private renderCoins() {
    $('#coins').textContent = formatCount(this.save.coins);
  }

  private renderUpgrades() {
    for (const kind of UPGRADE_KINDS) {
      const card = document.querySelector(`.upgrade[data-kind="${kind}"]`) as HTMLElement;
      const lv = this.save.upgrades[kind];
      const cost = upgradeCost(kind, lv);
      (card.querySelector('.up-name') as HTMLElement).textContent = t[`upgrade_${kind}`];
      (card.querySelector('.up-lv') as HTMLElement).textContent = t.lv(lv + 1);
      (card.querySelector('.up-cost span') as HTMLElement).textContent = formatCount(cost);
      card.classList.toggle('affordable', this.save.coins >= cost);
    }
  }

  private renderSettings() {
    for (const key of ['sound', 'music', 'haptics'] as const) {
      const b = $(`#set-${key}`);
      b.textContent = this.save.settings[key] ? t.on : t.off;
      b.classList.toggle('on', this.save.settings[key]);
    }
  }

  // ---------- hud ----------

  private hudCoins = 0;

  private bumpCoins() {
    this.hudCoins = this.save.coins + this.world.coinsEarned;
    this.renderHudCoins();
    const el = $('#hud-coins');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  private renderHudCoins() {
    $('#hud-coins-text').textContent = formatCount(this.hudCoins);
  }

  private updateHud() {
    const a = this.world.army;
    $('#progress-fill').style.transform = `scaleX(${this.world.progress.toFixed(3)})`;
    const rapid = $('#buff-rapid');
    rapid.classList.toggle('on', a.rapidTimer > 0);
    const rapidText = `${t.reward_rapid} ${Math.ceil(a.rapidTimer)}s`;
    if (a.rapidTimer > 0 && rapid.textContent !== rapidText) rapid.textContent = rapidText;
    const multi = $('#buff-multi');
    multi.classList.toggle('on', a.multishot > 1);
    const multiText = `${t.reward_multi} x${a.multishot}`;
    if (a.multishot > 1 && multi.textContent !== multiText) multi.textContent = multiText;
  }

  /** Lets the screenshot script fast-forward a level with the autopilot. */
  debugAutoplay(seconds: number) {
    for (let i = 0; i < seconds * 60 && this.world.state === 'playing'; i++) {
      botSteer(this.world);
      this.world.update(STEP);
      this.onEvents();
    }
  }

  debugStart() {
    this.start();
  }

  /** Screenshot helper: autoplay until `cond(world)` holds or `maxSeconds` pass. */
  debugAutoplayUntil(cond: (w: World) => boolean, maxSeconds = 120) {
    for (let i = 0; i < maxSeconds * 60 && this.world.state === 'playing' && !cond(this.world); i++) {
      botSteer(this.world);
      this.world.update(STEP);
      this.onEvents();
    }
  }

  debugSetSave(patch: Partial<SaveData>) {
    Object.assign(this.save, patch);
    this.newWorld();
    this.showHome();
  }

  debugSetLevel(level: number) {
    this.save.level = level;
    this.save.failStreak = 0;
    this.newWorld();
    this.showHome();
  }
}

declare const __APP_VERSION__: string;

const game = new Game();
void game.boot();
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { game: Game }).game = game;
}
