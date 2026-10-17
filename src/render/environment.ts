import * as THREE from 'three';
import { ROAD_HALF_WIDTH, type Theme } from '../sim/types';
import { treeGeometry, type DecorKind } from './models';
import { groundTexture, lavaTexture, seededNoise, stoneTexture, waterTexture } from './textures';

interface ThemeDef {
  sky: number;
  road: [string, string];
  ground: [string, string] | null;
  /** what fills the sides when there is no ground */
  liquid: 'water' | 'lava';
  wall: number;
  wallTop: number;
  decor: DecorKind[];
  hemiGround: number;
  /** hemisphere / sun intensities and sun colour */
  light: { hemi: number; sun: number; sunColor: number };
  fog: [number, number];
}

const DAY = { hemi: 1.5, sun: 1.9, sunColor: 0xffffff };

export const THEMES: Record<Theme, ThemeDef> = {
  river: { sky: 0x8fd6ff, road: ['#e3d3b1', '#b09c7c'], ground: null, liquid: 'water', wall: 0xd8cbb0, wallTop: 0xeee3cb, decor: [], hemiGround: 0x3d7fbf, light: DAY, fog: [55, 120] },
  meadow: { sky: 0x9fdcff, road: ['#d8c49e', '#a08b68'], ground: ['#74c44c', '#5fae3c'], liquid: 'water', wall: 0x9c6a3a, wallTop: 0xb98450, decor: ['round', 'pine', 'rock'], hemiGround: 0x4f8f3a, light: DAY, fog: [55, 120] },
  snow: { sky: 0xc9e2f5, road: ['#cdd5df', '#919cab'], ground: ['#f2f7fc', '#d9e5f0'], liquid: 'water', wall: 0xb9c4d1, wallTop: 0xe6edf5, decor: ['snowpine', 'rock'], hemiGround: 0xbfd3e6, light: DAY, fog: [55, 120] },
  desert: { sky: 0xffe2ae, road: ['#e6c792', '#b8945e'], ground: ['#f2d395', '#ddb873'], liquid: 'water', wall: 0xc79c62, wallTop: 0xe0b77a, decor: ['cactus', 'rock'], hemiGround: 0xd9a65c, light: DAY, fog: [55, 120] },
  volcano: {
    sky: 0x5e2e28, road: ['#6d605c', '#352c2a'], ground: null, liquid: 'lava', wall: 0x4a3e3b, wallTop: 0x6b5c58,
    decor: ['lavarock'], hemiGround: 0xff6a20, light: { hemi: 1.2, sun: 1.7, sunColor: 0xffc08a }, fog: [40, 105],
  },
  night: {
    sky: 0x262b52, road: ['#8d93a6', '#565b6e'], ground: ['#36463a', '#2b382e'], liquid: 'water', wall: 0x5e6475, wallTop: 0x7f8698,
    decor: ['deadtree', 'grave', 'grave'], hemiGround: 0x30365a, light: { hemi: 1.05, sun: 1.35, sunColor: 0xa8b8ff }, fog: [40, 100],
  },
};

export interface Environment {
  group: THREE.Group;
  update(dt: number): void;
  dispose(): void;
}

