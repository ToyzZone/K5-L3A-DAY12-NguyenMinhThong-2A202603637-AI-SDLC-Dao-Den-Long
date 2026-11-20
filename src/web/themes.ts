/// <reference types="vite/client" />
// Ba bộ giao diện cho Đảo Đèn Lồng. Chỉ phần vẽ: không import src/sim, không asset ngoài (mọi hình, texture vẽ bằng code).
// Màu của các thành phần có trong Bảng màu chuẩn (Ticket-02 §8) lấy từ PALETTE và giống nhau ở cả ba theme;
// theme chỉ đổi chất liệu, hình khối, hoa văn, cây cỏ, trời và HUD.
// Đơn vị mét, Y hướng lên, gốc của mọi builder ở chân / mặt đất. Camera cần far ≥ 500 (vòm trời bán kính 420).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Ticket-02 §8: sai lệch tối đa 10% mỗi kênh RGB. */
export const PALETTE = {
  sky: 0x0e1430, fog: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, cloudSea: 0x12384a,
  lanternLit: 0xffb347, lanternCore: 0xffe9b0, lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeRim: 0x7a3cff, shadeStunned: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
  uiDanger: 0xff5a5f, uiText: 0xf5f1e6,
} as const;

type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;
type Mat = THREE.MeshStandardMaterial | THREE.MeshToonMaterial;
export interface Island { cx: number; cz: number; r: number }
export interface Bridge { x0: number; x1: number; z0: number; z1: number }
interface Spot { x: number; z: number; yaw: number; s: number }
export type ShadeState = 'normal' | 'stunned' | 'drain';
export type DrifterState = 'idle' | 'chase' | 'flee';

/** Nhãn HUD mặc định; theme có thể đổi qua hud.labels (main.ts áp khi gắn). */
export const HUD_LABELS = { flame: 'Ngọn Lửa', mote: 'Đom đóm', lantern: 'Đèn', score: 'Điểm' };

export interface Theme {
  key: string;
  name: string;
  blurb: string;
  surface: 'lacquer' | 'paper' | 'soft'; // sơn bóng (clearcoat) | giấy (toon 3 nấc) | mờ
  outline: number;                       // viền mực inverted-hull, 0 = không viền
  rock: number; straw: number; skin: number;
  fog: number;                           // mật độ FogExp2 khi chưa thắp đèn nào
  stars: { color: number; count: number; size: number; paint: Painter };
  paintMoon: Painter;
  paintGround: Painter;
  paintRock?: Painter;
  paintSea?: Painter;
  rockProfile: (r: number) => [number, number][]; // (bán kính, y) từ đáy lên tới mép đảo
  clouds: 'puff' | 'scallop';
  lantern: 'lathe' | 'accordion' | 'star' | 'stage';
  show?: boolean;                        // Chạy Show: Mây thành ca sĩ, Đom đóm thành fan, Bóng Mực thành antifan (chỉ phần vẽ)
  safeDash: number;                      // số vạch của vòng Vùng an toàn, 0 = liền
  shadeRim: [scale: number, opacity: number];
  flora: (t: Theme, spots: Spot[]) => THREE.Object3D;
  floraPer: number;                      // số cụm cây cho đảo bán kính 16 m (tăng theo diện tích)
  floraClear: number;                    // bán kính chiếm chỗ của một cụm
  swarm: number;                         // đom đóm trang trí cho đảo bán kính 16 m
  moteCompanions: number;                // đom đóm nhỏ bay quanh mỗi Đom đóm nhặt được
  hud: { font: string; css: string; labels?: typeof HUD_LABELS; formatScore?: (n: number) => string };
  music?: string;                        // URL file do người dùng tự đặt (music/ ở gốc repo, gitignore); chỉ phát khi dev
}

const TAU = Math.PI * 2;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const INK = hex(PALETTE.sky);

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w: number, h: number, paint: Painter, repeat = 0) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

// Rải n chi tiết, mỗi cái vẽ 9 lần lệch ±s để texture lặp không lộ đường nối.
function sprinkle(g: CanvasRenderingContext2D, s: number, n: number, seed: number, draw: (x: number, y: number, r: () => number) => void) {
  for (let i = 0; i < n; i++) {
    const r0 = rng(seed * 7919 + i), x = r0() * s, y = r0() * s;
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) draw(x + dx, y + dy, rng(seed * 104729 + i));
  }
}

const fill = (g: CanvasRenderingContext2D, c: number, w: number, h: number) => { g.fillStyle = hex(c); g.fillRect(0, 0, w, h); };
const cracks = (g: CanvasRenderingContext2D, s: number, n: number, style: string) => {
  g.lineWidth = 1.3;
  g.strokeStyle = style;
  sprinkle(g, s, n, 3, (x, y, r) => {
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) g.lineTo((x += (r() - 0.5) * 60), (y += (r() - 0.5) * 60));
    g.stroke();
  });
};
const flecks = (g: CanvasRenderingContext2D, s: number, n: number, style: string) => {
  g.fillStyle = style;
  sprinkle(g, s, n, 5, (x, y, r) => {
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU, d = 1.5 + r() * 4; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    g.fill();
  });
};
const fibres = (g: CanvasRenderingContext2D, s: number, n: number, light: string, dark: string) => {
  g.lineWidth = 1;
  sprinkle(g, s, n, 11, (x, y, r) => {
    const a = r() * TAU, l = 6 + r() * 22;
    g.strokeStyle = r() < 0.5 ? light : dark;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  });
};

// --- Hoạ tiết nền ---
const eggshellGround: Painter = (g, s) => { fill(g, PALETTE.grass, s, s); cracks(g, s, 80, 'rgba(232,226,208,0.16)'); flecks(g, s, 30, 'rgba(242,193,78,0.75)'); };
const goldVeinRock: Painter = (g, s) => { fill(g, 0x4a1a12, s, s); cracks(g, s, 50, 'rgba(242,193,78,0.45)'); };
const goldScrollSea: Painter = (g, s) => {
  fill(g, PALETTE.cloudSea, s, s);
  cracks(g, s, 40, 'rgba(232,226,208,0.08)');
  g.strokeStyle = 'rgba(242,193,78,0.5)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  sprinkle(g, s, 6, 23, (x, y, r) => { // mây cuộn kiểu tranh sơn mài
    const R = 16 + r() * 18;
    g.beginPath();
    for (let a = 0; a < 3 * Math.PI; a += 0.15) { const d = R * (1 - a / (3.3 * Math.PI)); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    g.stroke();
    g.beginPath();
    g.moveTo(x + R, y);
    g.bezierCurveTo(x + R * 1.8, y + R * 0.4, x + R * 2.4, y - R * 0.4, x + R * 3.2, y - R * 0.1);
    g.stroke();
  });
};
const doPaperGround: Painter = (g, s) => { fill(g, PALETTE.grass, s, s); fibres(g, s, 700, 'rgba(245,241,230,0.10)', 'rgba(14,20,48,0.14)'); };
const meadow: Painter = (g, s) => {
  fill(g, PALETTE.grass, s, s);
  g.lineWidth = 2;
  sprinkle(g, s, 1300, 17, (x, y, r) => {
    const l = 5 + r() * 9, b = (r() - 0.5) * 6;
    g.strokeStyle = r() < 0.5 ? '#3a6c57' : '#25503f';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + b * 0.3, y - l * 0.6, x + b, y - l);
    g.stroke();
  });
  g.fillStyle = '#e2eaa8';
  sprinkle(g, s, 36, 19, (x, y) => { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); });
};

// --- Trăng, sao ---
const goldMoon: Painter = (g, s) => {
  g.fillStyle = hex(PALETTE.gold);
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.42, 0, TAU);
  g.fill();
  g.save();
  g.clip();
  cracks(g, s, 20, 'rgba(110,60,10,0.45)');
  g.restore();
};
const paperMoon: Painter = (g, s) => {
  g.fillStyle = INK;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.42, 0, TAU);
  g.fill();
  g.fillStyle = hex(PALETTE.uiText);
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.39, 0, TAU);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(s * 0.65, s * 0.4, s * 0.36, 0, TAU);
  g.fill();
  g.globalCompositeOperation = 'source-over';
};
const hazeMoon: Painter = (g, s) => {
  const h = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
  h.addColorStop(0, 'rgba(245,241,230,0.5)');
  h.addColorStop(0.35, 'rgba(214,228,160,0.12)');
  h.addColorStop(1, 'rgba(214,228,160,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, s, s);
  g.fillStyle = hex(PALETTE.uiText);
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.11, 0, TAU);
  g.fill();
};
const starPoly = (n: number, inner: number, jitter: number): Painter => (g, s) => {
  const r = rng(9);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * TAU, d = s * (k % 2 ? inner : 0.48 - r() * jitter); g.lineTo(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d); }
  g.fill();
};
const dotStar: Painter = (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, '#fff');
  r.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
};

