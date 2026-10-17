import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Low-poly models assembled from primitives with baked vertex colors, so each crowd is one draw call. */

type Part = [THREE.BufferGeometry, number];

function colored(geo: THREE.BufferGeometry, color: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function merge(parts: Part[]) {
  const geo = mergeGeometries(parts.map(([g, c]) => colored(g, c)));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
};

export const PALETTE = {
  blue: 0x2f7bff,
  blueDark: 0x1d4fb8,
  blueLight: 0x6fb2ff,
  red: 0xe23b3b,
  redDark: 0x9e1f24,
  skin: 0xf2c49b,
  wood: 0x8a5a2b,
  woodDark: 0x5e3b1a,
  gold: 0xffc93c,
  steel: 0xb8c3cf,
  boot: 0x3b2a20,
};

/** Archer facing -z (towards the enemy). Height ~0.95. */
export function archerGeometry() {
  const p = PALETTE;
  return merge([
    [at(new THREE.BoxGeometry(0.1, 0.28, 0.12), -0.07, 0.14, 0), p.boot],
    [at(new THREE.BoxGeometry(0.1, 0.28, 0.12), 0.07, 0.14, 0), p.boot],
    [at(new THREE.CylinderGeometry(0.15, 0.2, 0.36, 7), 0, 0.45, 0), p.blue],
    [at(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 7), 0, 0.3, 0), p.blueDark],
    [at(new THREE.IcosahedronGeometry(0.14, 0), 0, 0.74, 0), p.skin],
    [at(new THREE.BoxGeometry(0.035, 0.05, 0.03), -0.05, 0.75, -0.125), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.035, 0.05, 0.03), 0.05, 0.75, -0.125), 0x1a1a2a],
    [at(new THREE.ConeGeometry(0.18, 0.26, 7), 0, 0.9, 0.01), p.blueDark],
    [at(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 7), 0, 0.8, 0), p.blueDark],
    [at(new THREE.TorusGeometry(0.26, 0.022, 3, 8, Math.PI), 0.2, 0.52, -0.08, 0, Math.PI / 2, Math.PI / 2), p.wood],
    [at(new THREE.BoxGeometry(0.1, 0.3, 0.08), -0.04, 0.5, 0.17, 0.2), p.woodDark],
  ]);
}

/** Swordsman with shield, facing +z (towards the player). */
export function enemyGeometry() {
  const p = PALETTE;
  return merge([
    [at(new THREE.BoxGeometry(0.11, 0.28, 0.12), -0.08, 0.14, 0), p.boot],
    [at(new THREE.BoxGeometry(0.11, 0.28, 0.12), 0.08, 0.14, 0), p.boot],
    [at(new THREE.CylinderGeometry(0.17, 0.22, 0.38, 7), 0, 0.46, 0), p.red],
    [at(new THREE.IcosahedronGeometry(0.15, 0), 0, 0.77, 0), p.skin],
    [at(new THREE.BoxGeometry(0.04, 0.05, 0.03), -0.055, 0.76, 0.135), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.04, 0.05, 0.03), 0.055, 0.76, 0.135), 0x1a1a2a],
    [at(new THREE.SphereGeometry(0.17, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.8, 0), p.redDark],
    [at(new THREE.BoxGeometry(0.04, 0.16, 0.04), 0, 1.0, 0), p.gold],
    [at(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), 0.03, 0.47, 0.22, Math.PI / 2), p.redDark],
    [at(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), 0.03, 0.47, 0.25, Math.PI / 2), p.gold],
    [at(new THREE.BoxGeometry(0.04, 0.42, 0.04), 0.24, 0.6, 0.06, 0.4), p.steel],
  ]);
}

