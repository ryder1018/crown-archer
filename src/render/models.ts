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

export type DecorKind = 'pine' | 'round' | 'cactus' | 'rock' | 'snowpine' | 'deadtree' | 'grave' | 'lavarock';

export function treeGeometry(kind: DecorKind) {
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
