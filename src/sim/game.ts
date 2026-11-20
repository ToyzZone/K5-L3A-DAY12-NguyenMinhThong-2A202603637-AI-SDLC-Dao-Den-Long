// Lõi mô phỏng Đảo Đèn Lồng: thuần, tất định, không DOM, không Three.js.
// Dùng chung cho headless (src/headless.ts) và giao diện (src/web/).
// Luật: docs/notes/phase-1.md (Q1–Q21). Thứ tự trong một bước theo Q16.
import { TUNING as T, WORLD as W, TPS } from './tuning.js';
import { mulberry32 } from './rng.js';

export type Vec3 = [number, number, number];
export type GameState = 'playing' | 'won' | 'lost';
export interface Input {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}
export interface Mote { id: string; pos: Vec3 }
// stunUntil: Bóng Mực Choáng ở mọi tick T < stunUntil.
export interface Shade { id: string; pos: Vec3; stunUntil: number }
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number }
// invulnUntil / pulseReadyAt: tick sớm nhất được bị chạm lại / được Tỏa sáng lại.
export interface Player { pos: Vec3; vy: number; flames: number; carried: number; invulnUntil: number; pulseReadyAt: number }
export interface GameEvent { tick: number; name: string; data: Record<string, unknown> }
export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number }[];
  time_left_s?: number;
}
export interface World {
  tick: number;
  ticksLeft: number;
  state: GameState;
  score: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  randomMotes: boolean;
  randomShades: boolean;
  nextShadeSpawn: number;
  moteSeq: number;
  shadeSeq: number;
  rng: () => number;
  prev: { jump: boolean; interact: boolean; pulse: boolean };
}

export const LANTERN_IDS = Array.from({ length: T.lantern_count_night1 }, (_, i) => `L${i + 1}`);
export const idleInput = (): Input => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false });

// ponytail: dung sai cho "≤ r" vì vị trí cộng dồn float không rơi đúng biên.
const EPS = 1e-6;
// Đẩy ra hẳn ngoài safe_radius để tọa độ đã làm tròn 3 số vẫn đọc là "ngoài vùng".
const SAFE_MARGIN = 0.01;
const toTicks = (s: number) => Math.round(s * TPS);
export const r3 = (x: number) => Math.round(x * 1000) / 1000 || 0;
export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const byId = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
export const isStunned = (s: Shade, tick: number) => tick < s.stunUntil;

export function createWorld(seed: number, sc: Scenario = {}): World {
  const w: World = {
    tick: 0,
    ticksLeft: toTicks(sc.time_left_s ?? T.night1_duration_s),
    state: 'playing',
    score: 0,
    player: {
      pos: sc.player?.pos ? [...sc.player.pos] : [0, 0, 0],
      vy: 0,
      flames: sc.player?.flames ?? T.flames,
      carried: sc.player?.carried ?? 0,
      invulnUntil: 0,
      pulseReadyAt: 0,
    },
    lanterns: LANTERN_IDS.map((id, i) => {
      const a = (i * 2 * Math.PI) / LANTERN_IDS.length;
      return { id, pos: [r3(W.lantern_ring_radius * Math.sin(a)), 0, r3(W.lantern_ring_radius * Math.cos(a))], lit: false, deposited: 0 };
    }),
    shades: [],
    motes: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    nextShadeSpawn: toTicks(W.shade_spawn_every_s),
    moteSeq: 0,
    shadeSeq: 0,
    rng: mulberry32(seed),
    prev: { jump: false, interact: false, pulse: false },
  };
  for (const u of sc.lanterns ?? []) {
    const l = w.lanterns.find((x) => x.id === u.id);
    if (!l) throw new Error(`không có đèn ${u.id}`); // parseScenario đã chặn trước
    if (u.pos) l.pos = [...u.pos];
    if (u.lit !== undefined) l.lit = u.lit;
    if (u.deposited !== undefined) l.deposited = u.deposited;
  }
  if (sc.motes) for (const pos of sc.motes) w.motes.push({ id: `M${++w.moteSeq}`, pos: [...pos] });
  else if (w.randomMotes) for (let i = 0; i < W.motes_target; i++) spawnMote(w);
  if (sc.shades) {
    const reserved = new Set(sc.shades.flatMap((s) => (s.id ? [s.id] : [])));
    for (const s of sc.shades) w.shades.push({ id: s.id ?? newShadeId(w, reserved), pos: [...s.pos], stunUntil: 0 });
  } else if (w.randomShades) for (let i = 0; i < W.shade_start_count; i++) spawnShade(w);
  return w;
}