export function kingGroup() {
  const p = PALETTE;
  const geo = merge([
    [at(new THREE.BoxGeometry(0.14, 0.34, 0.16), -0.1, 0.17, 0), p.boot],
    [at(new THREE.BoxGeometry(0.14, 0.34, 0.16), 0.1, 0.17, 0), p.boot],
    [at(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 8), 0, 0.58, 0), p.blueLight],
    [at(new THREE.BoxGeometry(0.62, 0.7, 0.05), 0, 0.55, 0.26, -0.12), 0x2747a6],
    [at(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 8), 0, 0.38, 0), p.gold],
    [at(new THREE.IcosahedronGeometry(0.2, 1), 0, 0.98, 0), p.skin],
    [at(new THREE.BoxGeometry(0.05, 0.07, 0.04), -0.07, 1.0, -0.18), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.05, 0.07, 0.04), 0.07, 1.0, -0.18), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.08, 0.025, 0.04), -0.07, 1.06, -0.185), 0x7a4a1a],
    [at(new THREE.BoxGeometry(0.08, 0.025, 0.04), 0.07, 1.06, -0.185), 0x7a4a1a],
    [at(new THREE.ConeGeometry(0.15, 0.24, 6), 0, 0.84, -0.1, Math.PI + 0.35), 0x9a5b22],
    [at(new THREE.CylinderGeometry(0.17, 0.15, 0.12, 8, 1, true), 0, 1.2, 0), p.gold],
    [at(new THREE.ConeGeometry(0.05, 0.12, 4), 0.13, 1.31, 0), p.gold],
    [at(new THREE.ConeGeometry(0.05, 0.12, 4), -0.13, 1.31, 0), p.gold],
    [at(new THREE.ConeGeometry(0.05, 0.12, 4), 0, 1.31, 0.13), p.gold],
    [at(new THREE.ConeGeometry(0.05, 0.12, 4), 0, 1.31, -0.13), p.gold],
    [at(new THREE.TorusGeometry(0.4, 0.035, 4, 10, Math.PI), 0.32, 0.68, -0.1, 0, Math.PI / 2, Math.PI / 2), p.gold],
  ]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.scale.setScalar(1.25);
  return mesh;
}

export interface BossRig {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  materials: THREE.MeshLambertMaterial[];
}

/** Big brute with a club. Built as a rig so the arms can swing. Faces +z. */
export const BOSS_COLORS = {
  river: { skin: 0xd99a6c, shirt: 0xd6452b, pants: 0x5a3a28 },
  meadow: { skin: 0x9bbf5a, shirt: 0x8a4b2a, pants: 0x4a3a2a },
  snow: { skin: 0xa9c8e8, shirt: 0x3f5f9a, pants: 0x2d3a55 },
  desert: { skin: 0xc98a5a, shirt: 0x7a3fa0, pants: 0x4a2a20 },
};

export function bossRig(colors = BOSS_COLORS.river): BossRig {
  const p = PALETTE;
  const mat = (c: number, emissive = 0) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive });
  const skin = mat(colors.skin);
  const shirt = mat(colors.shirt);
  const pants = mat(colors.pants);
  const hair = mat(0x2a1a14);
  const belt = mat(0x3a2418);
  const eye = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const wood = mat(p.wood);
  const materials = [skin, shirt, pants, hair, belt, wood];

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

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.05, 1.9, 8), shirt);
  torso.position.y = 2.45;
  const beltM = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 8), belt);
  beltM.position.y = 1.6;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), mat(p.gold));
  buckle.position.set(0, 1.6, 1.1);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), skin);
  head.position.y = 3.95;
  head.scale.set(1, 1.05, 0.95);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.76, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2.2), hair);
  hairM.position.set(0, 4.05, -0.05);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.15), hair);
  brow.position.set(0, 4.12, 0.62);
  brow.rotation.x = -0.2;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.05), eye);
  eyeL.position.set(-0.24, 3.98, 0.68);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.24;
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.1), belt);
  strap.position.set(0, 2.5, 1.12);
  strap.rotation.z = 0.6;
  body.add(torso, beltM, buckle, head, hairM, brow, eyeL, eyeR, strap);

  const mkArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 1.45, 3.15, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.65), skin);
    upper.position.y = -0.7;
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.75), shirt);
    sleeve.position.y = -0.15;
    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), skin);
    fist.position.y = -1.55;
    arm.add(upper, sleeve, fist);
    body.add(arm);
    return arm;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  const club = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.16, 2.6, 7), wood);
  club.position.set(0, -2.3, 0.9);
  club.rotation.x = Math.PI / 2.6;
  armR.add(club);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  return { root, body, armL, armR, legL, legR, materials };
}

