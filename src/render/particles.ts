import * as THREE from 'three';

const CAPACITY = 900;
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const p = new THREE.Vector3();
const c = new THREE.Color();

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rot: number; spin: number;
  size: number; life: number; age: number;
}

/** Pooled instanced cubes for hits, deaths and explosions. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly items: Particle[] = [];
  private cursor = 0;

  constructor() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < CAPACITY; i++) {
      this.items.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, size: 0, life: 0, age: 1 });
      this.mesh.setColorAt(i, c.set(0xffffff));
    }
  }

  burst(x: number, y: number, z: number, color: number, n: number, speed = 4, size = 0.14, life = 0.7) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % CAPACITY;
      const it = this.items[i];
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random();
      const sp = speed * (0.4 + Math.random() * 0.8);
      it.x = x; it.y = y; it.z = z;
      it.vx = Math.cos(a) * sp;
      it.vz = Math.sin(a) * sp;
      it.vy = up * speed;
      it.rot = Math.random() * 6;
      it.spin = (Math.random() - 0.5) * 14;
      it.size = size * (0.6 + Math.random() * 0.8);
      it.life = life * (0.7 + Math.random() * 0.6);
      it.age = 0;
      c.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      this.mesh.setColorAt(i, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    let max = 0;
    for (let i = 0; i < CAPACITY; i++) {
      const it = this.items[i];
      if (it.age >= it.life) {
        m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, m);
        continue;
      }
      max = i + 1;
      it.age += dt;
      it.vy -= 16 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.z += it.vz * dt;
      if (it.y < 0.05) {
        it.y = 0.05;
        it.vy *= -0.3;
        it.vx *= 0.6;
        it.vz *= 0.6;
      }
      it.rot += it.spin * dt;
      const f = 1 - it.age / it.life;
      e.set(it.rot, it.rot * 0.7, 0);
      q.setFromEuler(e);
      s.setScalar(it.size * Math.min(1, f * 2.5));
      p.set(it.x, it.y, it.z);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.count = max;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const it of this.items) it.age = it.life = 0;
    this.mesh.count = 0;
  }
}
