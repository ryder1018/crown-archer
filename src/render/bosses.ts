import * as THREE from 'three';
import type { BossKind } from '../sim/types';
import { PALETTE } from './models';

export interface BossRig {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  /** materials that flash when hit and glow when enraged */
  materials: THREE.MeshLambertMaterial[];
  /** colour of thrown projectiles, shield and summon effects */
  accent: number;
}

type Head = 'hair' | 'tusks' | 'viking' | 'headdress' | 'rocky' | 'skull';
type Weapon = 'club' | 'log' | 'ice' | 'sword' | 'rock' | 'staff';

interface Style {
  skin: number; shirt: number; pants: number; hair: number; belt: number; eye: number;
  head: Head; weapon: Weapon; accent: number;
  /** lava cracks / glowing runes on the body */
  glow?: number;
}

export const BOSS_STYLES: Record<Exclude<BossKind, 'chest'>, Style> = {
  giant: { skin: 0xd99a6c, shirt: 0xd6452b, pants: 0x5a3a28, hair: 0x2a1a14, belt: 0x3a2418, eye: 0xff2a2a, head: 'hair', weapon: 'club', accent: 0xc9b48f },
  troll: { skin: 0x7fae4f, shirt: 0x7a4a2a, pants: 0x4a3a2a, hair: 0x3a2a1a, belt: 0x2e1d10, eye: 0xffd23a, head: 'tusks', weapon: 'log', accent: 0x8a6a4a },
  frost: { skin: 0x9cc7ea, shirt: 0x3f5f9a, pants: 0x2d3a55, hair: 0xf4f8ff, belt: 0x22304a, eye: 0x7fe8ff, head: 'viking', weapon: 'ice', accent: 0x9fe6ff },
  warlord: { skin: 0xc98a5a, shirt: 0x6a2f8f, pants: 0x3a2050, hair: 0x1a1010, belt: PALETTE.gold, eye: 0xff4a2a, head: 'headdress', weapon: 'sword', accent: 0xb05cff },
  golem: { skin: 0x4a403e, shirt: 0x3a3230, pants: 0x2e2826, hair: 0x2a2220, belt: 0x2a2220, eye: 0xffa22a, head: 'rocky', weapon: 'rock', accent: 0xff7a1a, glow: 0xff6a10 },
  lich: { skin: 0xe8e2d0, shirt: 0x3a2456, pants: 0x241640, hair: 0x1a1030, belt: 0x6a4a9a, eye: 0x6aff8a, head: 'skull', weapon: 'staff', accent: 0x6aff8a, glow: 0x6aff8a },
};

const mat = (c: number, emissive = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive });

/** Big humanoid boss built as a rig so the arms and legs can animate. Faces +z. */
export function bossRig(kind: Exclude<BossKind, 'chest'>): BossRig {
  const st = BOSS_STYLES[kind];
  const skin = mat(st.skin);
  const shirt = mat(st.shirt);
  const pants = mat(st.pants);
  const hair = mat(st.hair);
  const belt = mat(st.belt);
  const eye = new THREE.MeshBasicMaterial({ color: st.eye });
  const glow = st.glow ? new THREE.MeshBasicMaterial({ color: st.glow }) : null;
  const materials = [skin, shirt, pants, hair, belt];

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legGeo = new THREE.BoxGeometry(0.75, 1.4, 0.8);
  legGeo.translate(0, -0.7, 0);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.55, 1.5, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.55, 1.5, 0);
  root.add(legL, legR);

  const skinny = kind === 'lich';
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(skinny ? 0.9 : 1.25, skinny ? 1.15 : 1.05, 1.9, 8), shirt);
  torso.position.y = 2.45;
  const beltM = new THREE.Mesh(new THREE.CylinderGeometry(skinny ? 1.05 : 1.1, skinny ? 1.05 : 1.1, 0.3, 8), belt);
  beltM.position.y = 1.6;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), skin);
  head.position.y = 3.95;
  head.scale.set(1, 1.05, 0.95);
  const eyeGeo = new THREE.BoxGeometry(0.16, 0.08, 0.05);
  const eyeL = new THREE.Mesh(eyeGeo, eye);
  eyeL.position.set(-0.24, 3.98, 0.68);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.24;
  body.add(torso, beltM, head, eyeL, eyeR);
  if (kind === 'lich') {
    // a robe flaring down over the legs
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 1.6, 8, 1, true), shirt);
    robe.position.y = 0.85;
    root.add(robe);
  }

  addHead(st, body, { skin, hair, eye });
  if (glow) addGlow(kind, body, glow);
  if (st.head !== 'skull' && st.head !== 'rocky') {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.1), belt);
    strap.position.set(0, 2.5, 1.12);
    strap.rotation.z = 0.6;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), mat(PALETTE.gold));
    buckle.position.set(0, 1.6, 1.1);
    body.add(strap, buckle);
  }

  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * (skinny ? 1.15 : 1.45), 3.15, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(skinny ? 0.4 : 0.6, 1.5, skinny ? 0.45 : 0.65), skin);
    upper.position.y = -0.7;
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.75), shirt);
    sleeve.position.y = -0.15;
    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(kind === 'golem' ? 0.62 : 0.42, 0), skin);
    fist.position.y = -1.55;
    arm.add(upper, sleeve, fist);
    body.add(arm);
    return arm;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  addWeapon(st, armR, armL);

  return { root, body, armL, armR, legL, legR, materials, accent: st.accent };
}

