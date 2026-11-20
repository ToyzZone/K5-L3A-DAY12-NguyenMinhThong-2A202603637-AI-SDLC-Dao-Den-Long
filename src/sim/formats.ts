// Kiểm tra file inputs / scenario theo Test Contract v1.1. Sai định dạng -> FormatError (headless thoát mã 2).
import { lanternIds, type Scenario, type ShadeState, type Vec3 } from './game.js';

export class FormatError extends Error {}
export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}
type Obj = Record<string, unknown>;
const SHADE_STATES: ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];

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
function str(x: unknown, what: string): string {
  return typeof x === 'string' && x ? x : bad(`${what} phải là chuỗi`);
}
function vec3(x: unknown, what: string): Vec3 {
  const a = arr(x, what);
  if (a.length !== 3) bad(`${what} phải là [x, y, z]`);
  return [num(a[0], what), num(a[1], what), num(a[2], what)];
}
const opt = <T>(o: Obj, k: string, f: (x: unknown, what: string) => T, what: string): T | undefined =>
  o[k] === undefined ? undefined : f(o[k], `${what}.${k}`);

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
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (f[k] !== undefined) fr[k] = bool(f[k], `${w}.${k}`);
    }
    return fr;
  });
}

export function parseScenario(raw: unknown, night = 1): Scenario {
  const s = obj(raw, 'scenario');
  const sc: Scenario = {};
  if (s.player !== undefined) {
    const p = obj(s.player, 'player');
    sc.player = {
      pos: opt(p, 'pos', vec3, 'player'),
      carried: opt(p, 'carried', int, 'player'),
      flames: opt(p, 'flames', int, 'player'),
      invuln_ticks: opt(p, 'invuln_ticks', int, 'player'),
      dash_cd_ticks: opt(p, 'dash_cd_ticks', int, 'player'),
      pulse_cd_ticks: opt(p, 'pulse_cd_ticks', int, 'player'),
      charm_ticks: opt(p, 'charm_ticks', int, 'player'),
      successful_lights: opt(p, 'successful_lights', int, 'player'),
    };
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (s[k] !== undefined) sc[k] = bool(s[k], k);
  }
  if (s.motes !== undefined) sc.motes = arr(s.motes, 'motes').map((m, i) => vec3(m, `motes[${i}]`));
  if (s.shades !== undefined) {
    const ids = new Set<string>();
    sc.shades = arr(s.shades, 'shades').map((x, i) => {
      const w = `shades[${i}]`;
      const o = obj(x, w);
      const id = opt(o, 'id', str, w);
      if (id !== undefined && ids.has(id)) bad(`${w}.id trùng: ${id}`);
      if (id !== undefined) ids.add(id);
      const state = opt(o, 'state', str, w);
      if (state !== undefined && !SHADE_STATES.includes(state as ShadeState)) bad(`${w}.state phải là một trong ${SHADE_STATES.join(', ')}`);
      return { id, pos: vec3(o.pos, `${w}.pos`), state: state as ShadeState | undefined, state_ticks_left: opt(o, 'state_ticks_left', int, w), target_lantern_id: opt(o, 'target_lantern_id', str, w) };
    });
  }
  if (s.drifters !== undefined) {
    sc.drifters = arr(s.drifters, 'drifters').map((x, i) => {
      const w = `drifters[${i}]`;
      const o = obj(x, w);
      return { id: opt(o, 'id', str, w), pos: vec3(o.pos, `${w}.pos`), state: opt(o, 'state', str, w), stolen: opt(o, 'stolen', int, w) };
    });
  }
  if (s.charms !== undefined) {
    sc.charms = arr(s.charms, 'charms').map((x, i) => {
      const w = `charms[${i}]`;
      const o = obj(x, w);
      return { id: opt(o, 'id', str, w), pos: vec3(o.pos, `${w}.pos`), available: opt(o, 'available', bool, w) };
    });
  }
  if (s.lanterns !== undefined) {
    const valid = lanternIds(night);
    sc.lanterns = arr(s.lanterns, 'lanterns').map((x, i) => {
      const w = `lanterns[${i}]`;
      const o = obj(x, w);
      if (typeof o.id !== 'string' || !valid.includes(o.id)) bad(`${w}.id phải là một trong ${valid.join(', ')}`);
      return { id: o.id, pos: opt(o, 'pos', vec3, w), lit: opt(o, 'lit', bool, w), deposited: opt(o, 'deposited', int, w), fuel: opt(o, 'fuel', num, w), ever_lit: opt(o, 'ever_lit', bool, w) };
    });
  }
  if (s.time_left_s !== undefined) {
    const v = num(s.time_left_s, 'time_left_s');
    if (v < 0) bad('time_left_s phải ≥ 0');
    sc.time_left_s = v;
  }
  return sc;
}
