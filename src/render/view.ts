import * as THREE from 'three';
import { t } from '../i18n';
import { ARROW_RANGE, ARROW_SPEED, MAX_ARMY_DISPLAY, MAX_ARROWS, type Reward } from '../sim/types';
import { type Barrel, type Gate, type Hazard, type World, type WorldEvent } from '../sim/world';
import { buildEnvironment, THEMES, type Environment } from './environment';
import { archerGeometry, arrowGeometry, barrelGeometry, BOSS_COLORS, bossRig, enemyGeometry, kingGroup, PALETTE, spikeRollerGeometry, type BossRig } from './models';
import { Overlay } from './overlay';
import { Particles } from './particles';
import { blobTexture, crateLabel, gateLabel, hazardStripeTexture, hpLabel, LabelTexture, ringTexture } from './textures';

const ENEMY_CAPACITY = 1800;
const SLOT_OFFSET = 3;
const GOLDEN = 2.39996;

const m4 = new THREE.Matrix4();
const qy = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const sc = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const qx = new THREE.Quaternion();

interface GateView { gate: Gate; group: THREE.Group; panel: THREE.Mesh; label: LabelTexture; mat: THREE.MeshBasicMaterial; fade: number; lastHit: number }
interface HazardView { hazard: Hazard; group: THREE.Group; roller: THREE.Mesh }
interface BarrelView { barrel: Barrel; group: THREE.Group; body: THREE.Mesh; label: LabelTexture; sprite: THREE.Sprite | null }

function slot(i: number, out: { x: number; z: number }) {
  const idx = i + SLOT_OFFSET;
  const r = 0.21 * Math.sqrt(idx);
  const a = idx * GOLDEN;
  out.x = Math.cos(a) * r;
  out.z = Math.sin(a) * r;
}

export function gateText(g: Gate) {
  if (g.op === 'mul') return `x${g.value}`;
  if (g.op === 'div') return `÷${g.value}`;
  return g.value >= 0 ? `+${g.value}` : `${g.value}`;
}

export const gateIsGood = (g: Gate) => g.op === 'mul' || (g.op === 'add' && g.value > 0);