function addHead(st: Style, body: THREE.Group, m: { skin: THREE.Material; hair: THREE.Material; eye: THREE.Material }) {
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    body.add(mesh);
    return mesh;
  };
  const brow = () => add(new THREE.BoxGeometry(0.9, 0.12, 0.15), m.hair, 0, 4.12, 0.62, -0.2);
  switch (st.head) {
    case 'hair':
      add(new THREE.SphereGeometry(0.76, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2.2), m.hair, 0, 4.05, -0.05);
      brow();
      break;
    case 'tusks': {
      const tusk = new THREE.ConeGeometry(0.1, 0.45, 5);
      add(tusk, mat(0xf4ecd8), -0.28, 3.72, 0.62, 0.3);
      add(tusk, mat(0xf4ecd8), 0.28, 3.72, 0.62, 0.3);
      const ear = new THREE.ConeGeometry(0.2, 0.6, 4);
      add(ear, m.skin, -0.8, 4.05, 0, 0, 0, Math.PI / 2.2);
      add(ear, m.skin, 0.8, 4.05, 0, 0, 0, -Math.PI / 2.2);
      add(new THREE.BoxGeometry(0.2, 0.5, 0.6), m.hair, 0, 4.55, -0.1);
      brow();
      break;
    }
    case 'viking': {
      add(new THREE.SphereGeometry(0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9aa6b4), 0, 4.08, 0);
      add(new THREE.CylinderGeometry(0.82, 0.82, 0.14, 10), mat(PALETTE.gold), 0, 4.08, 0);
      const horn = new THREE.ConeGeometry(0.16, 0.9, 6);
      add(horn, mat(0xf4ecd8), -0.85, 4.45, 0, 0, 0, 0.7);
      add(horn, mat(0xf4ecd8), 0.85, 4.45, 0, 0, 0, -0.7);
      add(new THREE.ConeGeometry(0.55, 1.0, 6), m.hair, 0, 3.35, 0.45, Math.PI);
      break;
    }
    case 'headdress': {
      const cloth = mat(0x2a5bd6);
      add(new THREE.CylinderGeometry(0.82, 0.95, 0.9, 8, 1, false, Math.PI * 0.15, Math.PI * 1.7), cloth, 0, 4.15, -0.05);
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.86 - i * 0.02, 0.05, 4, 12), mat(PALETTE.gold), 0, 3.85 + i * 0.25, -0.05, Math.PI / 2);
      add(new THREE.BoxGeometry(0.5, 1.4, 0.1), cloth, -0.75, 3.4, -0.1, 0, 0, 0.15);
      add(new THREE.BoxGeometry(0.5, 1.4, 0.1), cloth, 0.75, 3.4, -0.1, 0, 0, -0.15);
      add(new THREE.ConeGeometry(0.14, 0.4, 5), mat(PALETTE.gold), 0, 4.75, 0.55, 0.4);
      brow();
      break;
    }
    case 'rocky': {
      const rock = mat(0x5a504c);
      add(new THREE.DodecahedronGeometry(0.55, 0), rock, -1.25, 3.6, 0);
      add(new THREE.DodecahedronGeometry(0.6, 0), rock, 1.25, 3.65, 0);
      add(new THREE.DodecahedronGeometry(0.35, 0), rock, 0, 4.6, -0.1);
      break;
    }
    case 'skull': {
      const dark = new THREE.MeshBasicMaterial({ color: 0x120a18 });
      add(new THREE.BoxGeometry(0.26, 0.2, 0.08), dark, -0.24, 3.98, 0.66);
      add(new THREE.BoxGeometry(0.26, 0.2, 0.08), dark, 0.24, 3.98, 0.66);
      add(new THREE.BoxGeometry(0.5, 0.12, 0.08), dark, 0, 3.62, 0.62);
      const crown = mat(0x2a1a3a);
      add(new THREE.CylinderGeometry(0.62, 0.66, 0.3, 8, 1, true), crown, 0, 4.55, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.ConeGeometry(0.1, 0.45, 4), crown, Math.sin(a) * 0.6, 4.88, Math.cos(a) * 0.6);
      }
      add(new THREE.SphereGeometry(0.85, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a2456), 0, 3.6, -0.2, -0.3);
      break;
    }
  }
}

