import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BossKind } from '../sim/types';
import type { ShotKind, World } from '../sim/world';
import { arrowGeometry } from './models';
import type { Particles } from './particles';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const v2 = new THREE.Vector3();
const s = new THREE.Vector3(1, 1, 1);
const FORWARD = new THREE.Vector3(0, 0, -1);

interface Flight { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; t: number; total: number; arc: number; alive: boolean }

/** Pool of instanced arrows that fly from one point to another along an arc. */
class ArrowPool {
  readonly mesh: THREE.InstancedMesh;
  private readonly items: Flight[] = [];

  constructor(color: [number, number, number], private readonly capacity: number, scale = 1) {
    const geo = arrowGeometry(...color);
    geo.scale(scale, scale, scale);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  launch(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, total: number, arc: number) {
    let it = this.items.find((i) => !i.alive);
    if (!it) {
      if (this.items.length >= this.capacity) return;
      it = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, t: 0, total: 1, arc: 0, alive: false };
      this.items.push(it);
    }
    Object.assign(it, { x0, y0, z0, x1, y1, z1, t: 0, total, arc, alive: true });
  }

  /** Returns the landing points of arrows that arrived this frame. */
  update(dt: number, landed?: (x: number, z: number) => void) {
    let n = 0;
    for (const it of this.items) {
      if (!it.alive) continue;
      it.t += dt;
      const f = Math.min(1, it.t / it.total);
      if (f >= 1) {
        it.alive = false;
        landed?.(it.x1, it.z1);
        continue;
      }
      const pos = (k: number, out: THREE.Vector3) =>
        out.set(
          it.x0 + (it.x1 - it.x0) * k,
          it.y0 + (it.y1 - it.y0) * k + Math.sin(k * Math.PI) * it.arc,
          it.z0 + (it.z1 - it.z0) * k,
        );
      pos(f, v);
      pos(Math.min(1, f + 0.02), v2);
      v2.sub(v).normalize();
      q.setFromUnitVectors(FORWARD, v2);
      m4.compose(v, q, s);
      this.mesh.setMatrixAt(n++, m4);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const it of this.items) it.alive = false;
    this.mesh.count = 0;
  }
}

interface ShotView { proj: THREE.Mesh; marker: THREE.Group; fill: THREE.Mesh }

interface PoolView { mesh: THREE.Mesh; rim: THREE.Mesh }

interface Bolt { mesh: THREE.Mesh; age: number }

interface Shockwave { mesh: THREE.Mesh; age: number; life: number; size: number }

