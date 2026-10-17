import * as THREE from 'three';

export const NUMBER_FONT = '"Lilita One", "CA Round", "PingFang TC", sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function outlinedText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number,
  fill = '#fff', stroke = 'rgba(10,20,50,0.85)',
) {
  ctx.font = `${size}px ${NUMBER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function seededNoise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function stoneTexture(base: string, mortar: string, variance = 18) {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seededNoise(7);
  const rows = 4;
  const h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0 : -32;
    for (let x = off; x < 256; x += 64) {
      const col = new THREE.Color(base);
      col.offsetHSL(0, 0, (rnd() - 0.5) * variance / 100);
      ctx.fillStyle = col.getStyle();
      roundRect(ctx, x + 3, r * h + 3, 58, h - 6, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, x + 5, r * h + 5, 54, 8, 4);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function waterTexture() {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#1f78c8');
  g.addColorStop(1, '#2a8ad6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seededNoise(3);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 28; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const w = 14 + rnd() * 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 5, x + w, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function lavaTexture() {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#ff7a1a');
  g.addColorStop(1, '#ff4a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seededNoise(5);
  // dark crust plates floating on the lava, with bright seams
  for (let i = 0; i < 34; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 10 + rnd() * 24;
    ctx.fillStyle = 'rgba(60, 22, 12, 0.85)';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = r * (0.7 + rnd() * 0.5);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * 0.7;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 230, 120, 0.55)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 5, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function swampTexture() {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#4f6a34');
  g.addColorStop(1, '#3f5a2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seededNoise(9);
  // scum, lily pads and bubbles
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${120 + rnd() * 40}, ${150 + rnd() * 40}, 60, 0.35)`;
    ctx.beginPath();
    ctx.ellipse(rnd() * 256, rnd() * 256, 6 + rnd() * 18, 3 + rnd() * 8, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 7 + rnd() * 6;
    ctx.fillStyle = '#5f9a3a';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, 0.4, Math.PI * 2 - 0.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(220,255,180,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.arc(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function cloudTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#cfe2ff';
  ctx.fillRect(0, 0, 256, 256);
  const rnd = seededNoise(13);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 12 + rnd() * 34;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    // draw wrapped copies so the texture tiles without seams
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function groundTexture(base: string, speck: string) {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  const rnd = seededNoise(11);
  ctx.fillStyle = speck;
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.35;
    ctx.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function blobTexture() {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function ringTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

/** A texture that is redrawn in place when its content changes. */
export class LabelTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private key = '';

  constructor(readonly width: number, readonly height: number, private readonly draw: (ctx: CanvasRenderingContext2D, w: number, h: number, key: string) => void) {
    const { c, ctx } = canvas(width, height);
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  set(key: string) {
    if (key === this.key) return;
    this.key = key;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.draw(this.ctx, this.width, this.height, key);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

export function gateLabel() {
  return new LabelTexture(512, 256, (ctx, w, h, key) => {
    const [text, good] = key.split('|');
    const isGood = good === '1';
    // '2' is a mystery gate: purple with a big question mark
    const mystery = good === '2';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (mystery) {
      g.addColorStop(0, 'rgba(190,120,255,0.9)');
      g.addColorStop(1, 'rgba(110,40,200,0.9)');
    } else if (isGood) {
      g.addColorStop(0, 'rgba(90,180,255,0.88)');
      g.addColorStop(1, 'rgba(25,95,230,0.88)');
    } else {
      g.addColorStop(0, 'rgba(255,110,100,0.88)');
      g.addColorStop(1, 'rgba(200,30,40,0.88)');
    }
    ctx.fillStyle = g;
    roundRect(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = mystery ? 'rgba(255,230,140,0.95)' : isGood ? 'rgba(220,240,255,0.95)' : 'rgba(255,225,220,0.95)';
    ctx.stroke();
    const ink = mystery ? 'rgba(60,10,110,0.9)' : isGood ? 'rgba(10,40,120,0.9)' : 'rgba(110,10,20,0.9)';
    outlinedText(ctx, text, w / 2, h / 2 + 8, 150, mystery ? '#ffe27a' : '#fff', ink);
  });
}

export function crateLabel() {
  return new LabelTexture(256, 256, (ctx, w, h, key) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5aa8ff');
    g.addColorStop(1, '#1f5fd6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#cfe6ff';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    outlinedText(ctx, key, w / 2, h / 2 + 8, 120, '#fff', 'rgba(10,40,120,0.9)');
  });
}

export function hpLabel() {
  return new LabelTexture(256, 128, (ctx, w, h, key) => {
    const [num, sub] = key.split('|');
    outlinedText(ctx, num, w / 2, sub ? 44 : h / 2, 76, '#fff', 'rgba(30,20,10,0.9)');
    if (sub) outlinedText(ctx, sub, w / 2, 102, 40, '#ffe27a', 'rgba(60,30,0,0.9)');
  });
}

export function hazardStripeTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e23b3b';
  for (let i = -128; i < 256; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 24, 0);
    ctx.lineTo(i + 24 + 128, 128);
    ctx.lineTo(i + 128, 128);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