/** Glowing cracks (golem) or runes (lich) on the torso. */
function addGlow(kind: BossKind, body: THREE.Group, glow: THREE.Material) {
  const marks = kind === 'golem'
    ? [[-0.5, 2.8, 1.05, 0.5], [0.4, 2.2, 1.05, -0.7], [0.1, 3.0, 1.1, 0.2], [-0.2, 1.9, 1.0, 1.1]]
    : [[0, 2.7, 0.92, 0], [-0.35, 2.3, 0.88, 0.4], [0.35, 2.3, 0.88, -0.4]];
  for (const [x, y, z, rz] of marks) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.05), glow);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    body.add(m);
  }
}

function addWeapon(st: Style, armR: THREE.Group, armL: THREE.Group) {
  const wood = mat(PALETTE.wood);
  const add = (parent: THREE.Group, geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    parent.add(mesh);
    return mesh;
  };
  switch (st.weapon) {
    case 'club':
      add(armR, new THREE.CylinderGeometry(0.38, 0.16, 2.6, 7), wood, 0, -2.3, 0.9, Math.PI / 2.6);
      break;
    case 'log': {
      const log = add(armR, new THREE.CylinderGeometry(0.5, 0.35, 3.4, 7), mat(0x6b4423), 0, -2.6, 1.1, Math.PI / 2.6);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat(0x4f8f3a));
      leaves.position.set(0.4, 1.5, 0);
      log.add(leaves);
      break;
    }
    case 'ice': {
      add(armR, new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), mat(0x8a96a8), 0, -2.0, 0.7, Math.PI / 2.6);
      const crystal = new THREE.MeshLambertMaterial({ color: 0xbff4ff, emissive: 0x3aa6d0, flatShading: true });
      add(armR, new THREE.OctahedronGeometry(0.75, 0), crystal, 0, -2.75, 1.65, 0.4);
      break;
    }
    case 'sword': {
      const blade = add(armR, new THREE.BoxGeometry(0.16, 3.0, 0.5), mat(0xd9e3ee), 0, -2.6, 1.2, Math.PI / 2.6);
      blade.scale.z = 1.2;
      add(armR, new THREE.BoxGeometry(0.9, 0.18, 0.3), mat(PALETTE.gold), 0, -1.85, 0.35, Math.PI / 2.6);
      add(armL, new THREE.CylinderGeometry(0.9, 0.9, 0.15, 10), mat(PALETTE.gold), 0, -1.4, 0.5, Math.PI / 2);
      break;
    }
    case 'rock':
      add(armR, new THREE.DodecahedronGeometry(0.85, 0), mat(0x5a504c), 0, -1.9, 0.3);
      add(armL, new THREE.DodecahedronGeometry(0.75, 0), mat(0x5a504c), 0, -1.9, 0.3);
      break;
    case 'staff': {
      add(armR, new THREE.CylinderGeometry(0.09, 0.09, 4.2, 6), mat(0x3a2a20), 0, -1.6, 0.4);
      add(armR, new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: st.accent }), 0, 0.6, 0.4);
      break;
    }
  }
}

export interface ChestRig {
  root: THREE.Group;
  lid: THREE.Group;
  materials: THREE.MeshLambertMaterial[];
}

/** Treasure chest that ends bonus levels. Faces +z, about 3.6 units wide. */
export function chestRig(): ChestRig {
  const wood = mat(0x8a4f22);
  const trim = mat(PALETTE.gold);
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 2.4), wood);
  base.position.y = 0.9;
  root.add(base);
  for (const x of [-1.5, 0, 1.5]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.86, 2.46), trim);
    band.position.set(x, 0.9, 0);
    root.add(band);
  }
  const lid = new THREE.Group();
  lid.position.set(0, 1.8, -1.2);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.6, 12, 1, false, 0, Math.PI), wood);
  top.rotation.z = Math.PI / 2;
  top.rotation.y = Math.PI / 2;
  top.position.z = 1.2;
  lid.add(top);
  for (const x of [-1.5, 0, 1.5]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.24, 0.22, 12, 1, false, 0, Math.PI), trim);
    band.rotation.z = Math.PI / 2;
    band.rotation.y = Math.PI / 2;
    band.position.set(x, 0, 1.2);
    lid.add(band);
  }
  root.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.2), trim);
  lock.position.set(0, 1.6, 1.25);
  root.add(lock);
  const gold = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd34a }));
  gold.position.y = 1.5;
  gold.scale.set(1.1, 0.4, 0.7);
  root.add(gold);
  return { root, lid, materials: [wood, trim] };
}
