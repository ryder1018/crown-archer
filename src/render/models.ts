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

/** Archer facing -z (towards the enemy). Height ~0.95. `colors` is the army skin: tunic, trim / hat. */
export function archerGeometry(colors: [number, number] = [PALETTE.blue, PALETTE.blueDark]) {
  const p = PALETTE;
  const [tunic, trim] = colors;
  return merge([
    [at(new THREE.BoxGeometry(0.1, 0.28, 0.12), -0.07, 0.14, 0), p.boot],
    [at(new THREE.BoxGeometry(0.1, 0.28, 0.12), 0.07, 0.14, 0), p.boot],
    [at(new THREE.CylinderGeometry(0.15, 0.2, 0.36, 7), 0, 0.45, 0), tunic],
    [at(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 7), 0, 0.3, 0), trim],
    [at(new THREE.IcosahedronGeometry(0.14, 0), 0, 0.74, 0), p.skin],
    [at(new THREE.BoxGeometry(0.035, 0.05, 0.03), -0.05, 0.75, -0.125), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.035, 0.05, 0.03), 0.05, 0.75, -0.125), 0x1a1a2a],
    [at(new THREE.ConeGeometry(0.18, 0.26, 7), 0, 0.9, 0.01), trim],
    [at(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 7), 0, 0.8, 0), trim],
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

/** Enemy archer: red tunic, hood and a bow, facing +z. */
export function enemyArcherGeometry() {
  const p = PALETTE;
  return merge([
    [at(new THREE.BoxGeometry(0.11, 0.28, 0.12), -0.08, 0.14, 0), p.boot],
    [at(new THREE.BoxGeometry(0.11, 0.28, 0.12), 0.08, 0.14, 0), p.boot],
    [at(new THREE.CylinderGeometry(0.16, 0.21, 0.38, 7), 0, 0.46, 0), 0xb8322f],
    [at(new THREE.IcosahedronGeometry(0.14, 0), 0, 0.76, 0), p.skin],
    [at(new THREE.BoxGeometry(0.04, 0.05, 0.03), -0.05, 0.75, 0.13), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.04, 0.05, 0.03), 0.05, 0.75, 0.13), 0x1a1a2a],
    [at(new THREE.ConeGeometry(0.2, 0.36, 7), 0, 0.9, -0.03), 0x6e1c1c],
    [at(new THREE.TorusGeometry(0.26, 0.022, 3, 8, Math.PI), -0.2, 0.52, 0.08, 0, Math.PI / 2, Math.PI / 2), p.wood],
    [at(new THREE.BoxGeometry(0.1, 0.3, 0.08), 0.04, 0.5, -0.17, -0.2), p.woodDark],
  ]);
}

/** Heavy infantry in steel plate with a tower shield. */
export function armoredGeometry() {
  const p = PALETTE;
  const steel = 0x8d99a8;
  const steelDark = 0x5d6878;
  return merge([
    [at(new THREE.BoxGeometry(0.13, 0.3, 0.14), -0.09, 0.15, 0), steelDark],
    [at(new THREE.BoxGeometry(0.13, 0.3, 0.14), 0.09, 0.15, 0), steelDark],
    [at(new THREE.CylinderGeometry(0.2, 0.25, 0.42, 7), 0, 0.5, 0), steel],
    [at(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 7), 0, 0.36, 0), p.red],
    [at(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 7), 0, 0.84, 0), steel],
    [at(new THREE.BoxGeometry(0.2, 0.04, 0.03), 0, 0.84, 0.17), 0x111111],
    [at(new THREE.BoxGeometry(0.05, 0.22, 0.3), 0, 1.06, -0.02), p.red],
    [at(new THREE.BoxGeometry(0.42, 0.56, 0.06), 0.03, 0.5, 0.26), p.redDark],
    [at(new THREE.BoxGeometry(0.1, 0.4, 0.07), 0.03, 0.52, 0.28), p.gold],
  ]);
}