/** Boss projectiles with landing markers, enemy volleys, the arrow storm and explosions. */
export class Effects {
  readonly group = new THREE.Group();
  private readonly enemyArrows = new ArrowPool([0x5a3a22, 0x2a1a10, 0xd0d6de], 160, 0.75);
  private readonly stormArrows = new ArrowPool([0xffffff, 0x2f7bff, 0x7fdcff], 420, 1.7);
  private readonly shots = new Map<number, ShotView>();
  private readonly pools = new Map<number, PoolView>();
  private readonly bolts: Bolt[] = [];
  private readonly poolMat = new THREE.MeshBasicMaterial({ color: 0x6adf2a, transparent: true, opacity: 0.55, depthWrite: false });
  private readonly poolRimMat = new THREE.MeshBasicMaterial({ color: 0xc8ff6a, transparent: true, opacity: 0.8, depthWrite: false });
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly waves: Shockwave[] = [];
  private projGeo: THREE.BufferGeometry = new THREE.DodecahedronGeometry(0.7, 0);
  private projMat: THREE.Material = new THREE.MeshLambertMaterial({ color: 0x8a6a4a, flatShading: true });
  private readonly ringGeo = new THREE.RingGeometry(0.92, 1, 40);
  private readonly discGeo = new THREE.CircleGeometry(1, 40);
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, depthWrite: false });
  private readonly discMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.22, depthWrite: false });
  private readonly fillMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35, depthWrite: false });
  private readonly waveMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private projColor = 0x8a6a4a;
  private time = 0;

  constructor(private readonly particles: Particles) {
    this.group.add(this.enemyArrows.mesh, this.stormArrows.mesh);
    const boltGeo = boltGeometry();
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(boltGeo, this.boltMat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.bolts.push({ mesh, age: 1 });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), this.waveMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.waves.push({ mesh, age: 1, life: 1, size: 1 });
    }
  }

  /** Picks the projectile look for the current boss. */
  setBoss(kind: BossKind, accent: number) {
    this.projGeo.dispose();
    this.projMat.dispose();
    this.projColor = accent;
    if (kind === 'frost') {
      this.projGeo = new THREE.OctahedronGeometry(0.8, 0);
      this.projMat = new THREE.MeshLambertMaterial({ color: 0xc8f4ff, emissive: 0x2a8fc0, flatShading: true });
    } else if (kind === 'golem') {
      this.projGeo = new THREE.IcosahedronGeometry(0.75, 0);
      this.projMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    } else if (kind === 'lich') {
      this.projGeo = new THREE.SphereGeometry(0.55, 12, 8);
      this.projMat = new THREE.MeshBasicMaterial({ color: accent });
    } else if (kind === 'ape') {
      this.projGeo = new THREE.IcosahedronGeometry(0.6, 0);
      this.projMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a, flatShading: true });
    } else if (kind === 'witch') {
      // a round potion flask
      const flask = new THREE.SphereGeometry(0.5, 10, 8);
      const neck = new THREE.CylinderGeometry(0.15, 0.18, 0.4, 8);
      neck.translate(0, 0.55, 0);
      this.projGeo = mergeGeometries([flask, neck]) ?? flask;
      this.projMat = new THREE.MeshBasicMaterial({ color: 0x8aff4a });
    } else {
      this.projGeo = new THREE.DodecahedronGeometry(0.8, 0);
      this.projMat = new THREE.MeshLambertMaterial({ color: 0x7a6250, flatShading: true });
    }
  }

  enemyVolley(fromX: number, fromZ: number, toX: number, toZ: number, n: number, spread: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      this.enemyArrows.launch(
        fromX + (Math.random() - 0.5) * 2, 1, fromZ,
        toX + Math.cos(a) * r, 0.4, toZ + Math.sin(a) * r,
        0.45 + Math.random() * 0.15, 2.2,
      );
    }
  }

  storm(points: { x: number; z: number }[]) {
    for (const p of points) {
      for (let k = 0; k < 5; k++) {
        const x = p.x + (Math.random() - 0.5) * 2.4;
        const z = p.z + (Math.random() - 0.5) * 2.4;
        // fired in a long slant from behind the army so the arrows read clearly from the camera
        this.stormArrows.launch(x - 1 + Math.random() * 2, 15, z + 20, x, 0.3, z, 0.5 + Math.random() * 0.2, 0);
      }
    }
  }

  explosion(x: number, z: number, color: number, size = 1) {
    this.particles.burst(x, 0.8, z, color, Math.round(30 * size), 7 * size, 0.3 * size, 0.9);
    this.particles.burst(x, 0.6, z, 0x2a2420, Math.round(14 * size), 4 * size, 0.35 * size, 1.1);
    this.wave(x, z, color, 5 * size);
  }

  wave(x: number, z: number, color: number, size: number, life = 0.5) {
    const w = this.waves.reduce((p, c) => (c.age / c.life > p.age / p.life ? c : p));
    w.age = 0;
    w.life = life;
    w.size = size;
    w.mesh.position.set(x, 0.08, z);
    (w.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    w.mesh.visible = true;
  }

  shotLanded(kind: ShotKind, x: number, z: number, r: number) {
    if (kind === 'bolt') {
      const b = this.bolts.reduce((p, c) => (c.age > p.age ? c : p));
      b.age = 0;
      b.mesh.position.set(x, 0, z);
      b.mesh.rotation.y = Math.random() * Math.PI;
      b.mesh.visible = true;
      this.particles.burst(x, 0.5, z, 0xbfefff, 24, 6, 0.14, 0.6);
      this.wave(x, z, 0xbfefff, r * 3, 0.4);
      return;
    }
    if (kind === 'poison') {
      this.particles.burst(x, 0.5, z, 0x8aff4a, 30, 5, 0.18, 0.8);
      this.wave(x, z, 0x8aff4a, r * 2.5, 0.5);
      return;
    }
    if (kind === 'leap') {
      this.particles.burst(x, 0.3, z, 0x9a8a6a, 40, 8, 0.25, 0.9);
      this.wave(x, z, 0xffffff, r * 4, 0.6);
      return;
    }
    this.explosion(x, z, this.projColor, 0.6 + r * 0.25);
  }

  /** Keeps a bubbling puddle for every poison pool on the road. */
  syncPools(world: World) {
    const live = new Set<number>();
    for (const p of world.pools) {
      live.add(p.id);
      let view = this.pools.get(p.id);
      if (!view) {
        const mesh = new THREE.Mesh(this.discGeo, this.poolMat);
        const rim = new THREE.Mesh(this.ringGeo, this.poolRimMat);
        mesh.rotation.x = rim.rotation.x = -Math.PI / 2;
        this.group.add(mesh, rim);
        view = { mesh, rim };
        this.pools.set(p.id, view);
      }
      // grow in, wobble, and shrink away at the end
      const life = Math.min(1, (p.total - p.t) / 0.25, p.t / 0.6);
      const r = p.r * life * (1 + Math.sin(this.time * 4 + p.id) * 0.03);
      view.mesh.position.set(p.x, 0.04, -p.d);
      view.rim.position.set(p.x, 0.045, -p.d);
      view.mesh.scale.set(r, r, 1);
      view.rim.scale.set(r, r, 1);
      if (Math.random() < 0.25) {
        const a = Math.random() * Math.PI * 2;
        const k = Math.sqrt(Math.random()) * p.r * 0.8;
        this.particles.burst(p.x + Math.cos(a) * k, 0.1, -p.d + Math.sin(a) * k, 0xb8ff7a, 1, 1.2, 0.1, 0.5);
      }
    }
    for (const [id, view] of this.pools) {
      if (live.has(id)) continue;
      this.group.remove(view.mesh, view.rim);
      this.pools.delete(id);
    }
  }

  /** Keeps a projectile + landing marker for every shot in flight. */
  syncShots(world: World) {
    const live = new Set<number>();
    for (const shot of world.shots) {
      live.add(shot.id);
      let view = this.shots.get(shot.id);
      if (!view) {
        const marker = new THREE.Group();
        const disc = new THREE.Mesh(this.discGeo, this.discMat);
        const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
        const fill = new THREE.Mesh(this.discGeo, this.fillMat);
        for (const m of [disc, ring, fill]) m.rotation.x = -Math.PI / 2;
        marker.add(disc, ring, fill);
        const proj = new THREE.Mesh(this.projGeo, this.projMat);
        this.group.add(marker, proj);
        view = { proj, marker, fill };
        this.shots.set(shot.id, view);
      }
      const f = 1 - shot.t / shot.total;
      // the leaping boss and lightning have no flying projectile, only the warning marker
      view.proj.visible = shot.kind === 'rock' || shot.kind === 'poison';
      view.marker.position.set(shot.x, 0.05 + (shot.id % 5) * 0.004, -shot.d);
      const pulse = 1 + Math.sin(this.time * 18) * 0.04;
      view.marker.scale.set(shot.r * pulse, 1, shot.r * pulse);
      view.fill.scale.setScalar(Math.max(0.01, f));
      const sx = shot.fromX + (shot.x - shot.fromX) * f;
      const sz = -(shot.fromD - 1 + (shot.d - shot.fromD + 1) * f);
      view.proj.position.set(sx, 5.5 * (1 - f) + Math.sin(f * Math.PI) * 5 + 0.4, sz);
      view.proj.rotation.set(this.time * 5, this.time * 3, 0);
    }
    for (const [id, view] of this.shots) {
      if (live.has(id)) continue;
      this.group.remove(view.marker, view.proj);
      this.shots.delete(id);
    }
  }

  update(dt: number) {
    this.time += dt;
    this.enemyArrows.update(dt, (x, z) => {
      if (Math.random() < 0.5) this.particles.burst(x, 0.3, z, 0x2f7bff, 1, 2, 0.1, 0.4);
    });
    this.stormArrows.update(dt, (x, z) => {
      if (Math.random() < 0.7) this.particles.burst(x, 0.3, z, 0x9fdcff, 3, 3.5, 0.14, 0.45);
    });
    for (const b of this.bolts) {
      if (!b.mesh.visible) continue;
      b.age += dt;
      const f = b.age / 0.3;
      if (f >= 1) b.mesh.visible = false;
      else (b.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - f) * (Math.random() < 0.3 ? 0.5 : 1);
    }
    for (const w of this.waves) {
      if (!w.mesh.visible) continue;
      w.age += dt;
      const f = w.age / w.life;
      if (f >= 1) {
        w.mesh.visible = false;
        continue;
      }
      const sc = 0.5 + f * w.size;
      w.mesh.scale.set(sc, sc, 1);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - f;
    }
  }

  clear() {
    this.enemyArrows.clear();
    this.stormArrows.clear();
    for (const view of this.shots.values()) this.group.remove(view.marker, view.proj);
    this.shots.clear();
    for (const view of this.pools.values()) this.group.remove(view.mesh, view.rim);
    this.pools.clear();
    for (const b of this.bolts) b.mesh.visible = false;
    for (const w of this.waves) w.mesh.visible = false;
  }
}

/** A jagged lightning bolt from the sky down to the ground at the origin. */
function boltGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < 7; i++) {
    const nx = i === 6 ? 0 : (Math.random() - 0.5) * 1.6;
    const ny = y + 2.4;
    const len = Math.hypot(nx - x, ny - y);
    const seg = new THREE.BoxGeometry(0.28, len, 0.28);
    seg.rotateZ(-Math.atan2(nx - x, ny - y));
    seg.translate((x + nx) / 2, (y + ny) / 2, 0);
    parts.push(seg);
    x = nx;
    y = ny;
  }
  return mergeGeometries(parts)!;
}