function newShadeId(w: World, reserved: Set<string> = new Set()): string {
  let id: string;
  do id = `S${++w.shadeSeq}`;
  while (reserved.has(id) || w.shades.some((s) => s.id === id));
  return id;
}

// ponytail: thử ngẫu nhiên 30 lần rồi chấp nhận điểm cuối; đủ cho đảo 40 m.
function spawnMote(w: World): void {
  let pos: Vec3 = [0, 0, 0];
  for (let i = 0; i < 30; i++) {
    const a = w.rng() * 2 * Math.PI;
    const r = W.mote_spawn_radius * Math.sqrt(w.rng());
    pos = [r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))];
    if (distXZ(pos, w.player.pos) >= W.mote_min_dist_from_player) break;
  }
  w.motes.push({ id: `M${++w.moteSeq}`, pos });
}

function spawnShade(w: World): Shade {
  let pos: Vec3 = [0, W.shade_y, 0];
  for (let i = 0; i < 30; i++) {
    const a = w.rng() * 2 * Math.PI;
    pos = [r3(W.shade_spawn_radius * Math.sin(a)), W.shade_y, r3(W.shade_spawn_radius * Math.cos(a))];
    const farFromPlayer = distXZ(pos, w.player.pos) >= W.shade_min_dist_from_player;
    const inSafeZone = w.lanterns.some((l) => l.lit && distXZ(pos, l.pos) <= T.safe_radius + EPS);
    if (farFromPlayer && !inSafeZone) break;
  }
  const s: Shade = { id: newShadeId(w), pos, stunUntil: 0 };
  w.shades.push(s);
  return s;
}

// Vùng an toàn chỉ quanh đèn đã Thắp (Q5 = b). Bóng Mực trong vùng bị đặt ra mép.
function pushOutOfSafeZones(w: World, s: Shade): void {
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    const d = distXZ(s.pos, l.pos);
    if (d > T.safe_radius + EPS) continue;
    const [ux, uz] = d > 1e-9 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
    s.pos[0] = l.pos[0] + ux * (T.safe_radius + SAFE_MARGIN);
    s.pos[2] = l.pos[2] + uz * (T.safe_radius + SAFE_MARGIN);
  }
}