/** Skeleton warrior summoned by the lich. */
export function skeletonGeometry() {
  const bone = 0xe8e2d0;
  const dark = 0x2a1a3a;
  return merge([
    [at(new THREE.BoxGeometry(0.06, 0.3, 0.06), -0.07, 0.15, 0), bone],
    [at(new THREE.BoxGeometry(0.06, 0.3, 0.06), 0.07, 0.15, 0), bone],
    [at(new THREE.BoxGeometry(0.2, 0.06, 0.1), 0, 0.32, 0), bone],
    [at(new THREE.BoxGeometry(0.05, 0.3, 0.05), 0, 0.48, 0), bone],
    [at(new THREE.BoxGeometry(0.26, 0.04, 0.12), 0, 0.5, 0), bone],
    [at(new THREE.BoxGeometry(0.24, 0.04, 0.12), 0, 0.58, 0), bone],
    [at(new THREE.IcosahedronGeometry(0.15, 0), 0, 0.77, 0), bone],
    [at(new THREE.BoxGeometry(0.05, 0.05, 0.03), -0.055, 0.78, 0.13), 0x6aff8a],
    [at(new THREE.BoxGeometry(0.05, 0.05, 0.03), 0.055, 0.78, 0.13), 0x6aff8a],
    [at(new THREE.BoxGeometry(0.04, 0.42, 0.04), 0.2, 0.55, 0.06, 0.4), 0x8a96a8],
    [at(new THREE.BoxGeometry(0.22, 0.32, 0.04), -0.08, 0.6, 0.12, 0.2), dark],
  ]);
}

/** Small green goblin with a dagger; the swamp witch's minions. Faces +z. */
export function goblinGeometry() {
  const green = 0x7fb04a;
  const rag = 0x6a4a2a;
  return merge([
    [at(new THREE.BoxGeometry(0.08, 0.2, 0.09), -0.06, 0.1, 0), 0x3a2a1a],
    [at(new THREE.BoxGeometry(0.08, 0.2, 0.09), 0.06, 0.1, 0), 0x3a2a1a],
    [at(new THREE.CylinderGeometry(0.13, 0.17, 0.28, 6), 0, 0.33, 0), rag],
    [at(new THREE.IcosahedronGeometry(0.16, 0), 0, 0.6, 0.02), green],
    [at(new THREE.ConeGeometry(0.06, 0.26, 4), -0.2, 0.64, 0, 0, 0, Math.PI / 2.3), green],
    [at(new THREE.ConeGeometry(0.06, 0.26, 4), 0.2, 0.64, 0, 0, 0, -Math.PI / 2.3), green],
    [at(new THREE.BoxGeometry(0.05, 0.05, 0.03), -0.06, 0.63, 0.15), 0xffe040],
    [at(new THREE.BoxGeometry(0.05, 0.05, 0.03), 0.06, 0.63, 0.15), 0xffe040],
    [at(new THREE.ConeGeometry(0.04, 0.12, 4), 0, 0.56, 0.17, Math.PI / 2), 0x5f8a36],
    [at(new THREE.BoxGeometry(0.03, 0.26, 0.03), 0.18, 0.38, 0.08, 0.5), PALETTE.steel],
  ]);
}

