// Kiểm tra file inputs / scenario theo Test Contract v1.0. Sai định dạng -> FormatError (headless thoát mã 2).
import { LANTERN_IDS, type Scenario, type Vec3 } from './game.js';

export class FormatError extends Error {}
export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}
type Obj = Record<string, unknown>;

function bad(msg: string): never {
  throw new FormatError(msg);
}
function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function obj(x: unknown, what: string): Obj {
  return isObj(x) ? x : bad(`${what} phải là object`);
}
function arr(x: unknown, what: string): unknown[] {
  return Array.isArray(x) ? x : bad(`${what} phải là mảng`);
}
function num(x: unknown, what: string): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : bad(`${what} phải là số`);
}
function int(x: unknown, what: string): number {
  const v = num(x, what);
  return Number.isInteger(v) && v >= 0 ? v : bad(`${what} phải là số nguyên ≥ 0`);
}
function bool(x: unknown, what: string): boolean {
  return typeof x === 'boolean' ? x : bad(`${what} phải là boolean`);
}
function vec3(x: unknown, what: string): Vec3 {
  const a = arr(x, what);
  if (a.length !== 3) bad(`${what} phải là [x, y, z]`);
  return [num(a[0], what), num(a[1], what), num(a[2], what)];
}

export function parseInputs(raw: unknown): Frame[] {
  const frames = arr(obj(raw, 'inputs').frames, 'frames');
  let last = -1;
  return frames.map((f0, i) => {
    const w = `frames[${i}]`;
    const f = obj(f0, w);
    const fr: Frame = { tick: int(f.tick, `${w}.tick`) };
    if (fr.tick <= last) bad(`${w}.tick phải tăng nghiêm ngặt`);
    last = fr.tick;
    if (f.move !== undefined) {
      const m = arr(f.move, `${w}.move`);
      if (m.length !== 2) bad(`${w}.move phải là [x, z]`);
      const x = num(m[0], `${w}.move`);
      const z = num(m[1], `${w}.move`);
      if (Math.abs(x) > 1 || Math.abs(z) > 1) bad(`${w}.move: mỗi thành phần trong [-1, 1]`);
      fr.move = [x, z];
    }
    if (f.cam_yaw_deg !== undefined) fr.cam_yaw_deg = num(f.cam_yaw_deg, `${w}.cam_yaw_deg`);
    for (const k of ['jump', 'interact', 'pulse', 'dash'] as const) {
      if (f[k] !== undefined) fr[k] = bool(f[k], `${w}.${k}`);
    }
    return fr;
  });
}

export function parseScenario(raw: unknown): Scenario {
  const s = obj(raw, 'scenario');
  const sc: Scenario = {};
  if (s.player !== undefined) {
    const p = obj(s.player, 'player');
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, 'player.pos');
    if (p.carried !== undefined) sc.player.carried = int(p.carried, 'player.carried');
    if (p.flames !== undefined) sc.player.flames = int(p.flames, 'player.flames');
  }
  if (s.random_motes !== undefined) sc.random_motes = bool(s.random_motes, 'random_motes');
  if (s.random_shades !== undefined) sc.random_shades = bool(s.random_shades, 'random_shades');
  if (s.motes !== undefined) sc.motes = arr(s.motes, 'motes').map((m, i) => vec3(m, `motes[${i}]`));
  if (s.shades !== undefined) {
    const ids = new Set<string>();
    sc.shades = arr(s.shades, 'shades').map((x, i) => {
      const o = obj(x, `shades[${i}]`);
      const shade: { id?: string; pos: Vec3 } = { pos: vec3(o.pos, `shades[${i}].pos`) };
      if (o.id !== undefined) {
        if (typeof o.id !== 'string' || !o.id) bad(`shades[${i}].id phải là chuỗi`);
        if (ids.has(o.id)) bad(`shades[${i}].id trùng: ${o.id}`);
        ids.add(o.id);
        shade.id = o.id;
      }
      return shade;
    });
  }
  if (s.lanterns !== undefined) {
    sc.lanterns = arr(s.lanterns, 'lanterns').map((x, i) => {
      const o = obj(x, `lanterns[${i}]`);
      if (typeof o.id !== 'string' || !LANTERN_IDS.includes(o.id)) bad(`lanterns[${i}].id phải là một trong ${LANTERN_IDS.join(', ')}`);
      const l: { id: string; pos?: Vec3; lit?: boolean; deposited?: number } = { id: o.id };
      if (o.pos !== undefined) l.pos = vec3(o.pos, `lanterns[${i}].pos`);
      if (o.lit !== undefined) l.lit = bool(o.lit, `lanterns[${i}].lit`);
      if (o.deposited !== undefined) l.deposited = int(o.deposited, `lanterns[${i}].deposited`);
      return l;
    });
  }
  if (s.time_left_s !== undefined) {
    const v = num(s.time_left_s, 'time_left_s');
    if (v < 0) bad('time_left_s phải ≥ 0');
    sc.time_left_s = v;
  }
  return sc;
}