// --- Cây giấy cắt (theme Giấy Dó): lượt mực dày trước, lượt màu giấy đè lên ---
const quad = (a: number[], b: number[], c: number[], s: number) => [0, 1].map((k) => (1 - s) ** 2 * a[k] + 2 * (1 - s) * s * b[k] + s * s * c[k]);
const palm: Painter = (g, w, h) => {
  const cx = w * 0.55, cy = h * 0.3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const ink of [true, false]) {
    g.strokeStyle = ink ? INK : '#6b5638';
    g.lineWidth = ink ? 17 : 9;
    g.beginPath();
    g.moveTo(w * 0.48, h);
    g.quadraticCurveTo(w * 0.42, h * 0.62, cx, cy);
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1 + i / 8), len = w * (0.36 + 0.07 * Math.sin(i * 2.1)), side = 1 - Math.abs(Math.sin(a));
      const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.55 + len * 0.4 * side];
      const ctl = [cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.6 - len * 0.15];
      g.strokeStyle = ink ? INK : i % 2 ? '#3f7a5a' : '#2e664c';
      g.lineWidth = ink ? 9 : 4;
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo(ctl[0], ctl[1], tip[0], tip[1]);
      g.stroke();
      g.lineWidth = ink ? 7 : 3;
      for (let k = 2; k <= 12; k++) { // lá chét hai bên
        const s = k / 12, [px, py] = quad([cx, cy], ctl, tip, s), [nx, ny] = quad([cx, cy], ctl, tip, s + 0.01);
        const d = Math.hypot(nx - px, ny - py) || 1, ux = (nx - px) / d, uy = (ny - py) / d, L = 24 * (1 - s * 0.55);
        g.beginPath();
        g.moveTo(px - uy * L, py + ux * L + L * 0.5);
        g.lineTo(px, py);
        g.lineTo(px + uy * L, py - ux * L + L * 0.5);
        g.stroke();
      }
    }
  }
};
const banana: Painter = (g, w, h) => {
  const leaves = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI * (0.1 + i * 0.16), l = w * 0.3;
    return [w / 2 + Math.cos(a) * l, h * 0.44 + Math.sin(a) * l * 0.8 + (i === 0 || i === 5 ? h * 0.08 : 0), l, a];
  });
  for (const ink of [true, false]) {
    const o = ink ? 5 : 0;
    g.fillStyle = ink ? INK : '#5d6a3c';
    g.fillRect(w * 0.45 - o, h * 0.42 - o, w * 0.1 + 2 * o, h);
    leaves.forEach(([x, y, l, a], i) => {
      g.fillStyle = ink ? INK : i % 2 ? '#4a8a5c' : '#3a7550';
      g.beginPath();
      g.ellipse(x, y, l * 0.62 + o, w * 0.075 + o, a, 0, TAU);
      g.fill();
    });
  }
  g.strokeStyle = '#7fae6a';
  g.lineWidth = 2;
  for (const [x, y, l, a] of leaves) {
    g.beginPath();
    g.moveTo(x - Math.cos(a) * l * 0.55, y - Math.sin(a) * l * 0.55);
    g.lineTo(x + Math.cos(a) * l * 0.55, y + Math.sin(a) * l * 0.55);
    g.stroke();
  }
};
const bush: Painter = (g, w, h) => {
  const r = rng(91), blobs = Array.from({ length: 8 }, (_, i) => [w * (0.16 + 0.68 * (i / 7)), h * (0.66 - 0.28 * Math.sin((i / 7) * Math.PI)) + r() * 8, h * (0.22 + r() * 0.12)]);
  for (const ink of [true, false]) {
    const o = ink ? 6 : 0;
    g.fillStyle = ink ? INK : '#2c5f48';
    g.fillRect(w * 0.14 - o, h * 0.7 - o, w * 0.72 + 2 * o, h);
    for (const [x, y, rad] of blobs) { g.beginPath(); g.arc(x, y, rad + o, 0, TAU); g.fill(); }
  }
  g.fillStyle = '#3d7a58';
  for (const [x, y, rad] of blobs) { g.beginPath(); g.arc(x - rad * 0.2, y - rad * 0.25, rad * 0.5, 0, TAU); g.fill(); }
};
const onPaper = (p: Painter): Painter => (g, w, h) => {
  p(g, w, h);
  g.globalCompositeOperation = 'source-atop';
  fibres(g, Math.max(w, h), 260, 'rgba(245,241,230,0.12)', 'rgba(14,20,48,0.12)');
  g.globalCompositeOperation = 'source-over';
};

// Áo diễn kim sa (nền vẫn là màu áo Mây #E8E2D0).
const sequins: Painter = (g, s) => {
  fill(g, PALETTE.shirt, s, s);
  sprinkle(g, s, 90, 29, (x, y, r) => { g.fillStyle = r() < 0.5 ? 'rgba(242,193,78,0.85)' : 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x, y, 1.5 + r() * 1.5, 0, TAU); g.fill(); });
};

// --- Hình dùng chung ---
function starShape(n: number, R: number, r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU + Math.PI / 2, d = i % 2 ? r : R;
    if (i) s.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    else s.moveTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  return s;
}
// Hoa thiên lý: 5 thùy thuôn tròn đầu (tràng hoa hình sao), bán kính 1.
function flowerShape() {
  const s = new THREE.Shape(), p = (a: number, d: number) => [Math.cos(a) * d, Math.sin(a) * d] as const;
  s.moveTo(...p(-TAU / 10, 0.32));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    s.quadraticCurveTo(...p(a - 0.3, 1.1), ...p(a, 1));
    s.quadraticCurveTo(...p(a + 0.3, 1.1), ...p(a + TAU / 10, 0.32));
  }
  return s;
}
// Lá tim (thiên lý): khía ở gốc, mũi nhọn; gốc ở (0,0), mũi ở (0,1).
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.1);
  s.bezierCurveTo(-0.2, -0.1, -0.55, 0.15, -0.45, 0.45);
  s.bezierCurveTo(-0.35, 0.72, -0.1, 0.85, 0, 1);
  s.bezierCurveTo(0.1, 0.85, 0.35, 0.72, 0.45, 0.45);
  s.bezierCurveTo(0.55, 0.15, 0.2, -0.1, 0, 0.1);
  return s;
}
function lanceShape(w: number, l: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, l * 0.4, 0, l);
  s.quadraticCurveTo(-w, l * 0.4, 0, 0);
  return s;
}

// Đầu đèn cao ~0.84 m, tâm ở gốc. 'lathe' = đèn lụa bầu dục, 'accordion' = đèn giấy xếp, 'star' = đèn ông sao.
function lanternGeo(kind: Theme['lantern']): THREE.BufferGeometry {
  if (kind === 'star') {
    return new THREE.ExtrudeGeometry(starShape(5, 0.45, 0.2), { depth: 0.14, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 }).translate(0, 0, -0.07);
  }
  const pts = kind === 'accordion'
    ? Array.from({ length: 9 }, (_, i) => { const y = -0.4 + i * 0.1; return new THREE.Vector2(i % 8 ? (i % 2 ? 0.34 : 0.29) * (1 - (y / 0.5) ** 2 * 0.35) : 0.16, y); })
    : [[0.1, -0.41], [0.24, -0.36], [0.32, -0.22], [0.345, 0], [0.32, 0.22], [0.24, 0.36], [0.1, 0.41]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, kind === 'accordion' ? 10 : 28);
  if (kind !== 'accordion') return g;
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
// Màu đèn sáng: viền #FFB347, lõi #FFE9B0, nan đèn sẫm hơn. Dùng làm emissiveMap.
function glowTex(kind: Theme['lantern']) {
  const lit = hex(PALETTE.lanternLit), core = hex(PALETTE.lanternCore);
  if (kind === 'stage') { // phông sân khấu: lõi sáng giữa, tia, viền bóng đèn
    return canvasTex(256, 256, (g, s) => {
      const r = g.createRadialGradient(s / 2, s * 0.55, 0, s / 2, s * 0.55, s * 0.6);
      r.addColorStop(0, core);
      r.addColorStop(0.5, lit);
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(140,60,0,0.3)';
      g.lineWidth = 4;
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(s / 2, s * 0.55); g.lineTo(s / 2 + Math.cos((i / 12) * TAU) * s, s * 0.55 + Math.sin((i / 12) * TAU) * s); g.stroke(); }
      g.fillStyle = core;
      g.strokeStyle = 'rgba(120,50,0,0.6)';
      for (let k = 0; k < 10; k++) for (const [x, y] of [[16 + (k * (s - 32)) / 9, 14], [14, 30 + (k * (s - 44)) / 9], [s - 14, 30 + (k * (s - 44)) / 9]]) {
        g.beginPath();
        g.arc(x, y, 7, 0, TAU);
        g.fill();
        g.stroke();
      }
    });
  }
  if (kind === 'star') {
    const tex = canvasTex(128, 128, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, core);
      r.addColorStop(0.45, lit);
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    tex.repeat.set(1 / 0.9, 1 / 0.9); // UV của ExtrudeGeometry là toạ độ hình (±0.45 m)
    tex.offset.set(0.5, 0.5);
    return tex;
  }
  return canvasTex(256, 128, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0.05, lit);
    v.addColorStop(0.5, core);
    v.addColorStop(0.95, lit);
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(140,60,0,0.3)';
    const ribs = kind === 'accordion' ? 10 : 14;
    for (let i = 0; i < ribs; i++) g.fillRect((i / ribs) * w, 0, 2, h);
  });
}
// Nón lá: các vòng nan đều nhau theo chiều nghiêng của chóp.
function strawTex(t: Theme) {
  return canvasTex(64, 256, (g, w, h) => {
    fill(g, t.straw, w, h);
    g.fillStyle = 'rgba(70,45,10,0.3)';
    for (let i = 1; i < 11; i++) g.fillRect(0, (i / 11) * h, w, 2);
    if (t.surface !== 'soft') { g.fillStyle = t.surface === 'lacquer' ? hex(PALETTE.gold) : INK; g.fillRect(0, h - 8, w, 8); }
  });
}

// --- Vật liệu ---
let toonRamp: THREE.DataTexture | undefined;
function mat(t: Theme, color: number, o: { emissive?: number; ei?: number; map?: THREE.Texture; side?: THREE.Side } = {}): Mat {
  const p = { color, emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 1, map: o.map ?? null, side: o.side ?? THREE.FrontSide };
  if (t.surface === 'paper') {
    if (!toonRamp) {
      toonRamp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
      toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
      toonRamp.needsUpdate = true;
    }
    return new THREE.MeshToonMaterial({ ...p, gradientMap: toonRamp });
  }
  if (t.surface === 'lacquer') return new THREE.MeshPhysicalMaterial({ ...p, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });
  return new THREE.MeshStandardMaterial({ ...p, roughness: 0.92 });
}
const inkMat = new THREE.MeshBasicMaterial({ color: PALETTE.sky, side: THREE.BackSide });
function ink<T extends THREE.Mesh>(t: Theme, m: T, k = 1): T {
  if (t.outline) { const o = new THREE.Mesh(m.geometry, inkMat); o.scale.setScalar(1 + t.outline * k); m.add(o); }
  return m;
}
function add(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
let blobTex: THREE.Texture | undefined;
function blob(parent: THREE.Object3D, r: number, opacity = 0.5) {
  blobTex ??= canvasTex(64, 64, (g, s) => {
    const q = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    q.addColorStop(0, 'rgba(0,0,0,1)');
    q.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = q;
    g.fillRect(0, 0, s, s);
  });
  return add(parent, new THREE.PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }), 0, 0.02, 0);
}