/** Lancer on horseback; about 1.6 long along z, facing +z. */
export function cavalryGeometry() {
  const p = PALETTE;
  const horse = 0x6b4a32;
  const horseDark = 0x3e2a1c;
  const parts: Part[] = [
    [at(new THREE.BoxGeometry(0.42, 0.42, 1.0), 0, 0.62, 0), horse],
    [at(new THREE.BoxGeometry(0.26, 0.5, 0.3), 0, 0.92, 0.48, -0.5), horse],
    [at(new THREE.BoxGeometry(0.22, 0.24, 0.42), 0, 1.12, 0.72), horse],
    [at(new THREE.BoxGeometry(0.06, 0.3, 0.3), 0, 1.0, 0.32, -0.5), horseDark],
    [at(new THREE.BoxGeometry(0.08, 0.32, 0.08), 0, 0.62, -0.55, 0.6), horseDark],
    [at(new THREE.BoxGeometry(0.46, 0.08, 0.5), 0, 0.86, -0.02), p.red],
    // rider
    [at(new THREE.CylinderGeometry(0.15, 0.19, 0.34, 7), 0, 1.08, -0.05), p.red],
    [at(new THREE.IcosahedronGeometry(0.13, 0), 0, 1.36, -0.05), p.skin],
    [at(new THREE.SphereGeometry(0.15, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.4, -0.05), p.redDark],
    [at(new THREE.BoxGeometry(0.04, 0.04, 1.2), 0.2, 1.1, 0.35), 0x8a96a8],
    [at(new THREE.ConeGeometry(0.05, 0.16, 4), 0.2, 1.1, 0.98, Math.PI / 2), p.steel],
  ];
  for (const [x, z] of [[-0.14, 0.38], [0.14, 0.38], [-0.14, -0.38], [0.14, -0.38]]) {
    parts.push([at(new THREE.BoxGeometry(0.1, 0.44, 0.1), x, 0.22, z), horseDark]);
  }
  return merge(parts);
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

/** Armoured knight hero with sword and kite shield, facing -z. */
export function knightGeometry() {
  const p = PALETTE;
  const steel = 0xc9d3de;
  const dark = 0x7d8a99;
  return merge([
    [at(new THREE.BoxGeometry(0.15, 0.34, 0.17), -0.1, 0.17, 0), dark],
    [at(new THREE.BoxGeometry(0.15, 0.34, 0.17), 0.1, 0.17, 0), dark],
    [at(new THREE.CylinderGeometry(0.24, 0.29, 0.52, 8), 0, 0.6, 0), steel],
    [at(new THREE.BoxGeometry(0.3, 0.46, 0.04), 0, 0.58, -0.27), 0x2f7bff],
    [at(new THREE.BoxGeometry(0.06, 0.3, 0.05), 0, 0.6, -0.29), p.gold],
    [at(new THREE.BoxGeometry(0.22, 0.06, 0.05), 0, 0.66, -0.29), p.gold],
    [at(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 8), 0, 0.38, 0), dark],
    [at(new THREE.CylinderGeometry(0.2, 0.21, 0.3, 8), 0, 1.0, 0), steel],
    [at(new THREE.SphereGeometry(0.21, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.14, 0), steel],
    [at(new THREE.BoxGeometry(0.26, 0.04, 0.03), 0, 1.02, -0.205), 0x111111],
    [at(new THREE.BoxGeometry(0.05, 0.24, 0.36), 0, 1.38, 0.04), 0xe23b3b],
    [at(new THREE.BoxGeometry(0.05, 0.62, 0.05), 0.34, 0.78, -0.12, -0.25), 0xe8f0ff],
    [at(new THREE.BoxGeometry(0.2, 0.05, 0.06), 0.34, 0.5, -0.05, -0.25), p.gold],
    [at(new THREE.BoxGeometry(0.06, 0.48, 0.38), -0.33, 0.6, -0.08), 0x2f7bff],
    [at(new THREE.BoxGeometry(0.07, 0.36, 0.06), -0.37, 0.62, -0.08), p.gold],
    [at(new THREE.BoxGeometry(0.07, 0.06, 0.26), -0.37, 0.68, -0.08), p.gold],
  ]);
}

/** Elven ranger with a hood and a longbow, facing -z. */
export function rangerGeometry() {
  const p = PALETTE;
  const cloak = 0x2f8f4a;
  const dark = 0x1d5a2e;
  return merge([
    [at(new THREE.BoxGeometry(0.12, 0.34, 0.14), -0.09, 0.17, 0), 0x4a3424],
    [at(new THREE.BoxGeometry(0.12, 0.34, 0.14), 0.09, 0.17, 0), 0x4a3424],
    [at(new THREE.CylinderGeometry(0.19, 0.27, 0.56, 8), 0, 0.6, 0), cloak],
    [at(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8), 0, 0.42, 0), 0x8a5a2b],
    [at(new THREE.IcosahedronGeometry(0.18, 1), 0, 1.0, 0), p.skin],
    [at(new THREE.BoxGeometry(0.045, 0.06, 0.04), -0.06, 1.01, -0.165), 0x1a5a2a],
    [at(new THREE.BoxGeometry(0.045, 0.06, 0.04), 0.06, 1.01, -0.165), 0x1a5a2a],
    [at(new THREE.ConeGeometry(0.04, 0.22, 4), -0.2, 1.06, 0, 0, 0, Math.PI / 2.6), p.skin],
    [at(new THREE.ConeGeometry(0.04, 0.22, 4), 0.2, 1.06, 0, 0, 0, -Math.PI / 2.6), p.skin],
    [at(new THREE.ConeGeometry(0.24, 0.42, 8, 1, true), 0, 1.16, 0.03), dark],
    [at(new THREE.BoxGeometry(0.5, 0.6, 0.04), 0, 0.62, 0.24, 0.12), dark],
    [at(new THREE.TorusGeometry(0.55, 0.03, 4, 12, Math.PI), 0.33, 0.72, -0.1, 0, Math.PI / 2, Math.PI / 2), 0xe0b060],
    [at(new THREE.BoxGeometry(0.012, 1.08, 0.012), 0.33, 0.72, -0.1), 0xffffff],
    [at(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 6), -0.12, 0.74, 0.22, 0.35), 0x6b4423],
  ]);
}