export function arrowGeometry() {
  return merge([
    [at(new THREE.BoxGeometry(0.08, 0.08, 1.2), 0, 0, 0), 0xfff4d6],
    [at(new THREE.ConeGeometry(0.12, 0.3, 4), 0, 0, -0.74, -Math.PI / 2), 0xe8f0ff],
    [at(new THREE.BoxGeometry(0.26, 0.03, 0.26), 0, 0, 0.5, 0, Math.PI / 4), 0xff6a3d],
    [at(new THREE.BoxGeometry(0.03, 0.26, 0.26), 0, 0, 0.5, Math.PI / 4), 0xff6a3d],
  ]);
}

export function barrelGeometry() {
  const p = PALETTE;
  return merge([
    [new THREE.CylinderGeometry(0.85, 0.85, 1.5, 12), p.wood],
    [at(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 12), 0, 0.5, 0), 0x6b7682],
    [at(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 12), 0, -0.5, 0), 0x6b7682],
    [at(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 12), 0, 0.76, 0), p.woodDark],
  ]);
}

export function treeGeometry(kind: 'pine' | 'round' | 'cactus' | 'rock') {
  if (kind === 'pine') {
    return merge([
      [at(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 5), 0, 0.4, 0), 0x6b4423],
      [at(new THREE.ConeGeometry(1.0, 1.6, 6), 0, 1.4, 0), 0x2f7d4a],
      [at(new THREE.ConeGeometry(0.75, 1.3, 6), 0, 2.2, 0), 0x3a9157],
    ]);
  }
  if (kind === 'round') {
    return merge([
      [at(new THREE.CylinderGeometry(0.15, 0.22, 1.0, 5), 0, 0.5, 0), 0x6b4423],
      [at(new THREE.IcosahedronGeometry(0.95, 0), 0, 1.7, 0), 0x58a83c],
      [at(new THREE.IcosahedronGeometry(0.6, 0), 0.5, 1.35, 0.3), 0x6cbf47],
    ]);
  }
  if (kind === 'cactus') {
    return merge([
      [at(new THREE.CylinderGeometry(0.28, 0.3, 2.0, 7), 0, 1.0, 0), 0x4f9a4a],
      [at(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 6), 0.45, 1.2, 0, 0, 0, Math.PI / 2), 0x4f9a4a],
      [at(new THREE.CylinderGeometry(0.17, 0.17, 0.7, 6), 0.75, 1.55, 0), 0x4f9a4a],
    ]);
  }
  return merge([
    [at(new THREE.DodecahedronGeometry(0.8, 0), 0, 0.4, 0), 0x9a8f86],
    [at(new THREE.DodecahedronGeometry(0.5, 0), 0.7, 0.25, 0.2), 0x857a72],
  ]);
}

/** Spiked log that spans `width` along x, centred on the origin. Rotate around x to roll it. */
export function spikeRollerGeometry(width: number) {
  const parts: Part[] = [[at(new THREE.CylinderGeometry(0.55, 0.55, width, 10), 0, 0, 0, 0, 0, Math.PI / 2), PALETTE.woodDark]];
  for (const end of [-1, 1]) parts.push([at(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 10), end * (width / 2 - 0.09), 0, 0, 0, 0, Math.PI / 2), 0x6b7682]);
  const rows = Math.max(3, Math.round(width / 0.7));
  for (let i = 0; i < rows; i++) {
    const x = -width / 2 + 0.35 + (i * (width - 0.7)) / (rows - 1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + (i % 2) * (Math.PI / 6);
      const spike = new THREE.ConeGeometry(0.14, 0.5, 5);
      spike.translate(0, 0.78, 0);
      spike.rotateX(a);
      spike.translate(x, 0, 0);
      parts.push([spike, 0xd9e3ee]);
    }
  }
  return merge(parts);
}
