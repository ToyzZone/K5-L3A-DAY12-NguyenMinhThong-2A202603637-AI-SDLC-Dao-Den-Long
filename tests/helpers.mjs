// Chạy dist/headless.js đúng như máy chấm rồi đọc JSONL.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
let n = 0;

// Thế giới tĩnh: không tự sinh gì, chỉ có thứ test đặt vào.
export const QUIET = { random_motes: false, random_shades: false, motes: [], shades: [] };

export function run({ scenario, inputs, rawScenario, rawInputs, ticks = 60, seed = 1, every = 1, extraArgs = [] } = {}) {
  const id = ++n;
  const out = join(dir, `${id}.jsonl`);
  const args = ['dist/headless.js', '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every), ...extraArgs];
  if (scenario !== undefined || rawScenario !== undefined) {
    const f = join(dir, `${id}.scenario.json`);
    writeFileSync(f, rawScenario ?? JSON.stringify(scenario));
    args.push('--scenario', f);
  }
  if (inputs !== undefined || rawInputs !== undefined) {
    const f = join(dir, `${id}.inputs.json`);
    writeFileSync(f, rawInputs ?? JSON.stringify(inputs));
    args.push('--inputs', f);
  }
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (r.status !== 0) return { code: r.status, stderr: r.stderr };
  const raw = readFileSync(out, 'utf8');
  const lines = raw.trim().split('\n').map((l) => JSON.parse(l));
  return {
    code: 0,
    raw,
    lines,
    events: lines.filter((l) => l.type === 'event'),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    snap: (t) => lines.find((l) => l.type === 'snapshot' && l.tick === t),
    end: lines.at(-1),
  };
}

export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