/** Archmage in a starry robe with a glowing staff, facing -z. */
export function mageGeometry() {
  const p = PALETTE;
  const robe = 0x6a3ad0;
  const deep = 0x3e1f8a;
  return merge([
    [at(new THREE.CylinderGeometry(0.2, 0.36, 0.86, 8), 0, 0.43, 0), robe],
    [at(new THREE.CylinderGeometry(0.37, 0.37, 0.06, 8), 0, 0.05, 0), deep],
    [at(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 8), 0, 0.66, 0), p.gold],
    [at(new THREE.IcosahedronGeometry(0.18, 1), 0, 1.0, 0), p.skin],
    [at(new THREE.BoxGeometry(0.045, 0.06, 0.04), -0.06, 1.02, -0.165), 0x1a1a2a],
    [at(new THREE.BoxGeometry(0.045, 0.06, 0.04), 0.06, 1.02, -0.165), 0x1a1a2a],
    [at(new THREE.ConeGeometry(0.17, 0.4, 6), 0, 0.82, -0.1, Math.PI + 0.3), 0xf2f2f2],
    [at(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 10), 0, 1.15, 0), deep],
    [at(new THREE.ConeGeometry(0.2, 0.6, 8), 0, 1.45, 0.04, -0.15), robe],
    [at(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 8), 0, 1.2, 0), p.gold],
    [at(new THREE.OctahedronGeometry(0.06, 0), 0.1, 0.5, -0.36), p.gold],
    [at(new THREE.OctahedronGeometry(0.05, 0), -0.12, 0.3, -0.33), p.gold],
    [at(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), 0.36, 0.75, -0.08), 0x6b4423],
    [at(new THREE.IcosahedronGeometry(0.13, 1), 0.36, 1.55, -0.08), 0x7fe8ff],
  ]);
}

