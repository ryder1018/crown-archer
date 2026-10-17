// Dev-only page that renders the app icon from the game's own models (see scripts/icon.mjs).
import * as THREE from 'three';
import { archerGeometry, kingGroup } from './render/models';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1024, 1024, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const bg = document.createElement('canvas');
bg.width = bg.height = 512;
const g = bg.getContext('2d')!;
const grad = g.createRadialGradient(256, 200, 20, 256, 256, 380);
grad.addColorStop(0, '#9fe0ff');
grad.addColorStop(0.55, '#3d9bff');
grad.addColorStop(1, '#1747b8');
g.fillStyle = grad;
g.fillRect(0, 0, 512, 512);
g.globalAlpha = 0.16;
g.fillStyle = '#ffffff';
for (let i = 0; i < 16; i++) {
  g.beginPath();
  g.moveTo(256, 230);
  const a0 = (i / 16) * Math.PI * 2;
  const a1 = a0 + Math.PI / 16;
  g.lineTo(256 + Math.cos(a0) * 600, 230 + Math.sin(a0) * 600);
  g.lineTo(256 + Math.cos(a1) * 600, 230 + Math.sin(a1) * 600);
  g.fill();
}
const bgTex = new THREE.CanvasTexture(bg);
bgTex.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTex;

scene.add(new THREE.HemisphereLight(0xffffff, 0x335588, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-3, 6, 6);
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.3));

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 2.0, 5.6);
camera.lookAt(0, 1.05, 0);

const king = kingGroup();
king.scale.setScalar(2.0);
king.rotation.y = Math.PI + 0.3;
king.position.set(0, -0.55, 0.6);
scene.add(king);

const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
const archer = archerGeometry();
const spots: [number, number, number][] = [[-1.55, -0.2, -0.6], [1.55, -0.2, -0.6], [-0.9, 0.05, -1.6], [0.9, 0.05, -1.6], [-2.3, 0.2, -1.8], [2.3, 0.2, -1.8]];
for (const [x, y, z] of spots) {
  const m = new THREE.Mesh(archer, mat);
  m.scale.setScalar(1.25);
  m.position.set(x, y - 0.25, z);
  m.rotation.y = Math.PI + x * 0.15;
  scene.add(m);
}

renderer.render(scene, camera);
document.body.dataset.done = '1';