// --- Cây cỏ theo theme ---
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function instanced(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], color?: (i: number) => number) {
  const im = new THREE.InstancedMesh(geo, m, list.length);
  list.forEach((x, i) => { im.setMatrixAt(i, x); if (color) im.setColorAt(i, _c.setHex(color(i))); });
  parent.add(im);
  return im;
}
const pose = (x: number, y: number, z: number, rx: number, ry: number, k: number, ky = k, base?: THREE.Matrix4) => {
  const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, 0, 'YXZ')), _s.set(k, ky, k));
  return base ? m.premultiply(base) : m;
};

// Sơn Mài: khóm tre sơn then, đốt thếp vàng, lá điểm vàng lá.
function bambooGroves(t: Theme, spots: Spot[]) {
  const g = new THREE.Group(), r = rng(31), stalks: THREE.Matrix4[] = [], leaves: THREE.Matrix4[] = [];
  const tip = new THREE.Vector3();
  for (const sp of spots) for (let k = 0; k < 7; k++) {
    const a = r() * TAU, d = r() * 1.1, h = (3.5 + r() * 3.5) * sp.s, x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d;
    const m = pose(x, 0, z, (r() - 0.5) * 0.16, 0, 1, h);
    stalks.push(m);
    for (let L = 0; L < 16; L++) {
      tip.set(0, 0.45 + 0.55 * r(), 0).applyMatrix4(m);
      leaves.push(pose(tip.x, tip.y, tip.z, -0.5 - r() * 1.3, r() * TAU, 1.2 + r() * 0.8));
    }
  }
  const stalkTex = canvasTex(32, 256, (c, w, h) => {
    fill(c, 0x1f3a2c, w, h);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(w * 0.25, 0, w * 0.15, h);
    c.fillStyle = hex(PALETTE.gold);
    for (let i = 1; i < 6; i++) c.fillRect(0, (i / 6) * h, w, 3);
  });
  instanced(g, new THREE.CylinderGeometry(0.075, 0.09, 1, 7).translate(0, 0.5, 0), mat(t, 0xffffff, { map: stalkTex }), stalks);
  instanced(g, new THREE.ShapeGeometry(lanceShape(0.07, 0.55), 3), mat(t, 0xffffff, { side: THREE.DoubleSide }), leaves,
    () => (r() < 0.15 ? PALETTE.gold : r() < 0.5 ? 0x4b8a5e : 0x346e4c));
  return g;
}

// Giấy Dó: cây cau, chuối, bụi cây cắt giấy đứng thẳng như sách dựng hình.
function paperCutouts(t: Theme, spots: Spot[]) {
  const g = new THREE.Group();
  const kinds = ([[palm, 256, 512, 3.4], [banana, 256, 256, 3.2], [bush, 256, 128, 2.6]] as const).map(([paint, w, h, size]) => {
    const m = mat(t, 0xffffff, { map: canvasTex(w, h, onPaper(paint)), side: THREE.DoubleSide });
    m.alphaTest = 0.5;
    return { geo: new THREE.PlaneGeometry(size, (size * h) / w).translate(0, (size * h) / w / 2, 0), m };
  });
  spots.forEach((sp, i) => {
    const k = kinds[i % 3], o = add(g, k.geo, k.m, sp.x, 0, sp.z);
    o.rotation.y = sp.yaw;
    o.scale.setScalar(sp.s);
  });
  return g;
}

// Thiên Lý: giàn tre, lá tim phủ mặt giàn và rủ thành dây, chùm hoa sao xanh vàng (Telosma cordata).
function trellis(t: Theme, spots: Spot[]) {
  const g = new THREE.Group(), r = rng(53), W = 5, D = 3.6, H = 2.45;
  const poles: THREE.Matrix4[] = [], leaves: THREE.Matrix4[] = [], flowers: THREE.Matrix4[] = [], fcol: number[] = [];
  for (const sp of spots) {
    const base = new THREE.Matrix4().makeRotationY(sp.yaw).setPosition(sp.x, 0, sp.z);
    const at = (x: number, y: number, z: number, rx: number, ry: number, k: number, ky = k) => pose(x, y, z, rx, ry, k, ky, base);
    // Chùm hoa (tán giả): ~12 hoa xếp vòm, 1/4 là nụ xanh nhạt.
    const umbel = (cx: number, cy: number, cz: number, up: boolean) => {
      for (let f = 0; f < 12; f++) {
        const a = f * 2.4, rr = 0.15 * Math.sqrt((f + 0.5) / 12), bud = f % 4 === 3;
        flowers.push(at(cx + Math.cos(a) * rr, cy + (up ? 1 : -1) * (0.06 - rr * 0.4), cz + Math.sin(a) * rr,
          up ? -Math.PI / 2 + (r() - 0.5) * 0.8 : (r() - 0.5) * 1.2, r() * TAU, bud ? 0.032 : 0.05));
        fcol.push(bud ? 0xa9cc78 : [0xd6e48f, 0xc9dc7c, 0xe2e89c][f % 3]);
      }
    };
    for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) poles.push(at(x, H / 2, z, 0, 0, 1.2, H + 0.1));
    for (let i = 0; i <= 8; i++) poles.push(at(0, H, -D / 2 + (i * D) / 8, Math.PI / 2, Math.PI / 2, 1, W + 0.5));
    for (let i = 0; i <= 8; i++) poles.push(at(-W / 2 + (i * W) / 8, H + 0.06, 0, Math.PI / 2, 0, 1, D + 0.5));
    for (let i = 0; i < 480; i++) leaves.push(at((r() - 0.5) * (W + 0.4), H + 0.08 + r() * 0.1, (r() - 0.5) * (D + 0.4), -Math.PI / 2 + (r() - 0.5) * 1.1, r() * TAU, 0.2 + r() * 0.12));
    for (let i = 0; i < 40; i++) { // dây rủ ở mép giàn
      const u = r() * 2 * (W + D);
      const [x, z] = u < W ? [u - W / 2, -D / 2] : u < W + D ? [W / 2, u - W - D / 2] : u < 2 * W + D ? [u - W - D - W / 2, D / 2] : [-W / 2, u - 2 * W - D - D / 2];
      const n = 3 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) leaves.push(at(x + (r() - 0.5) * 0.15, H - 0.05 - k * 0.15, z + (r() - 0.5) * 0.15, Math.PI + (r() - 0.5) * 0.7, r() * TAU, 0.17 + r() * 0.08));
      if (r() < 0.45) umbel(x, H - 0.15 - n * 0.15 * r(), z, false);
    }
    for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) for (let k = 0; k < 10; k++) { // lá quấn cột
      const a = k * 1.3;
      leaves.push(at(x + Math.cos(a) * 0.09, 0.3 + (k / 10) * (H - 0.3), z + Math.sin(a) * 0.09, -0.4, -a + Math.PI / 2, 0.18));
    }
    for (let i = 0; i < 14; i++) umbel((r() - 0.5) * W, H + 0.2, (r() - 0.5) * D, true);
  }
  instanced(g, new THREE.CylinderGeometry(0.045, 0.05, 1, 6), mat(t, 0xa48d55), poles);
  instanced(g, new THREE.ShapeGeometry(heartShape(), 5), mat(t, 0xffffff, { side: THREE.DoubleSide }), leaves,
    () => [0x3e6b3a, 0x4f7f43, 0x2f5a34, 0x66924c][Math.floor(r() * 4)]);
  const fm = mat(t, 0xffffff, { emissive: 0xb8d07a, ei: 0.3, side: THREE.DoubleSide });
  fm.userData.glow = [0.2, 0.6]; // hoa thơm về đêm: sáng dần khi đảo sáng
  instanced(g, new THREE.ShapeGeometry(flowerShape(), 3), fm, flowers, (i) => fcol[i]);
  return g;
}

// --- HUD: chỉ đổi font và khung; màu chữ / điểm / nguy hiểm cố định theo Ticket-02 §8 ---
// Ticket-04: chữ UI ≥ 18 px ở 1280×720 và ×1.25 khi bật chữ lớn → mọi cỡ chữ nhân với --ui-scale (body.large-text đặt 1.25).
const px = (n: number) => `calc(${n}px * var(--ui-scale))`;
const HUD_BASE = `
:root { --ui-scale: 1; --ui-text: ${hex(PALETTE.uiText)}; --ui-score: ${hex(PALETTE.gold)}; --ui-danger: ${hex(PALETTE.uiDanger)}; }
body.large-text { --ui-scale: 1.25; }
#end { font-size: ${px(20)}; }
body { color: var(--ui-text); }
#hud b { color: var(--ui-score); }
#hud .danger { color: var(--ui-danger); animation: hud-blink 1s ease-in-out infinite; }
@keyframes hud-blink { 50% { opacity: .3; } }
#hud .cells { display: inline-flex; gap: 4px; margin-left: 8px; vertical-align: 1px; }
#hud .cells i { display: block; width: 10px; height: 10px; }
#prompt { color: var(--ui-text); }
#end h1 { color: var(--ui-score); }
@media (prefers-reduced-motion: reduce) { #hud .danger { animation: none; } }
`;
const FLOWER_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-12 -12 24 24'%3E%3Cg fill='%23dde6a0'%3E%3Cellipse id='p' cy='-6' rx='2.6' ry='5'/%3E%3Cuse href='%23p' transform='rotate(72)'/%3E%3Cuse href='%23p' transform='rotate(144)'/%3E%3Cuse href='%23p' transform='rotate(216)'/%3E%3Cuse href='%23p' transform='rotate(288)'/%3E%3C/g%3E%3Ccircle r='2' fill='%23a9c46e'/%3E%3C/svg%3E")`;