/** Valkyrie with a winged helm, spear and round shield, facing -z. */
export function valkyrieGeometry() {
  const p = PALETTE;
  const silver = 0xd9e3ee;
  const cape = 0x2a5bd6;
  return merge([
    [at(new THREE.BoxGeometry(0.13, 0.34, 0.15), -0.09, 0.17, 0), 0x6a7a8a],
    [at(new THREE.BoxGeometry(0.13, 0.34, 0.15), 0.09, 0.17, 0), 0x6a7a8a],
    [at(new THREE.CylinderGeometry(0.2, 0.3, 0.5, 8), 0, 0.58, 0), silver],
    [at(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 8), 0, 0.36, 0), p.gold],
    [at(new THREE.BoxGeometry(0.56, 0.72, 0.04), 0, 0.55, 0.25, -0.12), cape],
    [at(new THREE.IcosahedronGeometry(0.18, 1), 0, 0.98, 0), p.skin],
    [at(new THREE.BoxGeometry(0.045, 0.06, 0.04), -0.06, 0.99, -0.165), 0x1a3a8a],
    [at(new THREE.BoxGeometry(0.045, 0.06, 0.04), 0.06, 0.99, -0.165), 0x1a3a8a],
    [at(new THREE.BoxGeometry(0.4, 0.5, 0.1), 0, 0.82, 0.14), 0xffd76a],
    [at(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.06, 0), silver],
    [at(new THREE.BoxGeometry(0.04, 0.24, 0.3), -0.2, 1.18, 0.05, 0, 0, 0.5), 0xffffff],
    [at(new THREE.BoxGeometry(0.04, 0.24, 0.3), 0.2, 1.18, 0.05, 0, 0, -0.5), 0xffffff],
    [at(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), 0.34, 0.85, -0.05), 0x8a5a2b],
    [at(new THREE.ConeGeometry(0.07, 0.26, 4), 0.34, 1.82, -0.05), silver],
    [at(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), -0.33, 0.6, -0.05, 0, 0, Math.PI / 2), cape],
    [at(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), -0.37, 0.6, -0.05, 0, 0, Math.PI / 2), p.gold],
  ]);
}

/** Ninja in black with a red scarf and a katana on the back, facing -z. */
export function ninjaGeometry() {
  const dark = 0x23232e;
  const red = 0xd0262e;
  return merge([
    [at(new THREE.BoxGeometry(0.12, 0.34, 0.14), -0.09, 0.17, 0), dark],
    [at(new THREE.BoxGeometry(0.12, 0.34, 0.14), 0.09, 0.17, 0), dark],
    [at(new THREE.CylinderGeometry(0.18, 0.24, 0.5, 8), 0, 0.58, 0), dark],
    [at(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 8), 0, 0.4, 0), red],
    [at(new THREE.IcosahedronGeometry(0.18, 1), 0, 0.97, 0), dark],
    [at(new THREE.BoxGeometry(0.3, 0.07, 0.04), 0, 0.99, -0.17), PALETTE.skin],
    [at(new THREE.BoxGeometry(0.05, 0.04, 0.03), -0.06, 0.99, -0.19), 0x111111],
    [at(new THREE.BoxGeometry(0.05, 0.04, 0.03), 0.06, 0.99, -0.19), 0x111111],
    [at(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 8), 0, 1.06, 0), red],
    [at(new THREE.BoxGeometry(0.06, 0.04, 0.45), 0.08, 1.04, 0.32, 0.4), red],
    [at(new THREE.BoxGeometry(0.06, 0.04, 0.38), -0.05, 1.0, 0.3, 0.6), red],
    [at(new THREE.BoxGeometry(0.035, 0.85, 0.06), 0, 0.72, 0.2, 0, 0, 0.7), 0xd9e3ee],
    [at(new THREE.BoxGeometry(0.06, 0.24, 0.07), -0.26, 1.08, 0.2, 0, 0, 0.7), 0x2a1a10],
    [at(new THREE.BoxGeometry(0.16, 0.03, 0.1), -0.18, 1.0, 0.2, 0, 0, 0.7), PALETTE.gold],
    [at(new THREE.BoxGeometry(0.06, 0.06, 0.06), 0.24, 0.62, -0.12), 0xb8c3cf],
  ]);
}

/** Hero meshes for the non-boss heroes. Boss heroes reuse the boss rigs. */
export function heroMesh(kind: 'king' | 'knight' | 'ranger' | 'mage' | 'valkyrie' | 'ninja') {
  if (kind === 'king') return kingGroup();
  const build = { knight: knightGeometry, ranger: rangerGeometry, mage: mageGeometry, valkyrie: valkyrieGeometry, ninja: ninjaGeometry };
  const geo = build[kind]();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.scale.setScalar(1.25);
  return mesh;
}

