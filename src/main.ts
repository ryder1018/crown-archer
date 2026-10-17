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
import { REWARD_FROM, SKILL_UNLOCK, SKILLS, unlockedSkills } from './sim/content';
import { generateLevel } from './sim/levelgen';
import { ROAD_HALF_WIDTH, type SkillKind } from './sim/types';
import { World } from './sim/world';

type Mode = 'home' | 'playing' | 'paused' | 'result';

const STEP = 1 / 60;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const UPGRADE_ICONS: Record<UpgradeKind, string> = {
  army: '<svg viewBox="0 0 24 24"><path d="M12 2l3 3-1 1v3h3l1-1 3 3-3 3-1-1h-3v6h-4v-6H7l-1 1-3-3 3-3 1 1h3V6l-1-1z"/></svg>',
  rate: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
  damage: '<svg viewBox="0 0 24 24"><path d="M3 21l3-1 9-9-2-2-9 9zm11-13l2 2 5-5V3h-2z"/><path d="M5 13l6 6-1.5 1.5-6-6z"/></svg>',
  income: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="18" rx="8" ry="3"/><path d="M4 18v-3c0 1.7 3.6 3 8 3s8-1.3 8-3v3" opacity=".7"/><ellipse cx="12" cy="13" rx="8" ry="3"/><path d="M4 13v-3c0 1.7 3.6 3 8 3s8-1.3 8-3v3" opacity=".7"/><ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8V5c0 1.7 3.6 3 8 3s8-1.3 8-3v3" opacity=".7"/><ellipse cx="12" cy="5" rx="8" ry="3"/></svg>',
};

const SKILL_ICONS: Record<SkillKind, string> = {
  storm: '<svg viewBox="0 0 24 24"><path d="M5 2h2v9l2-2 1.4 1.4L6 14.8 1.6 10.4 3 9l2 2zm7 3h2v9l2-2 1.4 1.4L13 17.8l-4.4-4.4L10 12l2 2zm6-3h2v9l2-2 1.4 1.4-4.4 4.4-4.4-4.4L16 9l2 2z"/><rect x="2" y="20" width="20" height="2" rx="1"/></svg>',
  freeze: '<svg viewBox="0 0 24 24"><path d="M11 1h2v4.6l2.3-2.3 1.4 1.4L13 8.4V11h2.6l3.7-3.7 1.4 1.4L18.4 11H23v2h-4.6l2.3 2.3-1.4 1.4-3.7-3.7H13v2.6l3.7 3.7-1.4 1.4-2.3-2.3V23h-2v-4.6l-2.3 2.3-1.4-1.4 3.7-3.7V13H8.4l-3.7 3.7-1.4-1.4L5.6 13H1v-2h4.6L3.3 8.7l1.4-1.4L8.4 11H11V8.4L7.3 4.7l1.4-1.4L11 5.6z"/></svg>',
  horn: '<svg viewBox="0 0 24 24"><path d="M3 9h3l9-5v16l-9-5H3a1 1 0 01-1-1v-4a1 1 0 011-1zm4 7l1 5h3l-1.5-4.2zM18 7.5a6 6 0 010 9l-1.3-1.5a4 4 0 000-6zm2.5-2.7a9.5 9.5 0 010 14.4l-1.3-1.5a7.5 7.5 0 000-11.4z"/></svg>',
};