export function buildEnvironment(theme: Theme, length: number, endD: number): Environment {
  const def = THEMES[theme];
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const total = length + 140;
  const startZ = 40;

  // road
  const roadTex = track(stoneTexture(def.road[0], def.road[1]));
  roadTex.repeat.set(1.7, total / 6.5);
  const road = new THREE.Mesh(
    track(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2 + 0.6, total)),
    track(new THREE.MeshLambertMaterial({ map: roadTex })),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, startZ - total / 2);
  group.add(road);

  // the bridge body under the road, visible from the camera against the water / ground
  const side = new THREE.Mesh(
    track(new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 1.6, 1.4, total)),
    track(new THREE.MeshLambertMaterial({ color: new THREE.Color(def.wall).multiplyScalar(0.8) })),
  );
  side.position.set(0, -0.72, startZ - total / 2);
  group.add(side);

  // surroundings
  let water: THREE.CanvasTexture | null = null;
  if (def.ground) {
    const gTex = track(groundTexture(def.ground[0], def.ground[1]));
    gTex.repeat.set(20, total / 6);
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(240, total)),
      track(new THREE.MeshLambertMaterial({ map: gTex })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.6, startZ - total / 2);
    group.add(ground);
  } else {
    const lava = def.liquid === 'lava';
    water = track(lava ? lavaTexture() : waterTexture());
    water.repeat.set(lava ? 16 : 24, total / (lava ? 14 : 10));
    const sea = new THREE.Mesh(
      track(new THREE.PlaneGeometry(240, total)),
      // lava glows on its own, so it ignores the lighting
      track(lava ? new THREE.MeshBasicMaterial({ map: water }) : new THREE.MeshLambertMaterial({ map: water })),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.9, startZ - total / 2);
    group.add(sea);
  }

  // parapets with crenellations along both edges
  const blockGeo = track(new THREE.BoxGeometry(0.55, 0.6, 1.9));
  const blockMat = track(new THREE.MeshLambertMaterial({ color: def.wall, flatShading: true }));
  const capGeo = track(new THREE.BoxGeometry(0.62, 0.32, 0.9));
  const capMat = track(new THREE.MeshLambertMaterial({ color: def.wallTop, flatShading: true }));
  const nBlocks = Math.ceil(total / 2);
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, nBlocks * 2);
  const caps = new THREE.InstancedMesh(capGeo, capMat, nBlocks * 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < nBlocks; i++) {
    const z = startZ - i * 2;
    for (const sx of [-1, 1]) {
      const k = i * 2 + (sx > 0 ? 1 : 0);
      m.makeTranslation(sx * (ROAD_HALF_WIDTH + 0.55), 0.3, z);
      blocks.setMatrixAt(k, m);
      m.makeTranslation(sx * (ROAD_HALF_WIDTH + 0.55), 0.76, z + 0.45);
      caps.setMatrixAt(k, m);
    }
  }
  group.add(blocks, caps);

  // scenery
  if (def.decor.length) {
    const rnd = seededNoise(length | 0);
    for (const kind of def.decor) {
      const geo = track(treeGeometry(kind));
      const mat = track(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      const n = Math.floor(total / 7);
      const inst = new THREE.InstancedMesh(geo, mat, n);
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const sx = rnd() < 0.5 ? -1 : 1;
        p.set(sx * (ROAD_HALF_WIDTH + 2.4 + rnd() * 16), def.ground ? -0.6 : -1.0, startZ - rnd() * total);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
        s.setScalar(0.8 + rnd() * 0.9);
        m.compose(p, q, s);
        inst.setMatrixAt(i, m);
      }
      group.add(inst);
    }
  }

  // castle at the end of the road
  const castle = buildCastle(def.wall, def.wallTop, track);
  castle.position.z = -(endD + 16);
  group.add(castle);

  return {
    group,
    update(dt: number) {
      if (water) water.offset.y += dt * (def.liquid === 'lava' ? 0.015 : 0.04);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

function buildCastle(wall: number, top: number, track: <T extends { dispose(): void }>(x: T) => T) {
  const g = new THREE.Group();
  const wallMat = track(new THREE.MeshLambertMaterial({ color: wall, flatShading: true }));
  const topMat = track(new THREE.MeshLambertMaterial({ color: top, flatShading: true }));
  const roofMat = track(new THREE.MeshLambertMaterial({ color: 0xc8402e, flatShading: true }));
  const gateMat = track(new THREE.MeshLambertMaterial({ color: 0x4a3020 }));
  const flagMat = track(new THREE.MeshLambertMaterial({ color: 0xe23b3b, side: THREE.DoubleSide }));

  const front = new THREE.Mesh(track(new THREE.BoxGeometry(26, 7, 3)), wallMat);
  front.position.y = 3.5;
  g.add(front);
  const door = new THREE.Mesh(track(new THREE.BoxGeometry(5, 5, 0.4)), gateMat);
  door.position.set(0, 2.5, 1.6);
  g.add(door);
  const merlon = track(new THREE.BoxGeometry(1.2, 1.1, 3.2));
  for (let x = -12; x <= 12; x += 2.4) {
    const b = new THREE.Mesh(merlon, topMat);
    b.position.set(x, 7.5, 0);
    g.add(b);
  }
  const towerGeo = track(new THREE.CylinderGeometry(2.4, 2.6, 10, 8));
  const roofGeo = track(new THREE.ConeGeometry(3.1, 4, 8));
  const poleGeo = track(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4));
  const flagGeo = track(new THREE.PlaneGeometry(1.6, 1));
  for (const x of [-12, 12]) {
    const tower = new THREE.Mesh(towerGeo, wallMat);
    tower.position.set(x, 5, 0);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(x, 12, 0);
    const pole = new THREE.Mesh(poleGeo, gateMat);
    pole.position.set(x, 15, 0);
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(x + 0.8, 15.7, 0);
    g.add(tower, roof, pole, flag);
  }
  return g;
}