export function arrowGeometry(shaft = 0xfff4d6, fletch = 0xff6a3d, tip = 0xe8f0ff) {
  return merge([
    [at(new THREE.BoxGeometry(0.08, 0.08, 1.2), 0, 0, 0), shaft],
    [at(new THREE.ConeGeometry(0.12, 0.3, 4), 0, 0, -0.74, -Math.PI / 2), tip],
    [at(new THREE.BoxGeometry(0.26, 0.03, 0.26), 0, 0, 0.5, 0, Math.PI / 4), fletch],
    [at(new THREE.BoxGeometry(0.03, 0.26, 0.26), 0, 0, 0.5, Math.PI / 4), fletch],
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

export type DecorKind =
  | 'pine' | 'round' | 'cactus' | 'rock' | 'snowpine' | 'deadtree' | 'grave' | 'lavarock'
  | 'palm' | 'jungletree' | 'ruin' | 'mushroom' | 'reed' | 'cloudpuff' | 'crystal'
  | 'ship' | 'buoy' | 'sakuratree' | 'lantern' | 'spire' | 'darkcrystal';

export function treeGeometry(kind: DecorKind) {
  if (kind === 'ship') {
    // a small sailing boat bobbing on the water
    return merge([
      [at(new THREE.BoxGeometry(1.4, 0.6, 3.2), 0, 0.5, 0), 0x7a4a24],
      [at(new THREE.ConeGeometry(0.7, 1.0, 4), 0, 0.5, -2.0, -Math.PI / 2, Math.PI / 4), 0x7a4a24],
      [at(new THREE.BoxGeometry(1.5, 0.12, 3.3), 0, 0.85, 0), 0x5a3418],
      [at(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 5), 0, 2.4, 0), 0x5a3418],
      [at(new THREE.BoxGeometry(0.06, 1.8, 1.6), 0, 2.6, 0.1), 0xf4ecd8],
      [at(new THREE.BoxGeometry(0.05, 0.5, 0.7), 0, 4.0, 0), 0x1a1a1a],
    ]);
  }
  if (kind === 'buoy') {
    return merge([
      [at(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8), 0, 0.3, 0), 0xe23b3b],
      [at(new THREE.CylinderGeometry(0.36, 0.36, 0.15, 8), 0, 0.45, 0), 0xffffff],
      [at(new THREE.ConeGeometry(0.2, 0.6, 6), 0, 0.9, 0), 0xe23b3b],
    ]);
  }
  if (kind === 'sakuratree') {
    return merge([
      [at(new THREE.CylinderGeometry(0.16, 0.26, 1.6, 6), 0, 0.8, 0), 0x5a3a2a],
      [at(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 5), 0.4, 1.7, 0, 0, 0, -0.7), 0x5a3a2a],
      [at(new THREE.IcosahedronGeometry(1.05, 0), 0, 2.3, 0), 0xffb6d9],
      [at(new THREE.IcosahedronGeometry(0.75, 0), 0.9, 2.0, 0.2), 0xff9ac8],
      [at(new THREE.IcosahedronGeometry(0.7, 0), -0.8, 2.1, -0.2), 0xffcfe4],
    ]);
  }
  if (kind === 'lantern') {
    const stone = 0xa8a49a;
    return merge([
      [at(new THREE.BoxGeometry(0.6, 0.15, 0.6), 0, 0.07, 0), stone],
      [at(new THREE.CylinderGeometry(0.12, 0.15, 0.8, 6), 0, 0.55, 0), stone],
      [at(new THREE.BoxGeometry(0.5, 0.1, 0.5), 0, 1.0, 0), stone],
      [at(new THREE.BoxGeometry(0.36, 0.34, 0.36), 0, 1.22, 0), 0xffd76a],
      [at(new THREE.ConeGeometry(0.48, 0.32, 4), 0, 1.55, 0, 0, Math.PI / 4), stone],
    ]);
  }
  if (kind === 'spire') {
    return merge([
      [at(new THREE.ConeGeometry(0.6, 3.2, 5), 0, 1.6, 0), 0x2a2034],
      [at(new THREE.ConeGeometry(0.35, 1.8, 5), 0.6, 0.9, 0.2, 0, 0, -0.25), 0x3a2e48],
      [at(new THREE.ConeGeometry(0.3, 1.4, 5), -0.5, 0.7, -0.1, 0, 0, 0.3), 0x3a2e48],
    ]);
  }
  if (kind === 'darkcrystal') {
    return merge([
      [at(new THREE.OctahedronGeometry(0.5, 0), 0, 1.1, 0), 0xb05cff],
      [at(new THREE.OctahedronGeometry(0.32, 0), 0.45, 0.7, 0.2), 0xff4a8a],
      [at(new THREE.OctahedronGeometry(0.28, 0), -0.4, 0.6, -0.1), 0x8a3ad0],
      [at(new THREE.DodecahedronGeometry(0.55, 0), 0, 0.15, 0), 0x2a2034],
    ]);
  }
  if (kind === 'palm') {
    const parts: Part[] = [];
    for (let i = 0; i < 5; i++) parts.push([at(new THREE.CylinderGeometry(0.13 - i * 0.012, 0.15 - i * 0.012, 0.6, 6), i * 0.06, 0.3 + i * 0.56, 0, 0, 0, -0.06), i % 2 ? 0x8a6a40 : 0x7a5a34]);
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.BoxGeometry(1.5, 0.05, 0.36);
      leaf.translate(0.75, 0, 0);
      leaf.rotateZ(-0.45);
      leaf.rotateY((k / 6) * Math.PI * 2);
      leaf.translate(0.3, 2.95, 0);
      parts.push([leaf, k % 2 ? 0x3f9a3a : 0x4fb048]);
    }
    parts.push([at(new THREE.IcosahedronGeometry(0.16, 0), 0.4, 2.8, 0.1), 0x6b4a2a]);
    return merge(parts);
  }
  if (kind === 'jungletree') {
    return merge([
      [at(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6), 0, 1.1, 0), 0x5e4630],
      [at(new THREE.IcosahedronGeometry(1.2, 0), 0, 2.6, 0), 0x2f7a35],
      [at(new THREE.IcosahedronGeometry(0.85, 0), 0.8, 2.2, 0.3), 0x3a8f3e],
      [at(new THREE.IcosahedronGeometry(0.75, 0), -0.7, 2.3, -0.2), 0x266b2c],
      [at(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), 0.5, 1.5, 0.5, 0.1), 0x3a6a2a],
    ]);
  }
  if (kind === 'ruin') {
    return merge([
      [at(new THREE.BoxGeometry(1.0, 0.25, 1.0), 0, 0.12, 0), 0x8e9078],
      [at(new THREE.CylinderGeometry(0.3, 0.34, 1.9, 8), 0, 1.2, 0), 0xa6a88c],
      [at(new THREE.BoxGeometry(0.8, 0.22, 0.8), 0, 2.25, 0), 0x8e9078],
      [at(new THREE.BoxGeometry(0.1, 1.2, 0.08), 0.31, 1.0, 0.1), 0x4f8f3a],
      [at(new THREE.CylinderGeometry(0.3, 0.32, 0.7, 8), 1.0, 0.25, 0.4, 0, 0, Math.PI / 2), 0xa6a88c],
    ]);
  }
  if (kind === 'mushroom') {
    return merge([
      [at(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6), 0, 0.45, 0), 0xe8e0c8],
      [at(new THREE.SphereGeometry(0.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.85, 0), 0x9a3ad0],
      [at(new THREE.IcosahedronGeometry(0.09, 0), 0.25, 1.25, 0.2), 0xf4f0ff],
      [at(new THREE.IcosahedronGeometry(0.07, 0), -0.3, 1.15, -0.1), 0xf4f0ff],
      [at(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6), 0.6, 0.25, 0.2), 0xe8e0c8],
      [at(new THREE.SphereGeometry(0.3, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.6, 0.48, 0.2), 0x6aba3a],
    ]);
  }
  if (kind === 'reed') {
    const parts: Part[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 2.1;
      parts.push([at(new THREE.CylinderGeometry(0.03, 0.04, 1.6 + (i % 3) * 0.3, 4), Math.cos(a) * 0.3, 0.8, Math.sin(a) * 0.3, 0, 0, (i - 2.5) * 0.06), 0x6a8a3a]);
      if (i % 2 === 0) parts.push([at(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 5), Math.cos(a) * 0.3, 1.7 + (i % 3) * 0.3, Math.sin(a) * 0.3), 0x5a3a20]);
    }
    return merge(parts);
  }
  if (kind === 'cloudpuff') {
    return merge([
      [at(new THREE.IcosahedronGeometry(1.1, 1), 0, 0.5, 0), 0xffffff],
      [at(new THREE.IcosahedronGeometry(0.8, 1), 1.0, 0.35, 0.2), 0xf2f6ff],
      [at(new THREE.IcosahedronGeometry(0.75, 1), -0.95, 0.3, -0.1), 0xf2f6ff],
      [at(new THREE.IcosahedronGeometry(0.6, 1), 0.3, 0.9, -0.4), 0xffffff],
    ]);
  }
  if (kind === 'crystal') {
    return merge([
      [at(new THREE.OctahedronGeometry(0.5, 0), 0, 1.3, 0), 0x9fdcff],
      [at(new THREE.OctahedronGeometry(0.3, 0), 0.5, 0.9, 0.2), 0xc8b0ff],
      [at(new THREE.OctahedronGeometry(0.25, 0), -0.45, 0.8, -0.1), 0xffe6a0],
      [at(new THREE.IcosahedronGeometry(0.7, 0), 0, 0.2, 0), 0xe8eef8],
    ]);
  }
  if (kind === 'snowpine') {
    return merge([
      [at(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 5), 0, 0.4, 0), 0x6b4423],
      [at(new THREE.ConeGeometry(1.0, 1.6, 6), 0, 1.4, 0), 0x2f6d55],
      [at(new THREE.ConeGeometry(0.78, 0.5, 6), 0, 1.95, 0), 0xf2f7fc],
      [at(new THREE.ConeGeometry(0.75, 1.3, 6), 0, 2.2, 0), 0x3a8065],
      [at(new THREE.ConeGeometry(0.45, 0.5, 6), 0, 2.75, 0), 0xf2f7fc],
    ]);
  }
  if (kind === 'deadtree') {
    return merge([
      [at(new THREE.CylinderGeometry(0.14, 0.24, 2.2, 5), 0, 1.1, 0), 0x4a3c3a],
      [at(new THREE.CylinderGeometry(0.05, 0.09, 1.0, 4), 0.35, 1.9, 0, 0, 0, -0.8), 0x4a3c3a],
      [at(new THREE.CylinderGeometry(0.04, 0.08, 0.8, 4), -0.3, 1.6, 0.1, 0.2, 0, 0.9), 0x4a3c3a],
      [at(new THREE.CylinderGeometry(0.03, 0.06, 0.6, 4), 0.05, 2.4, -0.2, -0.6, 0, 0.2), 0x4a3c3a],
    ]);
  }
  if (kind === 'grave') {
    return merge([
      [at(new THREE.BoxGeometry(0.7, 0.9, 0.2), 0, 0.45, 0), 0x8a8f9c],
      [at(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8, 1, false, 0, Math.PI), 0, 0.9, 0, Math.PI / 2, 0, Math.PI / 2), 0x8a8f9c],
      [at(new THREE.BoxGeometry(0.9, 0.12, 0.6), 0, 0.06, 0.25), 0x4e4a3e],
      [at(new THREE.BoxGeometry(0.1, 0.5, 0.06), 1.0, 0.35, 0.2), 0x6a6f7c],
      [at(new THREE.BoxGeometry(0.34, 0.08, 0.06), 1.0, 0.45, 0.2), 0x6a6f7c],
    ]);
  }
  if (kind === 'lavarock') {
    return merge([
      [at(new THREE.DodecahedronGeometry(0.9, 0), 0, 0.3, 0), 0x2e2624],
      [at(new THREE.DodecahedronGeometry(0.55, 0), 0.8, 0.15, 0.3), 0x3a302d],
      [at(new THREE.ConeGeometry(0.5, 1.4, 5), -0.4, 0.8, -0.2), 0x2e2624],
    ]);
  }
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