export const THEMES: Record<string, Theme> = {
  sonmai: {
    key: 'sonmai',
    name: 'Sơn Mài',
    blurb: 'Tranh sơn mài: mặt bóng sâu, thếp vàng, vỏ trứng rạn trên cỏ, đá son then gân vàng, khóm tre đốt vàng, biển mây vẽ mây cuộn vàng. Sang và ấm, hợp với cảnh đêm thắp đèn.',
    surface: 'lacquer', outline: 0, rock: 0x4a1a12, straw: 0xc9a35a, skin: 0xe9c29a, fog: 0.018,
    stars: { color: PALETTE.gold, count: 260, size: 6, paint: starPoly(6, 0.3, 0.2) },
    paintMoon: goldMoon, paintGround: eggshellGround, paintRock: goldVeinRock, paintSea: goldScrollSea,
    rockProfile: (r) => [[0.02, -0.55 * r], [0.3 * r, -0.45 * r], [0.62 * r, -0.28 * r], [0.86 * r, -0.12 * r], [0.97 * r, -0.03 * r], [r, 0]],
    clouds: 'puff', lantern: 'lathe', safeDash: 0, shadeRim: [1.05, 1],
    flora: bambooGroves, floraPer: 5, floraClear: 1.5, swarm: 50, moteCompanions: 0,
    hud: {
      font: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&display=swap',
      css: `
#hud, #prompt, #help, #end { font-family: 'Cormorant Garamond', Georgia, serif; }
#hud { font-size: ${px(19)}; font-weight: 600; line-height: 1.45; padding: 12px 20px 14px; border-radius: 2px; text-shadow: none;
  background: linear-gradient(170deg, #2b0f0a, #150706 65%, #0e1430);
  border: 1px solid #f2c14e8c; box-shadow: inset 0 0 0 4px #150706, inset 0 0 0 5px #f2c14e40, 0 8px 24px #000c; }
#hud b { font-weight: 700; font-variant-numeric: oldstyle-nums; }
#hud .cells i { width: 8px; height: 8px; margin: 1px; transform: rotate(45deg); border: 1px solid #f2c14e; }
#hud .cells i.on { background: #ffe58a; box-shadow: 0 0 6px #ffe58a; }
#prompt { font-size: ${px(24)}; font-style: italic; font-weight: 600; }
#end { background: radial-gradient(circle at 50% 45%, #2b0f0af0, #0e1430f5 70%); }
#end h1 { font-size: ${px(76)}; font-weight: 600; font-style: italic; }
#end h1::after { content: ''; display: block; height: 1px; width: 70%; margin: 6px auto 0; background: linear-gradient(90deg, transparent, #f2c14e, transparent); }
`,
    },
  },
  giaydo: {
    key: 'giaydo',
    name: 'Giấy Dó',
    blurb: 'Sách dựng hình bằng giấy dó: khối phẳng tô 3 nấc, viền mực chàm, cây cau và chuối cắt giấy đứng thẳng, biển mây xếp lớp giấy, đèn giấy xếp. Rõ hình, dễ đọc khi chơi nhanh.',
    surface: 'paper', outline: 0.06, rock: 0x7a6448, straw: 0xe3d3a8, skin: 0xf0cfa8, fog: 0.016,
    stars: { color: PALETTE.uiText, count: 140, size: 9, paint: starPoly(4, 0.1, 0) },
    paintMoon: paperMoon, paintGround: doPaperGround,
    rockProfile: (r) => [[0.02, -0.42 * r], [0.32 * r, -0.42 * r], [0.32 * r, -0.3 * r], [0.58 * r, -0.3 * r], [0.58 * r, -0.17 * r], [0.82 * r, -0.17 * r], [0.82 * r, -0.07 * r], [r, -0.07 * r], [r, 0]],
    clouds: 'scallop', lantern: 'accordion', safeDash: 36, shadeRim: [1.07, 1],
    flora: paperCutouts, floraPer: 7, floraClear: 1, swarm: 40, moteCompanions: 0,
    hud: {
      font: 'https://fonts.googleapis.com/css2?family=Bitter:wght@500;700;800&display=swap',
      css: `
#hud, #prompt, #help, #end { font-family: 'Bitter', Georgia, serif; }
#hud { font-size: ${px(18)}; font-weight: 500; line-height: 1.55; padding: 12px 18px; text-shadow: none; background: #1b2350;
  border-radius: 3px 14px 5px 11px / 12px 4px 13px 6px; box-shadow: 5px 6px 0 #c8102e, 9px 11px 0 #0e1430; }
#hud b { font-weight: 800; }
#hud .cells i { width: 11px; height: 14px; background: #0e1430; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
#hud .cells i.on { background: #ffe58a; }
#prompt { font-size: ${px(20)}; font-weight: 700; text-shadow: 2px 2px 0 #0e1430; }
#end { background: #0e1430e8; }
#end h1 { font-size: ${px(72)}; font-weight: 800; color: var(--ui-text); background: #c8102e; padding: 0 28px 4px; margin-bottom: 10px;
  border-radius: 4px 18px 6px 14px / 14px 5px 16px 6px; box-shadow: 7px 8px 0 #1b2350; transform: rotate(-2deg); }
`,
    },
  },
  chayshow: {
    key: 'chayshow',
    name: 'Đom Đóm · Chạy Show',
    blurb: 'Đêm diễn ở quê: Mây thành ca sĩ cách điệu (nón lá, áo diễn kim sa, micro), Đom đóm thành fan phát sáng giơ tim, mỗi Đèn Lồng là một sân khấu nhỏ (thắp xong thì bật đèn sân khấu và cột sáng rọi), Bóng Mực thành antifan trùm mũ với bong bóng chê bai. Nền: giàn thiên lý và bầy đom đóm.',
    surface: 'soft', outline: 0, rock: 0x4b3d2c, straw: 0xcdb27a, skin: 0xe8c4a0, fog: 0.026,
    stars: { color: 0xfff6dc, count: 700, size: 3, paint: dotStar },
    paintMoon: hazeMoon, paintGround: meadow,
    rockProfile: (r) => Array.from({ length: 9 }, (_, i): [number, number] => { const a = (i / 8) * (Math.PI / 2); return [r * Math.sin(a), -0.4 * r * Math.cos(a)]; }),
    clouds: 'puff', lantern: 'stage', show: true, safeDash: 0, shadeRim: [1.12, 0.5],
    flora: trellis, floraPer: 1, floraClear: 4.2, swarm: 260, moteCompanions: 2,
    hud: {
      font: 'https://fonts.googleapis.com/css2?family=Mali:wght@400;500;700&display=swap',
      css: `
#hud, #prompt, #help, #end { font-family: 'Mali', system-ui, sans-serif; }
#hud { font-size: ${px(18)}; font-weight: 500; line-height: 1.7; padding: 12px 70px 36px 18px; border-radius: 0; text-shadow: 0 0 6px #0e1430;
  background: radial-gradient(130% 120% at 0 0, #0e1430e0 35%, #0e143000 72%); }
#hud::before { content: ''; display: block; width: 24px; height: 24px; margin-bottom: 2px; background: ${FLOWER_SVG} center / contain no-repeat; }
#hud b { font-weight: 700; text-shadow: 0 0 10px #ffe58a80; }
#hud .cells { gap: 6px; }
#hud .cells i { width: 8px; height: 8px; border-radius: 50%; background: #f5f1e626; }
#hud .cells i.on { background: #fff6c2; box-shadow: 0 0 5px 2px #ffe58a, 0 0 14px 5px #ffe58a55; }
#prompt { font-size: ${px(20)}; text-shadow: 0 0 12px #0e1430, 0 0 3px #0e1430; }
#end { background: radial-gradient(circle at 50% 55%, #1b2350e6, #0e1430f7 70%); }
#end h1 { font-size: ${px(64)}; font-weight: 700; color: var(--ui-text); text-shadow: 0 0 22px #ffe58a, 0 0 3px #fff6c2; }
`,
      labels: { flame: 'Năng lượng', mote: 'Fan', lantern: 'Show', score: 'Cát-xê' },
      formatScore: (n) => `${n.toLocaleString('vi-VN')}k`, // 1250 → "1.250k"
    },
    music: import.meta.env.DEV ? '/music/nhac-nen.mp3' : undefined, // bản build không nhắc tới file nhạc
  },
};

/** Gắn font + CSS HUD của theme (dùng đúng id trong index.html: #hud, #prompt, #help, #end). */
export function applyHud(t: Theme, doc = document) {
  doc.getElementById('theme-hud-font')?.remove();
  doc.getElementById('theme-hud')?.remove();
  const link = Object.assign(doc.createElement('link'), { id: 'theme-hud-font', rel: 'stylesheet', href: t.hud.font });
  const style = Object.assign(doc.createElement('style'), { id: 'theme-hud', textContent: HUD_BASE + t.hud.css });
  doc.head.append(link, style);
}

