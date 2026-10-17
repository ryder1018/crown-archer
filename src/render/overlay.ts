import * as THREE from 'three';
import { formatCount } from '../i18n';

const tmp = new THREE.Vector3();

interface Popup { el: HTMLDivElement; pos: THREE.Vector3; follow: (() => THREE.Vector3) | null; age: number; life: number; active: boolean }

const HUD_SAFE_TOP = 96;

/** DOM layer for crisp text that tracks 3D positions: troop counts, boss HP, floating numbers. */
export class Overlay {
  private readonly armyBadge: HTMLDivElement;
  private readonly squadBadges = new Map<number, HTMLDivElement>();
  private readonly bossBadge: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossText: HTMLDivElement;
  private readonly popups: Popup[] = [];
  private width = 1;
  private height = 1;
  private safeTop = 0;

  constructor(private readonly root: HTMLElement) {
    this.armyBadge = this.el('badge badge-army');
    this.bossBadge = this.el('boss-badge');
    this.bossText = document.createElement('div');
    this.bossText.className = 'boss-hp-text';
    const bar = document.createElement('div');
    bar.className = 'boss-hp-bar';
    this.bossFill = document.createElement('div');
    this.bossFill.className = 'boss-hp-fill';
    bar.appendChild(this.bossFill);
    this.bossBadge.append(this.bossText, bar);
  }

  private el(cls: string) {
    const e = document.createElement('div');
    e.className = cls;
    e.style.display = 'none';
    this.root.appendChild(e);
    return e;
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
    document.body.appendChild(probe);
    this.safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
  }

  private project(camera: THREE.Camera, v: THREE.Vector3): [number, number, boolean] {
    tmp.copy(v).project(camera);
    const visible = tmp.z < 1 && tmp.x > -1.2 && tmp.x < 1.2 && tmp.y > -1.2 && tmp.y < 1.2;
    return [(tmp.x * 0.5 + 0.5) * this.width, (-tmp.y * 0.5 + 0.5) * this.height, visible];
  }

  private place(e: HTMLElement, camera: THREE.Camera, v: THREE.Vector3, minTop = 0) {
    const [x, raw, vis] = this.project(camera, v);
    const y = Math.max(raw, minTop);
    if (!vis) {
      e.style.display = 'none';
      return;
    }
    e.style.display = '';
    e.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  setArmy(camera: THREE.Camera, pos: THREE.Vector3 | null, count: number) {
    if (!pos) {
      this.armyBadge.style.display = 'none';
      return;
    }
    const text = formatCount(count);
    if (this.armyBadge.textContent !== text) this.armyBadge.textContent = text;
    this.place(this.armyBadge, camera, pos);
  }

  setSquad(camera: THREE.Camera, id: number, pos: THREE.Vector3 | null, count: number) {
    let e = this.squadBadges.get(id);
    if (!pos) {
      if (e) e.style.display = 'none';
      return;
    }
    if (!e) {
      e = this.el('badge badge-enemy');
      this.squadBadges.set(id, e);
    }
    const text = formatCount(Math.ceil(count));
    if (e.textContent !== text) e.textContent = text;
    this.place(e, camera, pos);
  }

  setBoss(camera: THREE.Camera, pos: THREE.Vector3 | null, hp: number, maxHp: number) {
    if (!pos) {
      this.bossBadge.style.display = 'none';
      return;
    }
    const text = formatCount(Math.ceil(hp));
    if (this.bossText.textContent !== text) this.bossText.textContent = text;
    this.bossFill.style.transform = `scaleX(${Math.max(0, hp / maxHp).toFixed(3)})`;
    this.place(this.bossBadge, camera, pos, HUD_SAFE_TOP + this.safeTop + 60);
  }

  popup(pos: THREE.Vector3 | (() => THREE.Vector3), text: string, cls: string, life = 1.1) {
    let p = this.popups.find((q) => !q.active);
    if (!p) {
      if (this.popups.length > 40) return;
      const el = document.createElement('div');
      this.root.appendChild(el);
      p = { el, pos: new THREE.Vector3(), follow: null, age: 0, life, active: false };
      this.popups.push(p);
    }
    p.el.className = `popup ${cls}`;
    p.el.textContent = text;
    if (typeof pos === 'function') {
      p.follow = pos;
      p.pos.copy(pos());
    } else {
      p.follow = null;
      p.pos.copy(pos);
    }
    p.age = 0;
    p.life = life;
    p.active = true;
    p.el.style.display = '';
  }

  update(camera: THREE.Camera, dt: number) {
    for (const p of this.popups) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.el.style.display = 'none';
        continue;
      }
      const f = p.age / p.life;
      const [x, y] = this.project(camera, p.follow ? p.follow() : p.pos);
      const rise = 70 * (1 - (1 - f) * (1 - f));
      const scale = f < 0.15 ? 0.6 + (f / 0.15) * 0.6 : 1.2 - Math.min(0.2, (f - 0.15) * 0.8);
      p.el.style.opacity = String(f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1);
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - rise).toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
    }
  }

  clear() {
    this.armyBadge.style.display = 'none';
    this.bossBadge.style.display = 'none';
    for (const e of this.squadBadges.values()) e.remove();
    this.squadBadges.clear();
    for (const p of this.popups) {
      p.active = false;
      p.el.style.display = 'none';
    }
  }
}
