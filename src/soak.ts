// Soak test Ticket-04 §2: node dist/soak.js --seed 7 --nights 10 --out soak.json
// 10 Đêm headless trong cùng tiến trình (1 → 2 → 3 xoay vòng), Đêm thứ i (đếm từ 1) dùng seed + i.
import { writeFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { createWorld, idleInput, r3, step, type World } from './sim/game.js';
import { mulberry32 } from './sim/rng.js';
import { TPS } from './sim/tuning.js';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 1 ? process.argv[i + 1] : undefined; };
const int = (k: string, def: number) => { const v = arg(k) ?? String(def); if (!/^\d+$/.test(v)) { console.error(`soak: --${k} phải là số nguyên`); process.exit(1); } return Number(v); };
const seed = int('seed', 7), nights = int('nights', 10), out = arg('out');
if (!out || nights < 1) { console.error('cách dùng: node dist/soak.js --seed 7 --nights 10 --out soak.json'); process.exit(1); }

// Đo RSS sau khi dọn rác, để số đo là bộ nhớ còn giữ chứ không phải rác chưa thu (gc() không cần cờ --expose-gc).
setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;
const rssMb = () => { gc(); return r3(process.memoryUsage().rss / 2 ** 20); };

const t0 = performance.now();
const results: string[] = [];
let crashes = 0, memStart = 0;
let w: World | null = null;
for (let i = 1; i <= nights; i++) {
  try {
    w = createWorld(seed + i, {}, ((i - 1) % 3) + 1);
    if (i === 1) memStart = rssMb();
    const rnd = mulberry32((seed + i) ^ 0x5eed); // input có RNG riêng, không lấy chung RNG của World
    const inp = idleInput();
    for (let k = 0; w.state === 'playing' && k < w.map.duration_s * TPS; k++) {
      if (k % 30 === 0) { const a = rnd() * 2 * Math.PI; inp.move = [r3(Math.cos(a)), r3(Math.sin(a))]; }
      inp.jump = rnd() < 0.05;
      inp.dash = rnd() < 0.03;
      inp.pulse = rnd() < 0.02;
      inp.interact = rnd() < 0.1;
      step(w, inp);
    }
    results.push(w.state);
  } catch (e) {
    crashes++;
    results.push('crash');
    console.error(`soak: Đêm thứ ${i} lỗi:`, e);
  }
}
w = createWorld(seed, {}, 1); // reset sau Đêm cuối, như khi người chơi về menu chơi lại
const memEnd = rssMb();
writeFileSync(out, JSON.stringify({ nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: r3((performance.now() - t0) / 1000) }, null, 2) + '\n');
