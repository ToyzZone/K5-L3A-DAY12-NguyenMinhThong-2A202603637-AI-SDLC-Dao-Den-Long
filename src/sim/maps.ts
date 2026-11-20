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

// ponytail: Đêm 3 (tầng, vách, dốc, tháp, gió) chưa làm; --night 3 báo lỗi rõ ràng.
export const MAPS: Record<number, NightMap> = { 1: night1, 2: night2 };