// Bước k: đọc input của tick k, tạo trạng thái k+1. Sự kiện ghi tick = k+1.
export function step(w: World, inp: Input): GameEvent[] {
  const events: GameEvent[] = [];
  if (w.state !== 'playing') return events;
  const t = w.tick + 1;
  const emit = (name: string, data: Record<string, unknown>) => events.push({ tick: t, name, data });
  const p = w.player;
  const edge = (k: 'jump' | 'interact' | 'pulse') => inp[k] && !w.prev[k];

  // 1. Mây di chuyển theo hướng camera, nhảy.
  let [mx, mz] = inp.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (inp.cam_yaw_deg * Math.PI) / 180;
  const dx = mx * Math.cos(th) + mz * Math.sin(th);
  const dz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += (dx * T.player_speed) / TPS;
  p.pos[2] += (dz * T.player_speed) / TPS;
  const fromCenter = Math.hypot(p.pos[0], p.pos[2]);
  if (fromCenter > W.island_radius) { // fall_enabled = false: chặn ở mép đảo
    p.pos[0] *= W.island_radius / fromCenter;
    p.pos[2] *= W.island_radius / fromCenter;
  }
  if (edge('jump') && p.pos[1] <= 0) p.vy = W.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= W.gravity / TPS;
    p.pos[1] += p.vy / TPS;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 2. Nhặt tự động: gần trước, hòa thì theo id, tới khi đầy.
  const inReach = w.motes
    .map((m) => ({ m, d: distXZ(m.pos, p.pos) }))
    .filter((x) => x.d <= T.pickup_radius + EPS)
    .sort((a, b) => a.d - b.d || byId(a.m.id, b.m.id));
  for (const { m } of inReach) {
    if (p.carried >= T.carry_capacity) break;
    w.motes.splice(w.motes.indexOf(m), 1);
    p.carried += 1;
    w.score += T.score.per_mote;
    emit('mote_picked', { carried: p.carried });
    if (w.randomMotes) spawnMote(w);
  }

  // 3. Nạp vào đèn chưa Thắp gần nhất trong interact_radius.
  if (edge('interact') && p.carried > 0) {
    const target = w.lanterns
      .filter((l) => !l.lit && distXZ(l.pos, p.pos) <= T.interact_radius + EPS)
      .sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos) || byId(a.id, b.id))[0];
    const amount = target ? Math.min(p.carried, T.lantern_cost - target.deposited) : 0;
    if (target && amount > 0) {
      p.carried -= amount;
      target.deposited += amount;
      emit('deposit', { lantern_id: target.id, amount, deposited: target.deposited });
      if (target.deposited >= T.lantern_cost) {
        target.lit = true;
        w.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: target.id });
      }
    }
  }

  // 4. Tỏa sáng.
  if (edge('pulse') && t >= p.pulseReadyAt && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseReadyAt = t + toTicks(T.pulse_cooldown_s);
    const stunned: string[] = [];
    for (const s of w.shades) {
      const d = distXZ(s.pos, p.pos);
      if (d > T.pulse_radius + EPS) continue;
      if (!isStunned(s, t - 1)) w.score += T.score.per_stun; // Q21: con đang Choáng không cộng điểm lại
      s.stunUntil = t + toTicks(T.pulse_stun_s);
      const [ux, uz] = d > 1e-9 ? [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d] : [0, 1];
      s.pos[0] += ux * T.pulse_push_m;
      s.pos[2] += uz * T.pulse_push_m;
      stunned.push(s.id);
    }
    emit('pulse', { stunned_ids: stunned });
  }

  // 5. Bóng Mực: sinh theo nhịp, đuổi Mây, bị chặn bởi Vùng an toàn.
  if (w.randomShades && t >= w.nextShadeSpawn) {
    w.nextShadeSpawn += toTicks(W.shade_spawn_every_s);
    if (w.shades.length < W.shade_max) emit('shade_spawned', { id: spawnShade(w).id });
  }
  for (const s of w.shades) {
    if (!isStunned(s, t)) {
      const d = distXZ(s.pos, p.pos);
      if (d > 1e-9) {
        const stepLen = Math.min(T.shade_speed / TPS, d);
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * stepLen;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * stepLen;
      }
    }
    pushOutOfSafeZones(w, s);
  }

  // 6. Va chạm: tối đa 1 Flame mỗi bước, Bóng Mực Choáng vô hại.
  if (t >= p.invulnUntil) {
    const hitter = w.shades.find((s) => !isStunned(s, t) && distXZ(s.pos, p.pos) <= T.shade_hit_radius + EPS);
    if (hitter) {
      p.flames -= 1;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      p.invulnUntil = t + toTicks(T.invuln_s);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  w.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse };
  w.tick = t;
  w.ticksLeft -= 1;

  // 7. Kết thúc: thắng được ưu tiên (Q8).
  if (w.lanterns.every((l) => l.lit)) {
    w.score += T.score.per_second_left * Math.floor(Math.max(0, w.ticksLeft) / TPS) + T.score.per_flame_left * p.flames;
    w.state = 'won';
    emit('game_over', { result: 'won', reason: 'all_lit' });
  } else if (p.flames <= 0) {
    w.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (w.ticksLeft <= 0) {
    w.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'dawn' });
  }
  return events;
}

const v3 = (v: Vec3): Vec3 => [r3(v[0]), r3(v[1]), r3(v[2])];

export function snapshot(w: World) {
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.tick,
    state: w.state,
    time_left_s: r3(Math.max(0, w.ticksLeft) / TPS),
    score: w.score,
    player: { pos: v3(w.player.pos), flames: w.player.flames, carried: w.player.carried },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: isStunned(s, w.tick) ? 'stunned' : 'chase' })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
  };
}