// --- Đom đóm: Points + shader, lõi #FFF6C2 vẽ đặc (alpha 1) để giữ đúng hex, quầng #FFE58A mờ dần ---
const _v2 = new THREE.Vector2();
function fireflyPoints(n: number, blink: number, coreOn = 1) {
  const geo = new THREE.BufferGeometry();
  for (const [name, k] of [['position', 3], ['seed', 1], ['wander', 1], ['aSize', 1]] as const) geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * k), k));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBlink: { value: blink }, uScale: { value: 400 }, uCoreOn: { value: coreOn }, uCore: { value: new THREE.Color(PALETTE.moteCore) }, uHalo: { value: new THREE.Color(PALETTE.moteHalo) } },
    vertexShader: /* glsl */ `
      attribute float seed; attribute float wander; attribute float aSize;
      uniform float uTime; uniform float uBlink; uniform float uScale;
      varying float vGlow;
      void main() {
        float t = uTime * 0.45 + seed * 37.0;
        vec3 p = position + wander * vec3(sin(t) + 0.4 * sin(t * 2.7), 0.35 * sin(t * 1.3), cos(t * 0.8) + 0.4 * cos(t * 2.1));
        p.y += 0.12 * sin(uTime * 2.4 + seed * 61.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;
        vGlow = mix(1.0, smoothstep(-0.3, 1.0, sin(uTime * 1.6 + seed * 83.0)), uBlink);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCore; uniform vec3 uHalo; uniform float uCoreOn;
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = uCoreOn * (1.0 - smoothstep(0.22, 0.34, d));
        float a = max(core, pow(max(1.0 - d, 0.0), 2.0) * 0.85) * vGlow;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uHalo, uCore, core), a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  // Kích thước theo mét: cần chiều cao buffer và tiêu cự, lấy ngay trước khi vẽ.
  pts.onBeforeRender = (r, _s, cam) => { m.uniforms.uScale.value = r.getDrawingBufferSize(_v2).y * 0.5 * cam.projectionMatrix.elements[5]; };
  return pts;
}

/** Đom đóm nhặt được (theme Chạy Show: fan phát sáng cầm tim). Mỗi khung gọi set(danh sách pos [x, y, z] của sim); bay cao hơn mặt đất nơi đặt 0.6 m (Đêm 3 có tầng). */
export function makeFireflies(t: Theme, max = 64) {
  const k = 1 + t.moteCompanions, n = max * k, points = fireflyPoints(n, 0, t.show ? 0 : 1), geo = points.geometry;
  const xz = new Float32Array(max * 2), ys = new Float32Array(max), fans: THREE.InstancedMesh[] = [];
  if (t.show) { // thân + đầu màu lõi đom đóm (quầng vẫn do Points vẽ), tim hồng giơ trên đầu
    const body = mergeGeometries([new THREE.CapsuleGeometry(0.08, 0.14, 4, 8), new THREE.SphereGeometry(0.08, 10, 8).translate(0, 0.2, 0)]);
    const heart = new THREE.ShapeGeometry(heartShape(), 6).translate(0, -0.5, 0).rotateZ(Math.PI).scale(0.22, 0.22, 0.22);
    fans.push(new THREE.InstancedMesh(body, new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }), max),
      new THREE.InstancedMesh(heart, new THREE.MeshBasicMaterial({ color: 0xff5d8f, side: THREE.DoubleSide }), max));
    for (const m of fans) { m.count = 0; m.frustumCulled = false; points.add(m); }
  }
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) {
    const c = i % k;
    geo.getAttribute('seed').setX(i, (i * 0.618) % 1);
    geo.getAttribute('wander').setX(i, c ? 0.45 : 0);
    geo.getAttribute('aSize').setX(i, c ? 0.3 : 0.9);
  }
  geo.setDrawRange(0, 0);
  return {
    points,
    set(list: ArrayLike<ArrayLike<number>>) {
      const m = Math.min(list.length, max);
      for (let i = 0; i < m; i++) {
        for (let c = 0; c < k; c++) pos.setXYZ(i * k + c, list[i][0], list[i][1] + 0.6, list[i][2]);
        ys[i] = list[i][1];
        xz[i * 2] = list[i][0];
        xz[i * 2 + 1] = list[i][2];
      }
      pos.needsUpdate = true;
      geo.setDrawRange(0, m * k);
      for (const f of fans) f.count = m;
    },
    update(now: number) {
      (points.material as THREE.ShaderMaterial).uniforms.uTime.value = now;
      if (!fans.length) return;
      for (let i = 0; i < fans[0].count; i++) { // nhún cùng nhịp với quầng trong shader
        const y = ys[i] + 0.6 + 0.12 * Math.sin(now * 2.4 + ((i * k * 0.618) % 1) * 61);
        fans[0].setMatrixAt(i, _m.makeTranslation(xz[i * 2], y - 0.08, xz[i * 2 + 1]));
        fans[1].setMatrixAt(i, _m.makeRotationY(now * 1.6 + i).setPosition(xz[i * 2], y + 0.36, xz[i * 2 + 1]));
      }
      for (const f of fans) f.instanceMatrix.needsUpdate = true;
    },
  };
}

// Đổi tỉ lệ 0.15..0.70 của ticket sang cường độ đèn vật lý của three (×π), cộng 20% để 5/5 đèn cho màu cỏ gần hex chuẩn.
// ponytail: hiệu chỉnh bằng mắt + đọc pixel ở trang xem trước; đo lại với camera thật của game khi gắn vào main.ts.
const AMBIENT_GAIN = 1.2 * Math.PI;

// --- Môi trường: trời, sao, trăng, đảo, cầu tre, biển mây, cây cỏ, bầy đom đóm trang trí, ánh sáng ---
/** avoid: điểm cây cỏ phải tránh (đèn, điểm xuất phát, bục nhảy, bùa...). Đặt renderer.toneMapping = NoToneMapping. */
export function applyEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer, t: Theme, islands: Island[], bridges: Bridge[] = [], avoid: { x: number; z: number }[] = []) {
  renderer.toneMapping = THREE.NoToneMapping; // ACES làm lệch hex của Bảng màu chuẩn
  scene.background = new THREE.Color(PALETTE.sky);
  const fog = new THREE.FogExp2(PALETTE.fog, t.fog);
  scene.fog = fog;
  const COLD = new THREE.Color(0x9aa8e8), WARM = new THREE.Color(0xfff8f0);
  const hemi = new THREE.HemisphereLight(COLD, 0x2a2018, 1);
  const moon = new THREE.DirectionalLight(0xc8d0ff, 0.8);
  moon.position.set(-40, 60, -30);
  scene.add(hemi, moon);
  const r = rng(7);

  scene.add(new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(PALETTE.sky) }, uLow: { value: new THREE.Color(PALETTE.fog) } },
    vertexShader: 'varying float vY; void main() { vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uLow; varying float vY; void main() { gl_FragColor = vec4(mix(uLow, uTop, smoothstep(-0.02, 0.3, vY)), 1.0);\n#include <colorspace_fragment>\n}',
  })));
  const sp = new Float32Array(t.stars.count * 3);
  for (let i = 0; i < t.stars.count; i++) {
    const a = r() * TAU, y = 0.12 + 0.88 * r(), q = Math.sqrt(1 - y * y) * 360;
    sp.set([Math.cos(a) * q, y * 360, Math.sin(a) * q], i * 3);
  }
  scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)),
    new THREE.PointsMaterial({ color: t.stars.color, size: t.stars.size, map: canvasTex(32, 32, t.stars.paint), transparent: true, depthWrite: false, sizeAttenuation: false, fog: false })));
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, t.paintMoon), fog: false, depthWrite: false }));
  moonSprite.position.set(-220, 75, -250);
  moonSprite.scale.setScalar(55);
  scene.add(moonSprite);

  // Đảo: mặt cỏ, viền cát 1.2 m, khối đá bên dưới.
  const groundTex = canvasTex(512, 512, t.paintGround, 1);
  const rockTex = t.paintRock ? canvasTex(512, 256, t.paintRock, 1) : undefined;
  rockTex?.repeat.set(8, 1);
  for (const isl of islands) {
    const g = new THREE.Group();
    g.position.set(isl.cx, 0, isl.cz);
    scene.add(g);
    const tex = groundTex.clone();
    tex.repeat.setScalar(isl.r / 4); // ô 8 m
    tex.needsUpdate = true;
    add(g, new THREE.CircleGeometry(isl.r - 1.2, 96).rotateX(-Math.PI / 2), mat(t, 0xffffff, { map: tex }));
    add(g, new THREE.RingGeometry(isl.r - 1.2, isl.r, 96).rotateX(-Math.PI / 2), mat(t, PALETTE.sand));
    let rg: THREE.BufferGeometry = new THREE.LatheGeometry(t.rockProfile(isl.r).map(([x, y]) => new THREE.Vector2(x, y)), 72);
    if (t.surface === 'paper') { rg = rg.toNonIndexed(); rg.computeVertexNormals(); }
    add(g, rg, mat(t, rockTex ? 0xffffff : t.rock, { map: rockTex, side: THREE.DoubleSide }));
  }

  // Cầu tre: nan ngang mặt cầu (không lan can), hai dầm dọc, cột chìm xuống biển mây.
  const woodM = mat(t, PALETTE.wood);
  for (const b of bridges) {
    const len = b.x1 - b.x0, w = b.z1 - b.z0, zc = (b.z0 + b.z1) / 2, n = Math.round(len / 0.17);
    const list = Array.from({ length: n }, (_, i) => pose(b.x0 + ((i + 0.5) * len) / n, -0.08, zc + (r() - 0.5) * 0.12, Math.PI / 2, (r() - 0.5) * 0.06, 1, w + 0.4));
    instanced(scene, new THREE.CylinderGeometry(0.08, 0.08, 1, 7), mat(t, 0xffffff), list, () => _c.setHex(PALETTE.wood).offsetHSL(0, 0, (r() - 0.5) * 0.08).getHex());
    for (const z of [b.z0 + 0.3, b.z1 - 0.3]) {
      ink(t, add(scene, new THREE.CylinderGeometry(0.12, 0.12, len, 8).rotateZ(Math.PI / 2), woodM, (b.x0 + b.x1) / 2, -0.28, z));
      for (const x of [b.x0 + 2, (b.x0 + b.x1) / 2, b.x1 - 2]) ink(t, add(scene, new THREE.CylinderGeometry(0.13, 0.16, 8, 8), woodM, x, -4.3, z));
    }
  }

  // Biển mây: mặt phẳng + cụm mây (cầu dẹt bóng, hoặc giấy viền sóng xếp lớp).
  const seaY = -9, cx = islands.reduce((s, i) => s + i.cx, 0) / islands.length, cz = islands.reduce((s, i) => s + i.cz, 0) / islands.length;
  add(scene, new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial(t.paintSea ? { map: canvasTex(512, 512, t.paintSea, 45) } : { color: PALETTE.cloudSea }), cx, seaY, cz);
  const clouds = new THREE.Group();
  clouds.position.set(cx, 0, cz);
  scene.add(clouds);
  const puffs: THREE.Matrix4[] = [], shadows: THREE.Matrix4[] = [];
  for (let i = 0; i < 40 * islands.length; i++) {
    const isl = islands[i % islands.length], a = r() * TAU, d = isl.r * (0.85 + r() * 1.3), s = 4 + r() * 7;
    const x = isl.cx - cx + Math.cos(a) * d, z = isl.cz - cz + Math.sin(a) * d;
    if (t.clouds === 'scallop') {
      const y = seaY + 0.5 + Math.floor(r() * 4) * 0.7;
      puffs.push(new THREE.Matrix4().compose(_p.set(x, y, z), _q.identity(), _s.set(s, 1, s)));
      shadows.push(new THREE.Matrix4().compose(_p.set(x + 0.4, y - 0.25, z + 0.4), _q.identity(), _s.set(s * 1.04, 1, s * 1.04)));
    } else puffs.push(new THREE.Matrix4().compose(_p.set(x, seaY + 1 + r() * 3.5, z), _q.setFromEuler(_e.set(0, r() * TAU, 0)), _s.set(s * 1.5, s * 0.35, s)));
  }
  if (t.clouds === 'scallop') {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 112; i++) { const a = (i / 112) * TAU, d = 0.88 + 0.12 * Math.abs(Math.sin(a * 7)); if (i) shape.lineTo(Math.cos(a) * d, Math.sin(a) * d); else shape.moveTo(d, 0); }
    const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    instanced(clouds, geo, new THREE.MeshBasicMaterial({ color: 0x0a2230 }), shadows);
    instanced(clouds, geo, new THREE.MeshBasicMaterial(), puffs, () => _c.setHex(PALETTE.cloudSea).offsetHSL(0, 0, (r() - 0.3) * 0.08).getHex());
  } else instanced(clouds, new THREE.SphereGeometry(1, 16, 10), mat(t, PALETTE.cloudSea, { emissive: PALETTE.cloudSea, ei: 0.5 }), puffs);

  // Cây cỏ: chọn chỗ tất định, tránh vật quan trọng và hai đầu cầu.
  const fr = rng(11), keep = [...avoid, ...bridges.flatMap((b) => [{ x: b.x0, z: (b.z0 + b.z1) / 2 }, { x: b.x1, z: (b.z0 + b.z1) / 2 }])];
  const area = (isl: Island) => (isl.r / 16) ** 2, spots: Spot[] = [];
  for (const isl of islands) {
    const want = Math.max(1, Math.round(t.floraPer * area(isl)));
    for (let k = 0, tries = 0; k < want && tries < want * 60; tries++) {
      const a = fr() * TAU, d = Math.sqrt(fr()) * (isl.r - t.floraClear - 1.5), x = isl.cx + Math.cos(a) * d, z = isl.cz + Math.sin(a) * d;
      if (keep.some((p) => Math.hypot(p.x - x, p.z - z) < t.floraClear + 3) || spots.some((p) => Math.hypot(p.x - x, p.z - z) < 2 * t.floraClear + 1)) continue;
      spots.push({ x, z, yaw: fr() * TAU, s: 0.85 + fr() * 0.3 });
      k++;
    }
  }
  const flora = t.flora(t, spots);
  scene.add(flora);
  const glow: Mat[] = [];
  flora.traverse((o) => { const m = (o as THREE.Mesh).material as Mat | undefined; if (m?.userData?.glow) glow.push(m); });

  // Bầy đom đóm trang trí: một phần tụ quanh cụm cây; càng nhiều đèn sáng càng nhiều con quay về.
  const per = islands.map((i) => Math.round(t.swarm * area(i))), total = per.reduce((a, b) => a + b, 0);
  const swarm = fireflyPoints(total, 0.75), sg = swarm.geometry;
  let j = 0;
  islands.forEach((isl, k) => {
    const near = spots.filter((s) => Math.hypot(s.x - isl.cx, s.z - isl.cz) <= isl.r);
    for (let i = 0; i < per[k]; i++, j++) {
      const s = near.length && fr() < 0.65 ? near[Math.floor(fr() * near.length)] : undefined;
      const a = fr() * TAU, d = s ? fr() * (t.floraClear + 1.5) : Math.sqrt(fr()) * (isl.r - 2);
      const ox = s ? s.x : isl.cx, oz = s ? s.z : isl.cz;
      sg.getAttribute('position').setXYZ(j, ox + Math.cos(a) * d, s ? 0.4 + fr() * 2.4 : 0.3 + fr() * 1.3, oz + Math.sin(a) * d);
      sg.getAttribute('seed').setX(j, fr());
      sg.getAttribute('wander').setX(j, 0.6 + fr() * 1.4);
      sg.getAttribute('aSize').setX(j, 0.28 + fr() * 0.12);
    }
  });
  scene.add(swarm);

  // Sơn mài cần phản chiếu: env map dựng tại chỗ từ vài đốm đèn ấm và trăng vàng trên nền trời đêm.
  if (t.surface === 'lacquer') {
    const es = new THREE.Scene(), warm = new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit }), ball = new THREE.SphereGeometry(0.6, 8, 6);
    es.background = new THREE.Color(PALETTE.fog);
    for (let i = 0; i < 7; i++) add(es, ball, warm, Math.cos((i / 7) * TAU) * 6, 0.5 + (i % 3), Math.sin((i / 7) * TAU) * 6);
    add(es, new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: PALETTE.gold }), -5, 6, -4);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0.03).texture;
    pm.dispose();
  }

  return {
    /** f = số đèn đang sáng / tổng đèn (0..1). */
    setBrightness(f: number) {
      hemi.intensity = AMBIENT_GAIN * (0.15 + 0.55 * f); // Ticket-02 §8: 0.15 + 0.55·f
      hemi.color.lerpColors(COLD, WARM, f);
      fog.density = t.fog * (1 - 0.5 * f);
      sg.setDrawRange(0, Math.round(total * (0.45 + 0.55 * f)));
      for (const m of glow) m.emissiveIntensity = m.userData.glow[0] + m.userData.glow[1] * f;
      scene.environmentIntensity = 0.3 + 0.5 * f;
    },
    update(now: number) {
      (swarm.material as THREE.ShaderMaterial).uniforms.uTime.value = now;
      clouds.rotation.y = now * 0.004;
    },
  };
}

// --- Mây: áo #E8E2D0, khăn #C8102E, nón lá có đèn nhỏ treo trước vành. Nhìn theo +Z, cao ~1.86 m. ---
export function makePlayer(t: Theme) {
  const group = new THREE.Group(), body = new THREE.Group();
  group.add(body);
  blob(group, 0.55);
  const shirt = t.show ? mat(t, 0xffffff, { map: canvasTex(128, 128, sequins) }) : mat(t, PALETTE.shirt), pants = mat(t, 0x2c2a3c), scarf = mat(t, PALETTE.scarf);
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.3, 4, 8).translate(0, -0.24, 0);
  const legs = [-1, 1].map((s) => ink(t, add(body, legGeo, pants, s * 0.11, 0.5, 0)));
  ink(t, add(body, new THREE.CylinderGeometry(0.2, 0.33, 0.62, 18), shirt, 0, 0.8, 0));
  const armGeo = new THREE.CapsuleGeometry(0.065, 0.36, 4, 8).translate(0, -0.2, 0);
  const arms = [-1, 1].map((s) => { const a = ink(t, add(body, armGeo, shirt, s * 0.27, 1.06, 0)); a.rotation.z = s * 0.22; return a; });
  ink(t, add(body, new THREE.TorusGeometry(0.17, 0.06, 8, 20).rotateX(Math.PI / 2), scarf, 0, 1.11, 0));
  const tail = ink(t, add(body, new THREE.BoxGeometry(0.12, 0.42, 0.04).translate(0, -0.2, 0), scarf, 0.06, 1.12, -0.16));
  ink(t, add(body, new THREE.SphereGeometry(0.21, 20, 14), mat(t, t.skin), 0, 1.36, 0));
  const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6), eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.sky });
  for (const s of [-1, 1]) add(body, eyeGeo, eyeMat, s * 0.075, 1.37, 0.195);
  const mouth = t.show ? add(body, new THREE.SphereGeometry(0.035, 8, 6), eyeMat, 0, 1.28, 0.19) : undefined;
  if (t.show) { // ca sĩ cách điệu: micro trong tay phải, đưa lên trước miệng
    add(arms[1], new THREE.CylinderGeometry(0.024, 0.016, 0.16, 8), mat(t, 0x26222e), 0, -0.4, 0);
    add(arms[1], new THREE.SphereGeometry(0.05, 10, 8), mat(t, 0x8a8f9c), 0, -0.48, 0);
  }
  ink(t, add(body, new THREE.ConeGeometry(0.66, 0.36, 40, 1, true), mat(t, 0xffffff, { map: strawTex(t), side: THREE.DoubleSide }), 0, 1.68, 0), 0.5);
  const swing = new THREE.Group();
  swing.position.set(0.36, 1.53, 0.36);
  body.add(swing);
  add(swing, new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4).translate(0, -0.11, 0), mat(t, PALETTE.wood));
  const kind = t.lantern === 'stage' ? 'star' : t.lantern; // ca sĩ vẫn đội nón lá treo đèn nhỏ (PRD-0)
  const mini = add(swing, lanternGeo(kind), new THREE.MeshBasicMaterial({ map: glowTex(kind) }), 0, -0.3, 0);
  mini.scale.setScalar(0.24);
  const light = new THREE.PointLight(PALETTE.lanternLit, 12, 14); // main.ts điều khiển cường độ (chớp khi Tỏa sáng)
  light.position.set(0.36, 1.25, 0.36);
  group.add(light);
  return {
    group,
    light,
    update(now: number, moving: boolean) {
      const w = moving ? Math.sin(now * 10) : 0;
      body.position.y = moving ? Math.abs(w) * 0.05 : Math.sin(now * 2) * 0.008;
      legs[0].rotation.x = w * 0.5;
      legs[1].rotation.x = -w * 0.5;
      arms[0].rotation.x = -w * 0.4;
      arms[1].rotation.x = t.show ? -2.3 + w * 0.15 + Math.sin(now * 2) * 0.06 : w * 0.4;
      if (t.show) arms[1].rotation.z = -0.5;
      mouth?.scale.set(1, 0.35 + 0.65 * Math.abs(Math.sin(now * 5)), 0.6);
      swing.rotation.x = (moving ? -0.3 : 0) + Math.sin(now * 3.1) * 0.12;
      swing.rotation.z = Math.sin(now * 2.3) * 0.08;
      tail.rotation.x = moving ? 1 + Math.sin(now * 16) * 0.15 : 0.12 + Math.sin(now * 1.7) * 0.05;
      if (kind === 'star') mini.rotation.y = now * 0.8;
    },
  };
}

// --- Đèn Lồng Lớn: cột cong treo đèn, tâm đèn ở 2.75 m trên trục; 10 hạt quanh đèn; Vùng an toàn khi sáng ---
export function makeLantern(t: Theme, safeRadius = 6) {
  const group = new THREE.Group(), hang = new THREE.Group(), stage = t.lantern === 'stage', beams: THREE.Mesh[] = [];
  blob(group, stage ? 1.5 : 0.7, 0.4);
  const headMat = mat(t, PALETTE.lanternOff, { emissive: 0xffffff, ei: 0 });
  headMat.emissiveMap = glowTex(t.lantern);
  const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  let head: THREE.Mesh, pips: THREE.InstancedMesh;
  if (stage) {
    // Sân khấu nhỏ quay về +Z: bục gỗ, khung đèn, phông (tắt = xám, sáng = đèn sân khấu), 2 đèn rọi; 10 khán giả vòng cung phía trước.
    const dark = mat(t, 0x2a2433);
    add(group, new THREE.BoxGeometry(2.2, 0.45, 1.3), mat(t, PALETTE.wood), 0, 0.225, -0.3);
    for (const x of [-1.1, 1.1]) add(group, new THREE.BoxGeometry(0.12, 3.1, 0.12), dark, x, 1.55, -0.9);
    add(group, new THREE.BoxGeometry(2.34, 0.14, 0.14), dark, 0, 3.1, -0.9);
    head = add(group, new THREE.PlaneGeometry(2.08, 2.5), headMat, 0, 1.7, -0.86);
    const beamGeo = new THREE.ConeGeometry(0.7, 2.8, 20, 1, true).translate(0, -1.4, 0).rotateX(-Math.PI / 2); // đỉnh ở gốc, loe về +Z
    for (const x of [-0.8, 0.8]) {
      add(group, new THREE.CylinderGeometry(0.1, 0.14, 0.22, 10), dark, x, 2.95, -0.8);
      beams.push(add(group, beamGeo, beamMat, x, 2.9, -0.8));
    }
    pips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, 0.2, 4, 8), new THREE.MeshBasicMaterial(), 10);
    for (let i = 0; i < 10; i++) { const a = -1 + (i / 9) * 2; pips.setMatrixAt(i, _m.makeTranslation(Math.sin(a) * 1.8, 0.21, Math.cos(a) * 1.8 - 0.3)); }
  } else {
    ink(t, add(group, new THREE.CylinderGeometry(0.3, 0.4, 0.2, 10), mat(t, t.rock), 0, 0.1, -0.5));
    ink(t, add(group, new THREE.CylinderGeometry(0.07, 0.1, 3.4, 10), mat(t, PALETTE.wood), 0, 1.8, -0.5));
    ink(t, add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8).rotateX(Math.PI / 2), mat(t, PALETTE.wood), 0, 3.45, -0.22));
    hang.position.y = 3.45;
    group.add(hang);
    const trim = mat(t, t.surface === 'lacquer' ? PALETTE.gold : PALETTE.wood);
    add(hang, new THREE.CylinderGeometry(0.01, 0.01, 0.26, 4), trim, 0, -0.13, 0);
    head = ink(t, add(hang, lanternGeo(t.lantern), headMat, 0, -0.7, 0));
    if (t.lantern !== 'star') for (const y of [-0.27, -1.13]) ink(t, add(hang, new THREE.CylinderGeometry(0.13, 0.13, 0.07, 14), trim, 0, y, 0));
    add(hang, new THREE.CylinderGeometry(0.025, 0.01, 0.34, 5), mat(t, PALETTE.scarf), 0, t.lantern === 'star' ? -1.3 : -1.33, 0); // tua đỏ
    pips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial(), 10);
    for (let i = 0; i < 10; i++) pips.setMatrixAt(i, _m.makeTranslation(Math.cos((i / 10) * TAU + 0.3) * 0.72, 2.75, Math.sin((i / 10) * TAU + 0.3) * 0.72));
  }
  group.add(pips);
  const light = new THREE.PointLight(PALETTE.lanternLit, 0, 22);
  light.position.set(0, stage ? 2.4 : 2.75, stage ? 0.6 : 0);
  group.add(light);
  const safeMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(t.surface === 'lacquer' ? PALETTE.gold : PALETTE.lanternLit) }, uDash: { value: t.safeDash }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uDash; uniform float uTime; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        float edge = smoothstep(0.93, 0.975, r) * (1.0 - smoothstep(0.985, 1.0, r));
        float dash = uDash > 0.0 ? step(0.45, fract(atan(p.y, p.x) / 6.2832 * uDash + uTime * 0.05)) : 1.0;
        float a = edge * dash * 0.85 + 0.1 * (1.0 - smoothstep(0.2, 1.0, r));
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const safe = add(group, new THREE.CircleGeometry(safeRadius, 72).rotateX(-Math.PI / 2), safeMat, 0, 0.03, 0);
  let lit = false, prog = 0, fuel = 1, litAt = -99;
  return {
    group,
    light,
    setProgress(deposited: number, cost: number) { prog = cost > 0 ? Math.min(1, deposited / cost) : 0; },
    setLit(v: boolean) { lit = v; headMat.color.setHex(v ? 0x000000 : PALETTE.lanternOff); },
    /** 0..1. Dưới 0.3 (low_fuel 30/100): đèn và thanh dầu nhấp nháy 1 Hz, mất Vùng an toàn. Hạt quanh đèn = dầu khi sáng, = tiến độ Nạp khi tắt. */
    setFuel(f: number) { fuel = Math.max(0, Math.min(1, f)); },
    burst(now: number) { litAt = now; },
    /** deco: thời gian cho phần trang trí (đung đưa, đèn rọi quét, chập chờn); giảm chuyển động thì truyền hằng số. Nhấp nháy hết dầu vẫn theo now. */
    update(now: number, deco = now) {
      const e = Math.max(0, 1 - (now - litAt) / 1.2), low = lit && fuel < 0.3;
      const blink = low ? 0.55 + 0.45 * Math.cos(now * TAU) : 1;
      headMat.emissiveIntensity = lit ? (0.35 + 0.65 * fuel) * blink * (1 + 0.03 * Math.sin(deco * 9)) : 0.4 * prog;
      light.intensity = (lit ? 40 * (0.25 + 0.75 * fuel) * blink : 0) + 320 * e;
      head.scale.setScalar(1 + 0.25 * e * Math.sin(e * 9));
      hang.rotation.set(0.03 * Math.sin(deco * 1.1), t.lantern === 'star' ? deco * 0.5 : 0, 0.04 * Math.sin(deco * 1.3));
      safe.visible = lit && !low;
      safe.scale.setScalar(0.05 + 0.95 * (1 - (1 - Math.min(1, Math.max(0, now - litAt) / 0.6)) ** 3));
      safeMat.uniforms.uTime.value = deco;
      beamMat.opacity = lit ? 0.16 * blink : 0;
      beams.forEach((b, i) => b.lookAt(group.localToWorld(_p.set((i ? -0.3 : 0.3) + Math.sin(deco * 0.8 + i * 2) * 0.9, 0.45, 0.4 + Math.cos(deco * 0.6 + i) * 0.5))));
      const filled = Math.round(10 * (lit ? fuel : prog));
      for (let i = 0; i < 10; i++) pips.setColorAt(i, i < filled ? _c.setHex(lit ? PALETTE.lanternCore : PALETTE.moteCore).multiplyScalar(blink) : _c.setHex(0x262a36));
      pips.instanceColor!.needsUpdate = true;
    },
  };
}

// Antifan (theme Chạy Show): mũ trùm + bong bóng bình luận đổi câu ~2.5 s; Choáng thì "..." và mờ; đang hút thì đổi câu dồn dập.
// Câu chê chung chung về một ca sĩ hư cấu. Câu riêng của người chơi (meme) không nằm trong repo:
// skin.ts nạp thêm từ music/memes.json (gitignore) khi chạy vite dev.
export const HATER_LINES = ['Hát như karaoke', 'Flop rồi!', 'Hết thời', 'Ra bài mới đi', 'Unfollow!', 'Nghe chán quá', 'Ảo tưởng sức mạnh'];
let hecklers = 0;
function antifan(group: THREE.Object3D, body: THREE.Object3D) {
  add(body, new THREE.ConeGeometry(0.72, 0.95, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x241634, side: THREE.DoubleSide }), 0, 0.6, -0.08).rotation.x = -0.25;
  const W = 400, c = document.createElement('canvas');
  c.width = W;
  c.height = 120;
  const g = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Cỡ cố định trên màn hình (sizeAttenuation: false): chữ ~19 px ở 720p (camera 60°), đủ ngưỡng 18 px của Ticket-04; xa quá 22–32 m thì mờ dần.
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, sizeAttenuation: false }));
  bubble.scale.set((0.11 * W) / 120, 0.11, 1);
  bubble.center.set(0.2, 0); // đuôi bong bóng chỉ xuống đầu
  group.add(bubble);
  const offset = hecklers++ * 1.7;
  let shown = '', base = 1;
  bubble.onBeforeRender = (_r, _s, cam) => {
    const d = cam.position.distanceTo(bubble.getWorldPosition(_p));
    bubble.material.opacity = base * Math.min(1, Math.max(0, 1 - (d - 22) / 10));
  };
  const draw = (text: string) => {
    g.clearRect(0, 0, W, 120);
    g.fillStyle = hex(PALETTE.uiText);
    g.strokeStyle = hex(PALETTE.shadeRim);
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(6, 6, W - 12, 82, 22);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(66, 85);
    g.lineTo(54, 114);
    g.lineTo(100, 85);
    g.fill();
    g.beginPath();
    g.moveTo(66, 88);
    g.lineTo(54, 114);
    g.lineTo(100, 88);
    g.stroke();
    g.font = '700 34px system-ui, sans-serif';
    g.fillStyle = hex(PALETTE.shadeBody);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, 48, W - 30);
    tex.needsUpdate = true;
  };
  return (now: number, state: ShadeState) => {
    const text = state === 'stunned' ? '...' : HATER_LINES[Math.floor((now + offset) / (state === 'drain' ? 0.8 : 2.5)) % HATER_LINES.length];
    if (text !== shown) draw((shown = text));
    base = state === 'stunned' ? 0.35 : 1;
    bubble.position.y = 2.15 + 0.05 * Math.sin(now * 3 + offset);
  };
}

// --- Bóng Mực: khối mực #120A1A, viền + mắt #7A3CFF, Choáng #3A3450. Tâm thân ở y = 1 (sim: shade.pos là tâm). ---
export function makeShade(t: Theme) {
  const group = new THREE.Group(), body = new THREE.Group();
  body.position.y = 1;
  group.add(body);
  blob(group, 0.9, 0.55);
  const bodyMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeBody });
  const [rs, ro] = t.shadeRim;
  const core = add(body, new THREE.SphereGeometry(0.8, 28, 18), bodyMat);
  add(core, core.geometry, new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, side: THREE.BackSide, transparent: ro < 1, opacity: ro, depthWrite: ro >= 1 })).scale.setScalar(rs);
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim }), eyeGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const eyes = [-1, 1].map((s) => add(body, eyeGeo, eyeMat, s * 0.26, 0.18, 0.78));
  const dripGeo = new THREE.ConeGeometry(0.17, 0.75, 8).rotateX(Math.PI).translate(0, -0.3, 0);
  const drips = Array.from({ length: 5 }, (_, i) => add(body, dripGeo, bodyMat, Math.sin((i / 5) * TAU) * 0.42, -0.5, Math.cos((i / 5) * TAU) * 0.42));
  const starGeo = new THREE.ShapeGeometry(starShape(5, 0.1, 0.045)), starMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide });
  const stars = Array.from({ length: 3 }, () => add(body, starGeo, starMat));
  const sipMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore }), sipGeo = new THREE.SphereGeometry(0.085, 8, 6);
  const sips = Array.from({ length: 6 }, () => add(group, sipGeo, sipMat)); // dòng ánh sáng bị hút về phía +Z (hướng đèn)
  const heckle = t.show ? antifan(group, body) : undefined;
  let state: ShadeState = 'normal';
  const api = {
    group,
    /** 'drain': main.ts cho nhóm lookAt về đèn đang bị hút (≤ 2 m); trạng thái khác lookAt Mây như cũ. */
    setState(s: ShadeState) {
      state = s;
      bodyMat.color.setHex(s === 'stunned' ? PALETTE.shadeStunned : PALETTE.shadeBody);
      for (const o of stars) o.visible = s === 'stunned';
      for (const o of sips) o.visible = s === 'drain';
    },
    update(now: number) {
      const sp = state === 'stunned' ? 0.5 : state === 'drain' ? 2.2 : 1.4;
      body.scale.set(1 + 0.06 * Math.sin(now * 3.1 * sp), (state === 'stunned' ? 0.88 : 1) + 0.08 * Math.sin(now * 4 * sp + 1), 1 + 0.06 * Math.sin(now * 3.7 * sp + 2));
      body.position.y = 1 + 0.06 * Math.sin(now * 2);
      drips.forEach((d, i) => { d.rotation.set(0.25 * Math.sin(now * 3 * sp + i), 0, 0.25 * Math.cos(now * 2.6 * sp + i)); d.scale.y = state === 'drain' ? 1.4 : 1; });
      for (const e of eyes) e.scale.set(1, state === 'stunned' ? 0.25 : state === 'drain' ? 1.8 : 1.4, 0.6);
      stars.forEach((o, i) => { const a = now * 3 + (i * TAU) / 3; o.position.set(Math.cos(a) * 0.45, 0.95, Math.sin(a) * 0.45); o.rotation.y = -a; });
      sips.forEach((o, i) => { const f = (now * 0.9 + i / 6) % 1; o.position.set(0.1 * Math.sin(f * 9 + i), 1.3 - 0.3 * f, 2 - 1.4 * f); o.scale.setScalar(1 - 0.6 * f); });
      heckle?.(now, state);
    },
  };
  api.setState('normal');
  return api;
}

// --- Gió Lạc: dải lụa xám xanh #8FA3B8, đầu ở gốc, đuôi bay về −Z. ---
export function makeDrifter(t: Theme) {
  const group = new THREE.Group(), m = mat(t, PALETTE.drifter, { emissive: PALETTE.drifter, ei: 0.3, side: THREE.DoubleSide });
  const ribbons = ([[2.6, 0.34, 1.35, 0], [1.9, 0.18, 1.1, 1.9]] as const).map(([len, w, y, ph]) => {
    const geo = new THREE.PlaneGeometry(len, w, 36, 1).rotateY(Math.PI / 2).translate(0, y, -len / 2);
    add(group, geo, m);
    return { geo, base: Float32Array.from(geo.getAttribute('position').array), len, y, ph };
  });
  const knot = ink(t, add(group, new THREE.SphereGeometry(0.14, 14, 10), m, 0, 1.35, 0.05));
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.uiText });
  for (const s of [-1, 1]) add(knot, new THREE.SphereGeometry(0.03, 6, 4), eyeMat, s * 0.05, 0.03, 0.12);
  let speed = 4;
  return {
    group,
    setState(s: DrifterState) { speed = s === 'idle' ? 4 : s === 'chase' ? 7 : 10; },
    update(now: number) {
      for (const r of ribbons) {
        const p = r.geo.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          const z = r.base[i * 3 + 2], s = -z / r.len, dy = (r.base[i * 3 + 1] - r.y) * (1 - 0.7 * s);
          p.setXYZ(i, Math.sin(s * 5 - now * speed + r.ph) * 0.35 * s, r.y + dy + Math.sin(s * 7 - now * speed * 1.3 + r.ph) * 0.25 * s, z);
        }
        p.needsUpdate = true;
        r.geo.computeVertexNormals();
      }
      knot.position.y = 1.35 + 0.05 * Math.sin(now * 3);
    },
  };
}

// --- Bùa Gió: lá bùa đỏ #C8102E viền vàng #F2C14E, xoáy gió vàng; lơ lửng 1 m và xoay. ---
const talisman: Painter = (g, w, h) => {
  fill(g, PALETTE.scarf, w, h);
  g.strokeStyle = hex(PALETTE.gold);
  g.lineWidth = 8;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.lineWidth = 2;
  g.strokeRect(17, 17, w - 34, h - 34);
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < 4 * Math.PI; a += 0.1) { const d = 3 + a * 3.2; g.lineTo(w / 2 + Math.cos(a) * d, h * 0.4 + Math.sin(a) * d); }
  g.stroke();
  for (const [y, l] of [[0.7, 0.5], [0.78, 0.34], [0.86, 0.44]]) {
    g.beginPath();
    g.moveTo(w * (0.5 - l / 2), h * y);
    g.quadraticCurveTo(w * 0.5, h * (y - 0.035), w * (0.5 + l / 2), h * y);
    g.stroke();
  }
};
export function makeCharm(_t: Theme) {
  const group = new THREE.Group();
  const paper = add(group, new THREE.PlaneGeometry(0.42, 0.7), new THREE.MeshBasicMaterial({ map: canvasTex(120, 200, talisman), side: THREE.DoubleSide }), 0, 1, 0);
  const ring = add(group, new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.6, depthWrite: false }), 0, 0.03, 0);
  return {
    group,
    update(now: number) {
      paper.rotation.set(0, now * 1.4, Math.sin(now * 1.3) * 0.12);
      paper.position.y = 1 + Math.sin(now * 2) * 0.08;
      ring.scale.setScalar(1 + 0.08 * Math.sin(now * 3));
    },
  };
}

// --- Bục nhảy: nia tre đan bán kính 1 m, ba vòng vàng bay lên báo hiệu bật nhảy. ---
const tray: Painter = (g, s) => {
  fill(g, PALETTE.sand, s, s);
  g.strokeStyle = 'rgba(107,74,47,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos((i / 24) * TAU) * s, s / 2 + Math.sin((i / 24) * TAU) * s); g.stroke(); }
  for (let r = 14; r < s / 2; r += 12) { g.beginPath(); g.arc(s / 2, s / 2, r, 0, TAU); g.stroke(); }
  g.strokeStyle = hex(PALETTE.wood);
  g.lineWidth = 12;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 8, 0, TAU);
  g.stroke();
  g.strokeStyle = hex(PALETTE.gold);
  g.lineWidth = 8;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.16, 0, TAU);
  g.stroke();
};
export function makeJumpPad(t: Theme) {
  const group = new THREE.Group(), side = mat(t, PALETTE.wood);
  ink(t, add(group, new THREE.CylinderGeometry(1, 1.06, 0.14, 40), [side, mat(t, 0xffffff, { map: canvasTex(256, 256, tray) }), side], 0, 0.07, 0));
  const ringGeo = new THREE.TorusGeometry(0.75, 0.03, 6, 40).rotateX(Math.PI / 2);
  const rings = [0, 1, 2].map(() => add(group, ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, depthWrite: false })));
  return {
    group,
    update(now: number) {
      rings.forEach((o, i) => {
        const ph = (now * 0.6 + i / 3) % 1;
        o.position.y = 0.2 + ph * 1.5;
        o.scale.setScalar(1 - ph * 0.35);
        (o.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.7;
      });
    },
  };
}