interface BannerMsg { title: string; sub?: string; kind: 'boss' | 'tip' | 'intro' }

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
  private perfFrames = 0;
  private perfTime = 0;
  private banners: BannerMsg[] = [];
  private bannerTimer: number | null = null;
  private skillWasReady = false;

  constructor() {
    this.view = new GameView($('#scene'), $('#overlay'));
  }

  async boot() {
    this.save = await loadSave();
    sfx.soundOn = this.save.settings.sound;
    sfx.musicOn = this.save.settings.music;
    try {
      await Promise.all([document.fonts.load('64px "Lilita One"'), document.fonts.load('64px "CA Round"', '王冠')]);
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
    // the game is portrait-only; on wide screens (desktop browsers) show it as a centred phone-shaped column
    const app = $('#app');
    let w = window.innerWidth;
    const h = window.innerHeight;
    if (w / h > 0.62) {
      w = Math.round(h * 0.5);
      app.style.width = `${w}px`;
      app.style.left = `${Math.round((window.innerWidth - w) / 2)}px`;
      app.style.right = 'auto';
      document.body.classList.add('framed');
    } else {
      app.style.width = '';
      app.style.left = '';
      app.style.right = '';
      document.body.classList.remove('framed');
    }
    this.view.resize(w, h);
  }

  private newWorld() {
    const level = generateLevel(this.save.level, this.save.failStreak);
    this.world = new World(level, statsFor(this.save.upgrades), (Date.now() & 0xffff) + 1, this.equippedSkill());
    this.view.load(this.world);
    this.bossAnnounced = false;
    this.gateTipShown = false;
    this.skillWasReady = false;
    sfx.setTrack(level.theme);
    this.clearBanners();
  }

  /** The chosen skill if unlocked, otherwise the newest unlocked one. */
  private equippedSkill(): SkillKind | null {
    const open = unlockedSkills(this.save.level);
    if (this.save.skill && open.includes(this.save.skill)) return this.save.skill;
    return open.at(-1) ?? null;
  }

  private markSeen(key: string) {
    if (this.save.seen.includes(key)) return false;
    this.save.seen.push(key);
    void writeSave(this.save);
    return true;
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
      this.watchPerformance(dt);
    }
    this.view.homeView = this.mode === 'home';
    this.view.render(this.world, this.mode === 'paused' ? 0 : dt);
    requestAnimationFrame((n) => this.frame(n));
  }

  /** Drops resolution on devices that cannot hold ~45fps during play. */
  private watchPerformance(dt: number) {
    if (document.hidden) return;
    this.perfFrames++;
    this.perfTime += dt;
    if (this.perfFrames < 120) return;
    const avg = this.perfTime / this.perfFrames;
    this.perfFrames = 0;
    this.perfTime = 0;
    if (avg > 1 / 45) this.view.reduceQuality();
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
        case 'hazardHit':
          sfx.crash();
          this.haptic('heavy');
          break;
        case 'bossSmash':
          sfx.smash();
          this.haptic('heavy');
          break;
        case 'bossDead':
          sfx.crash();
          this.haptic('success');
          break;
        case 'bossThrow':
          sfx.whoosh();
          break;
        case 'shotLand':
          sfx.crash();
          if (ev.n > 0) this.haptic('medium');
          break;
        case 'bossSummon':
          sfx.summon();
          break;
        case 'shieldUp':
          sfx.shield();
          break;
        case 'bossEnrage':
          sfx.roar(true);
          this.haptic('heavy');
          break;
        case 'enemyVolley':
          sfx.volley();
          break;
        case 'bomb':
          sfx.boom();
          this.haptic('heavy');
          break;
        case 'freeze':
          sfx.freeze();
          break;
        case 'skill':
          if (ev.skill === 'storm') sfx.storm();
          else if (ev.skill === 'horn') sfx.horn();
          this.haptic('medium');
          break;
        case 'chestOpen':
          sfx.treasure();
          this.bumpCoins();
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
        this.banner({ title: t.gateTip, kind: 'tip' });
      }
    }
    if (!this.bossAnnounced && w.boss.state === 'walk') {
      this.bossAnnounced = true;
      sfx.roar();
      sfx.setTrack('boss');
      const kind = w.boss.kind;
      if (kind !== 'chest' && kind !== 'giant' && this.markSeen(`boss:${kind}`)) {
        this.banner({ title: `${t.newBoss}：${t[`boss_${kind}`]}`, sub: t[`bossInfo_${kind}`], kind: 'boss' });
      } else {
        this.banner({ title: t.bossIncoming, kind: 'boss' });
      }
    }
    this.introduceNewContent();
  }

  /** First encounters with a unit type or item get a short explanation. */
  private introduceNewContent() {
    const w = this.world;
    for (const s of w.squads) {
      if (s.gone || !s.aggro || s.unit === 'infantry' || s.unit === 'skeleton') continue;
      if (this.markSeen(`unit:${s.unit}`)) this.banner({ title: t.newEnemy, sub: t[`unit_${s.unit}`], kind: 'intro' });
    }
    for (const b of w.barrels) {
      if (b.broken || b.gone || b.small || b.d - w.army.d > 40) continue;
      const type = b.reward.type;
      if ((type === 'fire' || type === 'freeze' || type === 'bomb') && REWARD_FROM[type] > 1 && this.markSeen(`item:${type}`)) {
        this.banner({ title: t.newItem, sub: t[`item_${type}`], kind: 'intro' });
      }
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
      const scale = (ROAD_HALF_WIDTH * 2.6) / Math.min($('#app').clientWidth, 600);
      this.world.setTargetX(this.dragStartTarget + (e.clientX - this.dragStartX) * scale);
    });
    const end = () => (this.dragging = false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    $('#btn-play').addEventListener('click', () => this.start());
    $('#btn-skill').addEventListener('click', () => {
      if (this.mode === 'playing' && this.world.useSkill()) this.onEvents();
    });
    $('#btn-skill-select').addEventListener('click', () => this.cycleSkill());
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
    this.renderSkillChip();
    if (this.world) sfx.setTrack(this.world.level.theme);
  }

  private cycleSkill() {
    const open = unlockedSkills(this.save.level);
    this.click();
    if (!open.length) return;
    const current = this.equippedSkill();
    const next = open[(open.indexOf(current ?? open[0]) + 1) % open.length];
    this.save.skill = next;
    this.markSeen(`skill:${next}`);
    void writeSave(this.save);
    this.newWorld();
    this.renderSkillChip();
  }

  private renderSkillChip() {
    const skill = this.equippedSkill();
    const chip = $('#btn-skill-select');
    const open = unlockedSkills(this.save.level);
    chip.classList.toggle('locked', !skill);
    if (skill) {
      $('#chip-icon').innerHTML = SKILL_ICONS[skill];
      $('#chip-name').textContent = t[`skill_${skill}`];
      $('#chip-sub').textContent = open.length > 1 ? `${t[`skillInfo_${skill}`]} · ⇄` : t[`skillInfo_${skill}`];
    } else {
      $('#chip-icon').innerHTML = SKILL_ICONS.storm;
      $('#chip-name').textContent = t.skill;
      $('#chip-sub').textContent = t.skillUnlock(SKILL_UNLOCK.storm);
    }
    // a freshly unlocked skill the player has not looked at yet
    const fresh = open.some((k) => !this.save.seen.includes(`skill:${k}`));
    $('#chip-new').style.display = fresh && open.length > 0 ? '' : 'none';
    if (skill && open.length === 1) this.markSeen(`skill:${skill}`);
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
    const skill = this.world.skill;
    $('#btn-skill').classList.toggle('hidden', !skill);
    if (skill) {
      $('#skill-icon').innerHTML = SKILL_ICONS[skill];
      $('#skill-label').textContent = t[`skill_${skill}`];
    }
    const theme = this.world.level.theme;
    if (this.world.level.bonus) {
      this.banner({ title: t.bonusLevel, sub: t.bonusInfo, kind: 'intro' });
    } else if (theme !== 'river' && this.markSeen(`theme:${theme}`)) {
      this.banner({ title: `${t.newRegion}：${t[`theme_${theme}`]}`, kind: 'intro' });
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
    this.clearBanners();
    // stop accepting input right away; the card appears after a short beat
    this.mode = 'result';
    this.dragging = false;
    const world = this.world;
    window.setTimeout(() => {
      // the player may already have left this run (e.g. back to home)
      if (this.mode !== 'result' || this.world !== world) return;
      document.body.dataset.mode = 'result';
      if (won) sfx.win();
      else sfx.lose();
      this.haptic(won ? 'success' : 'error');
      $('#result .result-card').classList.toggle('won', won);
      $('#result-title').textContent = won ? t.victory : t.defeat;
      $('#result-level').textContent = t.level(level);
      const unlocked = won ? SKILLS.find((k) => SKILL_UNLOCK[k] === level + 1) : undefined;
      $('#result-detail').textContent = unlocked
        ? `${t.newSkill}：${t[`skill_${unlocked}`]}！`
        : won ? t.survivors(Math.round(w.army.count)) : t.reached(Math.round(w.progress * 100));
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

  /** Banners queue up so several introductions in a row stay readable. */
  private banner(msg: BannerMsg) {
    if (msg.kind === 'boss') {
      // the boss entrance is the most important message: show it right away
      this.banners = [msg];
      if (this.bannerTimer !== null) window.clearTimeout(this.bannerTimer);
      this.nextBanner();
      return;
    }
    this.banners.push(msg);
    if (this.bannerTimer === null) this.nextBanner();
  }

  private nextBanner() {
    const msg = this.banners.shift();
    const b = $('#banner');
    if (!msg) {
      this.bannerTimer = null;
      return;
    }
    b.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'banner-title';
    title.textContent = msg.title;
    b.appendChild(title);
    if (msg.sub) {
      const sub = document.createElement('div');
      sub.className = 'banner-sub';
      sub.textContent = msg.sub;
      b.appendChild(sub);
    }
    b.classList.toggle('tip', msg.kind === 'tip');
    b.classList.toggle('intro', msg.kind === 'intro');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    const ms = msg.sub ? 2600 : 1800;
    this.bannerTimer = window.setTimeout(() => this.nextBanner(), this.banners.length ? ms * 0.8 : ms);
  }

  private clearBanners() {
    this.banners = [];
    if (this.bannerTimer !== null) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = null;
    $('#banner').classList.remove('show');
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
    this.timedBuff('#buff-fire', a.burnTimer, t.reward_fire);
    this.timedBuff('#buff-frost', a.frostTimer, t.buff_frost);
    this.timedBuff('#buff-freeze', this.world.freezeTimer, t.buff_freeze);

    const w = this.world;
    if (w.skill) {
      const btn = $('#btn-skill');
      const ready = w.skillCharge >= 1;
      btn.style.setProperty('--charge', w.skillCharge.toFixed(3));
      btn.classList.toggle('ready', ready);
      if (ready && !this.skillWasReady) {
        sfx.skillReady();
        this.haptic('light');
      }
      this.skillWasReady = ready;
    }
  }

  private timedBuff(sel: string, timer: number, label: string) {
    const el = $(sel);
    el.classList.toggle('on', timer > 0);
    const text = `${label} ${Math.ceil(timer)}s`;
    if (timer > 0 && el.textContent !== text) el.textContent = text;
  }

  /** Lets the screenshot script fast-forward a level with the autopilot. */
  debugAutoplay(seconds: number) {
    for (let i = 0; i < seconds * 60 && this.world.state === 'playing'; i++) {
      botSteer(this.world);
      this.world.update(STEP);
      this.onEvents();
    }
  }

  /** Screenshot helper: stop the simulation but keep rendering. */
  debugFreeze(frames = 90, simulate = false) {
    // autoplay skips rendering, so let the camera and popups catch up first
    for (let i = 0; i < frames; i++) {
      if (simulate && this.world.state === 'playing') {
        botSteer(this.world);
        this.world.update(STEP);
        this.onEvents();
      }
      this.view.render(this.world, 1 / 60);
    }
    if (this.mode === 'playing') this.mode = 'paused';
    this.world.boss.hitTime = -1;
    this.view.render(this.world, 0);
    this.updateHud();
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
const params = new URLSearchParams(location.search);
const debug = import.meta.env.DEV || params.has('debug');
void game.boot().then(() => {
  // testing shortcuts: ?debug&level=24 jumps to a level, &up=14 sets every upgrade to that level
  if (!debug) return;
  const level = Number(params.get('level'));
  if (Number.isInteger(level) && level >= 1) game.debugSetLevel(level);
  const up = Number(params.get('up'));
  if (params.has('up') && Number.isInteger(up) && up >= 0) game.debugSetSave({ upgrades: { army: up, rate: up, damage: up, income: up } });
});
// never leave the native splash up if startup fails for any reason
if (Capacitor.isNativePlatform()) window.setTimeout(() => void SplashScreen.hide().catch(() => undefined), 5000);
if (debug) (window as unknown as { game: Game }).game = game;
