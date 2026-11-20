// Bản đồ chuẩn Ticket-02 (Phần 2). Góc đo từ +X; điểm ở góc θ là (r·cosθ, y, r·sinθ)
// (khớp ticket: tầng 1 Đêm 3 "z > 0" ứng với góc 20°–160°).
type V3 = [number, number, number];
export interface JumpPad { pos: V3; target: V3; vy: number; vh: number }
export interface NightMap {
  night: number;
  duration_s: number;
  start: V3;
  lanterns: V3[];
  motePoints: V3[];
  shadePoints: V3[];
  shadeEvery: number; // tick
  shadeMax: number;
  shadeSpeed: number;
  charms: V3[];
  pads: JumpPad[];
  drifters: boolean; // Gió Lạc tự sinh (Đêm 2, 3)
  wind?: boolean; // gió mạnh (Đêm 3)
  ground: (x: number, z: number) => number | null; // null = không có đất (rơi)
}

const r3 = (x: number) => Math.round(x * 1000) / 1000 || 0;
function ring(n: number, r: number, startDeg: number, stepDeg: number, cx = 0, y = 0): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + i * stepDeg) * Math.PI) / 180;
    return [r3(cx + r * Math.cos(a)), y, r3(r * Math.sin(a))];
  });
}
const within = (x: number, z: number, cx: number, cz: number, r: number) => Math.hypot(x - cx, z - cz) <= r;

const night1: NightMap = {
  night: 1,
  duration_s: 240,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadePoints: ring(12, 37, 15, 30),
  shadeEvery: 480,
  shadeMax: 6,
  shadeSpeed: 4,
  charms: [],
  pads: [],
  drifters: false,
  ground: (x, z) => (within(x, z, 0, 0, 40) ? 0 : null),
};

const night2: NightMap = {
  night: 2,
  duration_s: 270,
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [0, 70].flatMap((cx) => [...ring(4, 10, 0, 90, cx), ...ring(8, 22, 0, 45, cx)]),
  shadePoints: [0, 70].flatMap((cx) => ring(8, 26, 22.5, 45, cx)),
  shadeEvery: 420,
  shadeMax: 8,
  shadeSpeed: 4,
  charms: [[35, 0, 0]],
  pads: [
    { pos: [20, 0, 18], target: [70, 0, 0], vy: 14, vh: 24 },
    { pos: [50, 0, -18], target: [0, 0, 0], vy: 14, vh: 24 },
  ],
  drifters: true,
  ground: (x, z) => (within(x, z, 0, 0, 28) || within(x, z, 70, 0, 28) || (x >= 26 && x <= 44 && Math.abs(z) <= 2) ? 0 : null),
};

// Đêm 3: mỗi điểm (x, z) là một cột đặc; ground = đỉnh cột. Vách đứng sinh ra tự nhiên vì
// game.ts chặn bước ngang khi đỉnh cột mới cao hơn chân Mây quá STEP_UP.
function night3Ground(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  let h = 0;
  if (r >= 12 && r <= 24 && z > 0) h = 3; // tầng 1: vành khăn nửa z > 0
  for (const deg of [30, 150]) { // dốc rộng 3 m: chân r 30 (Y 0) -> đỉnh r 24 (Y 3)
    const a = (deg * Math.PI) / 180;
    const along = x * Math.cos(a) + z * Math.sin(a);
    const lateral = Math.abs(-x * Math.sin(a) + z * Math.cos(a));
    if (lateral <= 1.5 && along >= 24 && along <= 30) h = Math.max(h, (3 * (30 - along)) / 6);
  }
  if (r <= 8) h = 6; // tầng 2
  if (r <= 2) h = 14; // tháp chuông cao 8 m trên tầng 2, không leo được
  return h;
}

const night3: NightMap = {
  night: 3,
  duration_s: 300,
  start: [0, 0, -28], // giả định: tâm đảo là tháp chuông nên xuất phát ở tầng 0 phía nam
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(18, 34, 0, 20), ...ring(8, 18, 20, 20, 0, 3), ...ring(4, 5, 45, 90, 0, 6)],
  shadePoints: ring(16, 43, 0, 22.5),
  shadeEvery: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  charms: [[30, 0, 25], [-30, 0, 25]],
  pads: [{ pos: [0, 3, 13], target: [0, 3, 0], vy: 12, vh: 8 }],
  drifters: true,
  wind: true,
  ground: night3Ground,
};

export const MAPS: Record<number, NightMap> = { 1: night1, 2: night2, 3: night3 };