export function rewardText(r: Reward) {
  if (r.type === 'rapid') return t.reward_rapid;
  if (r.type === 'multi') return t.reward_multi;
  if (r.type === 'coins') return `+${r.amount} ${t.reward_coins}`;
  return `+${r.amount} ${t.reward_soldiers}`;
}

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 260);
  readonly overlay: Overlay;
  private readonly hemi: THREE.HemisphereLight;
  private readonly armyMesh: THREE.InstancedMesh;
  private readonly enemyMesh: THREE.InstancedMesh;
  private readonly arrowMesh: THREE.InstancedMesh;
  private readonly particles = new Particles();
  private readonly king: THREE.Mesh;
  private readonly armyShadow: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly blobTex = blobTexture();
  private levelGroup = new THREE.Group();
  private env: Environment | null = null;
  private gates: GateView[] = [];
  private barrels: BarrelView[] = [];
  private hazards: HazardView[] = [];
  private boss: BossRig | null = null;
  private bossShadow: THREE.Mesh | null = null;
  private squadShadows = new Map<number, THREE.Mesh>();
  private levelDisposables: { dispose(): void }[] = [];

  private armyShown = 0;
  private readonly soldierScale = new Float32Array(MAX_ARMY_DISPLAY);
  private readonly soldierPhase = new Float32Array(MAX_ARMY_DISPLAY);
  private time = 0;
  private shake = 0;
  private ringAge = 99;
  /** On the home screen the camera frames the army above the menu. */
  homeView = false;
  private homeBlend = 0;
  private camX = 0;
  private camZ = 0;
  private bossDeadAge = -1;
  private kingFall = 0;

  constructor(canvas: HTMLCanvasElement, overlayRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.overlay = new Overlay(overlayRoot);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x446688, 1.5);
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(-6, 12, 5);
    this.scene.add(this.hemi, sun, new THREE.AmbientLight(0xffffff, 0.25));

    const crowdMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.armyMesh = new THREE.InstancedMesh(archerGeometry(), crowdMat, MAX_ARMY_DISPLAY);
    this.enemyMesh = new THREE.InstancedMesh(enemyGeometry(), crowdMat, ENEMY_CAPACITY);
    this.arrowMesh = new THREE.InstancedMesh(arrowGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_ARROWS);
    for (const im of [this.armyMesh, this.enemyMesh, this.arrowMesh]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.count = 0;
    }
    for (let i = 0; i < MAX_ARMY_DISPLAY; i++) this.soldierPhase[i] = Math.random() * Math.PI * 2;

    this.king = kingGroup();
    this.armyShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }),
    );
    this.armyShadow.rotation.x = -Math.PI / 2;
    this.armyShadow.position.y = 0.02;
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, color: 0xffd27a }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;

    this.scene.add(this.armyShadow, this.armyMesh, this.enemyMesh, this.arrowMesh, this.particles.mesh, this.king, this.ring, this.levelGroup);
  }

  /** Lowers the render resolution one step; returns false when already at the floor. */
  reduceQuality() {
    const current = this.renderer.getPixelRatio();
    if (current <= 1) return false;
    this.renderer.setPixelRatio(Math.max(1, current - 0.35));
    const size = this.renderer.getSize(new THREE.Vector2());
    this.renderer.setSize(size.x, size.y, false);
    return true;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep roughly the same road width on screen regardless of the aspect ratio
    const hfov = THREE.MathUtils.degToRad(46);
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / this.camera.aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 38, 80);
    this.camera.updateProjectionMatrix();
    this.overlay.resize(w, h);
  }

  load(world: World) {
    this.unload();
    const theme = THEMES[world.level.theme];
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.sky, 55, 120);
    this.hemi.groundColor.set(theme.hemiGround);

    this.env = buildEnvironment(world.level.theme, world.level.bossD + 40, world.level.bossD);
    this.levelGroup.add(this.env.group);

    const postGeo = this.keep(new THREE.BoxGeometry(0.42, 3.1, 0.42));
    const postMat = this.keep(new THREE.MeshLambertMaterial({ color: 0xe8edf3, flatShading: true }));
    const capGeo = this.keep(new THREE.ConeGeometry(0.36, 0.5, 4));
    const capMat = this.keep(new THREE.MeshLambertMaterial({ color: PALETTE.gold, flatShading: true }));
    for (const g of world.gates) {
      const group = new THREE.Group();
      const w = g.x1 - g.x0;
      const label = gateLabel();
      label.set(`${gateText(g)}|${gateIsGood(g) ? 1 : 0}`);
      const mat = new THREE.MeshBasicMaterial({ map: label.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const panel = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(w - 0.5, 2.3)), mat);
      panel.position.y = 1.55;
      group.add(panel);
      for (const px of [-w / 2 + 0.15, w / 2 - 0.15]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 1.55, 0);
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(px, 3.35, 0);
        cap.rotation.y = Math.PI / 4;
        group.add(post, cap);
      }
      group.position.set((g.x0 + g.x1) / 2, 0, -g.d);
      this.levelGroup.add(group);
      this.levelDisposables.push(label, mat);
      this.gates.push({ gate: g, group, panel, label, mat, fade: 1, lastHit: -1 });
    }

    const barrelGeo = this.keep(barrelGeometry());
    const barrelMat = this.keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const crateGeo = this.keep(new THREE.BoxGeometry(1.3, 1.1, 1.3));
    for (const b of world.barrels) {
      const group = new THREE.Group();
      let body: THREE.Mesh;
      let label: LabelTexture;
      let sprite: THREE.Sprite | null = null;
      if (b.small) {
        label = crateLabel();
        label.set(`+${b.reward.amount}`);
        const mat = new THREE.MeshLambertMaterial({ map: label.texture });
        body = new THREE.Mesh(crateGeo, mat);
        body.position.y = 0.55;
        this.levelDisposables.push(mat);
      } else {
        body = new THREE.Mesh(barrelGeo, barrelMat);
        body.position.y = 0.75;
        label = hpLabel();
        label.set(`${Math.ceil(b.hp)}|${rewardText(b.reward)}`);
        const sm = new THREE.SpriteMaterial({ map: label.texture, depthWrite: false });
        sprite = new THREE.Sprite(sm);
        sprite.scale.set(3.2, 1.6, 1);
        sprite.position.y = 2.6;
        group.add(sprite);
        this.levelDisposables.push(sm);
      }
      this.levelDisposables.push(label);
      group.add(body);
      group.position.set(b.x, 0, -b.d);
      this.levelGroup.add(group);
      this.barrels.push({ barrel: b, group, body, label, sprite });
    }

    const stripeTex = this.keep(hazardStripeTexture());
    const rollerMat = this.keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    for (const h of world.hazards) {
      const w = h.x1 - h.x0;
      const group = new THREE.Group();
      const tex = stripeTex.clone();
      tex.repeat.set(w / 1.2, 1.2);
      tex.needsUpdate = true;
      const stripe = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(w, 2.6)), this.keep(new THREE.MeshLambertMaterial({ map: this.keep(tex) })));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 0.03;
      const roller = new THREE.Mesh(this.keep(spikeRollerGeometry(w - 0.3)), rollerMat);
      roller.position.y = 1.0;
      group.add(stripe, roller);
      group.position.set((h.x0 + h.x1) / 2, 0, -h.d);
      this.levelGroup.add(group);
      this.hazards.push({ hazard: h, group, roller });
    }

    this.boss = bossRig(BOSS_COLORS[world.level.theme]);
    this.boss.root.position.set(0, 0, -world.boss.d);
    this.boss.root.scale.setScalar(1.6);
    this.bossShadow = new THREE.Mesh(
      this.keep(new THREE.PlaneGeometry(8, 8)),
      this.keep(new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false })),
    );
    this.bossShadow.rotation.x = -Math.PI / 2;
    this.bossShadow.position.y = 0.03;
    this.levelGroup.add(this.boss.root, this.bossShadow);

    const shadowGeo = this.keep(new THREE.PlaneGeometry(1, 1));
    const shadowMat = this.keep(new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }));
    for (const s of world.squads) {
      const sh = new THREE.Mesh(shadowGeo, shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.025;
      sh.scale.set(s.halfW * 2 + 1, s.halfD * 2 + 1, 1);
      this.levelGroup.add(sh);
      this.squadShadows.set(s.id, sh);
    }

    this.armyShown = 0;
    this.soldierScale.fill(0);
    this.bossDeadAge = -1;
    this.kingFall = 0;
    this.king.rotation.set(0, 0, 0);
    this.camX = world.army.x * 0.3;
    this.camZ = -world.army.d;
    this.particles.clear();
    this.overlay.clear();
  }

  private armyAnchor(world: World, y: number) {
    const a = world.army;
    const out = new THREE.Vector3();
    return () => out.set(a.x, y, -a.d);
  }

  private keep<T extends { dispose(): void }>(x: T): T {
    this.levelDisposables.push(x);
    return x;
  }

  private unload() {
    this.levelGroup.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.scene.remove(this.levelGroup);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.env?.dispose();
    this.env = null;
    for (const b of this.boss?.materials ?? []) b.dispose();
    this.boss = null;
    for (const d of this.levelDisposables) d.dispose();
    this.levelDisposables = [];
    this.gates = [];
    this.barrels = [];
    this.hazards = [];
    this.squadShadows.clear();
  }

  handleEvents(events: readonly WorldEvent[], world: World) {
    const a = world.army;
    for (const ev of events) {
      switch (ev.type) {
        case 'unitDie':
          this.particles.burst(ev.x, 0.5, -ev.d, PALETTE.red, 3, 3, 0.12, 0.5);
          break;
        case 'gatePass': {
          const good = ev.delta >= 0;
          this.overlay.popup(this.armyAnchor(world, 2.6), `${good ? '+' : ''}${ev.delta}`, good ? 'pop-good' : 'pop-bad', 1.2);
          this.particles.burst(a.x, 1.2, -a.d, good ? PALETTE.blueLight : PALETTE.red, 24, 5, 0.14, 0.7);
          if (!good) this.shake = Math.max(this.shake, 0.25);
          break;
        }
        case 'barrelBreak': {
          const b = ev.barrel;
          const color = b.small ? PALETTE.blue : PALETTE.wood;
          this.particles.burst(b.x, 0.8, -b.d, color, b.small ? 14 : 30, b.small ? 5 : 7, b.small ? 0.2 : 0.28, 0.9);
          const text = b.small ? `+${b.reward.amount}` : rewardText(b.reward);
          this.overlay.popup(v3.set(b.x, 2, -b.d), text, b.reward.type === 'coins' ? 'pop-coin' : 'pop-good', 1.2);
          break;
        }
        case 'bossSmash':
          this.shake = Math.max(this.shake, 0.9);
          this.ringAge = 0;
          this.ring.position.set(world.boss.x, 0.06, -(world.boss.d - 2.6));
          this.particles.burst(world.boss.x, 0.3, -(world.boss.d - 2.6), 0xc9b48f, 26, 6, 0.22, 0.8);
          this.overlay.popup(this.armyAnchor(world, 2.8), `-${ev.n}`, 'pop-bad', 1.1);
          break;
        case 'bossDead':
          this.bossDeadAge = 0;
          this.shake = 1;
          this.particles.burst(world.boss.x, 2.5, -world.boss.d, 0xd6452b, 60, 9, 0.35, 1.3);
          this.particles.burst(world.boss.x, 2.5, -world.boss.d, PALETTE.gold, 40, 8, 0.25, 1.4);
          break;
        case 'hazardHit': {
          const h = ev.hazard;
          this.overlay.popup(this.armyAnchor(world, 2.6), `-${ev.n}`, 'pop-bad', 1.1);
          this.particles.burst((h.x0 + h.x1) / 2, 0.8, -h.d, PALETTE.blue, 22, 6, 0.16, 0.8);
          this.shake = Math.max(this.shake, 0.5);
          break;
        }
        case 'squadDead':
          break;
        default:
          break;
      }
    }
  }

  render(world: World, dt: number) {
    this.time += dt;
    this.syncArmy(world, dt);
    this.syncEnemies(world);
    this.syncArrows(world);
    this.syncGates(world, dt);
    this.syncBarrels(world);
    for (const hv of this.hazards) {
      hv.group.visible = hv.hazard.d - world.army.d < 120 && hv.hazard.d - world.army.d > -12;
      hv.roller.rotation.x -= dt * 5;
    }
    this.syncBoss(world, dt);
    this.particles.update(dt);
    this.env?.update(dt);
    this.updateRing(dt);
    this.updateCamera(world, dt);
    this.syncOverlay(world, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private syncArmy(world: World, dt: number) {
    const a = world.army;
    const target = Math.min(Math.round(a.count), MAX_ARMY_DISPLAY);
    const pos = { x: 0, z: 0 };
    if (target < this.armyShown) {
      for (let i = target; i < this.armyShown; i++) {
        slot(i, pos);
        this.particles.burst(a.x + pos.x, 0.5, -a.d + pos.z, PALETTE.blue, 2, 3, 0.12, 0.5);
        this.soldierScale[i] = 0;
      }
    }
    this.armyShown = target;
    const moving = !a.engaged && world.boss.state !== 'attack' && world.state === 'playing';
    const lean = THREE.MathUtils.clamp((a.targetX - a.x) * 0.25, -0.35, 0.35);
    qy.setFromAxisAngle(UP, -lean);
    for (let i = 0; i < target; i++) {
      slot(i, pos);
      this.soldierScale[i] = Math.min(1, this.soldierScale[i] + dt * 5);
      const ph = this.soldierPhase[i];
      const bob = moving ? Math.abs(Math.sin(this.time * 11 + ph)) * 0.09 : 0;
      v3.set(a.x + pos.x, bob, -a.d + pos.z);
      const s = this.soldierScale[i];
      sc.set(s, s * (1 + (moving ? 0 : Math.sin(this.time * 3 + ph) * 0.03)), s);
      m4.compose(v3, qy, sc);
      this.armyMesh.setMatrixAt(i, m4);
    }
    this.armyMesh.count = target;
    this.armyMesh.instanceMatrix.needsUpdate = true;

    if (a.count <= 0) this.kingFall = Math.min(1, this.kingFall + dt * 2.5);
    this.king.position.set(a.x, moving ? Math.abs(Math.sin(this.time * 9)) * 0.08 : 0, -a.d);
    this.king.rotation.set(-this.kingFall * Math.PI / 2, 0, lean * -0.6);

    const r = world.armyRadius * 2 + 1.2;
    this.armyShadow.position.set(a.x, 0.02, -a.d);
    this.armyShadow.scale.set(r, r, 1);
  }

  private syncEnemies(world: World) {
    const a = world.army;
    let n = 0;
    const swing = Math.sin(this.time * 10);
    for (const s of world.squads) {
      const sh = this.squadShadows.get(s.id);
      const visible = !s.gone && s.d - a.d < 110;
      if (sh) {
        sh.visible = visible && s.count > 0;
        sh.position.set(s.x, 0.025, -s.d);
        const f = Math.max(0.3, Math.sqrt(s.count / s.startCount));
        sh.scale.set((s.halfW * 2 + 1) * f, (s.halfD * 2 + 1) * f, 1);
      }
      if (!visible) continue;
      const march = s.aggro && !s.engaged;
      for (let i = 0; i < s.units.length && n < ENEMY_CAPACITY; i++) {
        const u = s.units[i];
        if (!u.alive) continue;
        const ph = i * 1.7;
        const bob = march ? Math.abs(Math.sin(this.time * 10 + ph)) * 0.1 : 0;
        const lunge = s.engaged ? Math.max(0, Math.sin(this.time * 14 + ph)) * 0.25 : 0;
        v3.set(s.x + u.ox, bob, -(s.d + u.od) + lunge);
        qy.setFromAxisAngle(UP, Math.PI + (march ? swing * 0.08 : 0));
        sc.setScalar(1.05);
        m4.compose(v3, qy, sc);
        this.enemyMesh.setMatrixAt(n++, m4);
      }
    }
    this.enemyMesh.count = n;
    this.enemyMesh.instanceMatrix.needsUpdate = true;
  }

  private syncArrows(world: World) {
    const maxLife = ARROW_RANGE / ARROW_SPEED;
    let n = 0;
    for (const ar of world.arrows) {
      if (!ar.alive) continue;
      const f = 1 - ar.life / maxLife;
      const y = 0.9 + Math.sin(f * Math.PI) * 1.4;
      const pitch = Math.cos(f * Math.PI) * 0.35;
      v3.set(ar.x, y, -ar.d);
      qx.setFromAxisAngle(RIGHT, pitch);
      sc.setScalar(1);
      m4.compose(v3, qx, sc);
      this.arrowMesh.setMatrixAt(n++, m4);
    }
    this.arrowMesh.count = n;
    this.arrowMesh.instanceMatrix.needsUpdate = true;
  }

  private syncGates(world: World, dt: number) {
    const a = world.army;
    for (const gv of this.gates) {
      const g = gv.gate;
      gv.label.set(`${gateText(g)}|${gateIsGood(g) ? 1 : 0}`);
      const since = world.time - g.hitTime;
      let pulse = g.hitTime >= 0 && since < 0.12 ? 1 + (0.12 - since) * 0.6 : 1;
      if (g.hitTime !== gv.lastHit && g.hitTime >= 0) {
        gv.lastHit = g.hitTime;
        const x = g.x0 + 0.6 + Math.random() * (g.x1 - g.x0 - 1.2);
        this.particles.burst(x, 1.2 + Math.random() * 1.2, -g.d + 0.2, 0xfff1b0, 2, 2.5, 0.08, 0.35);
      }
      if (g.passed) {
        gv.fade = Math.max(0, gv.fade - dt * (g.chosen ? 2.2 : 3));
        gv.mat.opacity = gv.fade;
        if (g.chosen) pulse = 1 + (1 - gv.fade) * 0.3;
      }
      gv.panel.scale.set(pulse, pulse, 1);
      gv.group.visible = gv.fade > 0 && g.d - a.d < 120 && g.d - a.d > -10;
    }
  }

  private syncBarrels(world: World) {
    const a = world.army;
    for (const bv of this.barrels) {
      const b = bv.barrel;
      bv.group.visible = !b.broken && !b.gone && b.d - a.d < 120;
      if (!bv.group.visible) continue;
      const since = world.time - b.hitTime;
      const hit = b.hitTime >= 0 && since < 0.1;
      const s = hit ? 1.08 : 1;
      bv.body.scale.set(s, hit ? 0.94 : 1, s);
      bv.body.rotation.z = hit ? (Math.random() - 0.5) * 0.12 : 0;
      if (!b.small) bv.label.set(`${Math.ceil(b.hp)}|${rewardText(b.reward)}`);
    }
  }

  private syncBoss(world: World, dt: number) {
    const rig = this.boss;
    if (!rig) return;
    const b = world.boss;
    rig.root.position.set(b.x, 0, -b.d);
    this.bossShadow?.position.set(b.x, 0.03, -b.d);
    if (this.bossShadow) this.bossShadow.visible = b.state !== 'dead';
    const flash = world.time - b.hitTime < 0.06 ? 0.35 : 0;
    for (const m of rig.materials) m.emissive.setScalar(flash);

    if (b.state === 'dead') {
      if (this.bossDeadAge >= 0) this.bossDeadAge += dt;
      const f = Math.min(1, this.bossDeadAge / 0.9);
      rig.root.rotation.x = -f * Math.PI / 2;
      rig.root.position.y = -Math.max(0, this.bossDeadAge - 1) * 3;
      return;
    }
    rig.root.rotation.x = 0;
    if (b.state === 'walk') {
      const w = Math.sin(this.time * 5);
      rig.legL.rotation.x = w * 0.45;
      rig.legR.rotation.x = -w * 0.45;
      rig.armL.rotation.x = -w * 0.4;
      rig.armR.rotation.x = w * 0.3 - 0.3;
      rig.body.position.y = Math.abs(w) * 0.12;
    } else if (b.state === 'attack') {
      // wind up during the interval, slam at the smash moment
      const sinceSmash = world.time - b.smashTime;
      const windup = 1 - Math.min(1, Math.max(0, b.attackTimer) / 1.0);
      const slam = b.smashTime >= 0 && sinceSmash < 0.25 ? 1 - sinceSmash / 0.25 : 0;
      rig.armR.rotation.x = -2.6 * windup * (1 - slam) + slam * 0.6;
      rig.armL.rotation.x = -1.2 * windup * (1 - slam);
      rig.body.rotation.x = -0.15 * windup + slam * 0.3;
      rig.legL.rotation.x = rig.legR.rotation.x = 0;
    } else {
      rig.body.position.y = Math.sin(this.time * 2) * 0.05;
      rig.armL.rotation.x = rig.armR.rotation.x = Math.sin(this.time * 2) * 0.1;
    }
  }

  private updateRing(dt: number) {
    this.ringAge += dt;
    const f = this.ringAge / 0.5;
    this.ring.visible = f < 1;
    if (f < 1) {
      const s = 2 + f * 9;
      this.ring.scale.set(s, s, 1);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 1 - f;
    }
  }

  private updateCamera(world: World, dt: number) {
    const a = world.army;
    const bossFight = world.boss.state === 'walk' || world.boss.state === 'attack';
    const k = 1 - Math.exp(-dt * 6);
    this.camX += (a.x * 0.35 - this.camX) * k;
    this.camZ += (-a.d - this.camZ) * k;
    this.homeBlend += ((this.homeView ? 1 : 0) - this.homeBlend) * k;
    const height = (bossFight ? 14 : 12.5) - this.homeBlend * 3;
    const back = (bossFight ? 8.5 : 6.5) + this.homeBlend * 2;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sx = (Math.random() - 0.5) * this.shake * 0.6;
    const sy = (Math.random() - 0.5) * this.shake * 0.6;
    this.camera.position.set(this.camX + sx, height + sy, this.camZ + back);
    this.camera.lookAt(this.camX * 0.8, 0, this.camZ - (bossFight ? 13 : 12) + this.homeBlend * 7);
  }

  private syncOverlay(world: World, dt: number) {
    const a = world.army;
    const cam = this.camera;
    this.overlay.setArmy(cam, a.count > 0 ? v3.set(a.x, 1.9 + world.armyRadius * 0.15, -a.d) : null, a.count);
    for (const s of world.squads) {
      const show = !s.gone && s.count > 0 && s.d - a.d < 75;
      this.overlay.setSquad(cam, s.id, show ? v3.set(s.x, 1.6, -(s.d - s.halfD)) : null, s.count);
    }
    const b = world.boss;
    const showBoss = b.state !== 'dead' && b.d - a.d < 90;
    this.overlay.setBoss(cam, showBoss ? v3.set(b.x, 8.6, -b.d) : null, b.hp, b.maxHp);
    this.overlay.update(cam, dt);
  }
}
