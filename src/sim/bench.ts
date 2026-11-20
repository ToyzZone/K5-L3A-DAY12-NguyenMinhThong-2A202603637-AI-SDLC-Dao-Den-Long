// Cảnh benchmark chuẩn Ticket-04 §1: Đêm 1, đúng 200 Bóng Mực `wander` và 100 đom đóm rải đều trên đảo
// theo seed, L1–L3 sáng với fuel 100. Cờ `bench` tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm.
import { createWorld, r3, type Vec3, type World } from './game.js';
import { mulberry32 } from './rng.js';
import { RULES as R, WORLD } from './tuning.js';

export function benchWorld(seed: number): World {
  const rng = mulberry32(seed);
  // Đều theo diện tích trong đĩa bán kính đảo − 2 m (r = R·√u).
  const spread = (n: number, y: number): Vec3[] => Array.from({ length: n }, () => {
    const a = rng() * 2 * Math.PI, r = (WORLD.island_radius - 2) * Math.sqrt(rng());
    return [r3(r * Math.cos(a)), y, r3(r * Math.sin(a))];
  });
  const w = createWorld(seed, {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    motes: spread(100, 0),
    shades: spread(200, R.shade_y).map((pos) => ({ pos, state: 'wander' as const })),
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  }, 1);
  w.bench = true;
  return w;
}
