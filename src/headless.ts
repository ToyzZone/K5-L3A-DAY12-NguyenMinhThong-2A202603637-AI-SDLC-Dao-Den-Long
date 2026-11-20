// Chế độ headless theo Test Contract v1.0.
// node dist/headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out f.jsonl [--snapshot-every 10]
import { readFileSync, writeFileSync } from 'node:fs';
import { createWorld, idleInput, snapshot, step } from './sim/game.js';
import { parseInputs, parseScenario } from './sim/formats.js';

function fail(code: number, msg: string): never {
  process.stderr.write(`headless: ${msg}\n`);
  process.exit(code);
}

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const k = argv[i];
  const v = argv[i + 1];
  if (!k.startsWith('--') || v === undefined) fail(1, `tham số không hợp lệ gần "${k}"`);
  args.set(k.slice(2), v);
}

function intArg(name: string, def?: number): number {
  const v = args.get(name);
  if (v === undefined) return def ?? fail(1, `thiếu --${name}`);
  if (!/^-?\d+$/.test(v)) fail(1, `--${name} phải là số nguyên`);
  return Number(v);
}

function load<T>(name: string, parse: (raw: unknown) => T): T | undefined {
  const path = args.get(name);
  if (path === undefined) return undefined;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(1, `không đọc được ${path}`);
  }
  try {
    return parse(JSON.parse(text));
  } catch (e) {
    fail(2, `--${name} sai định dạng: ${(e as Error).message}`);
  }
}

const seed = intArg('seed');
const ticks = intArg('ticks');
const every = intArg('snapshot-every', 10);
const out = args.get('out') ?? fail(1, 'thiếu --out');
if (intArg('night', 1) !== 1) fail(1, 'chỉ có --night 1');
if (ticks < 0 || every < 1) fail(1, '--ticks phải ≥ 0 và --snapshot-every phải ≥ 1');
const frames = load('inputs', parseInputs) ?? [];
const scenario = load('scenario', parseScenario) ?? {};

const w = createWorld(seed, scenario);
const lines = [JSON.stringify(snapshot(w))];
const input = idleInput();
let fi = 0;
for (let k = 0; k < ticks && w.state === 'playing'; k++) {
  for (; fi < frames.length && frames[fi].tick <= k; fi++) {
    const { tick: _, ...changes } = frames[fi];
    Object.assign(input, changes);
  }
  for (const e of step(w, input)) lines.push(JSON.stringify({ type: 'event', tick: e.tick, name: e.name, data: e.data }));
  if (w.tick % every === 0) lines.push(JSON.stringify(snapshot(w)));
}
lines.push(JSON.stringify({ type: 'end', ticks: w.tick, state: w.state, score: w.score }));
try {
  writeFileSync(out, lines.join('\n') + '\n');
} catch {
  fail(1, `không ghi được ${out}`);
}
