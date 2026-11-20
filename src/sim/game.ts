// Lõi mô phỏng Đảo Đèn Lồng (contract v1.1): thuần, tất định, không DOM, không Three.js.
// Dùng chung cho headless (src/headless.ts) và giao diện (src/web/).
// Luật: Ticket-02 (docs/lab/phase-2-ticket.md) + giả định ở docs/notes/phase-2.md. Thứ tự bước theo Ticket-02.
// Mọi bộ đếm lưu dạng "tới sim_tick nào" (until); còn lại = until - sim_tick.
import { TUNING as T, RULES as R, TPS } from './tuning.js';
import { MAPS, type NightMap } from './maps.js';
import { mulberry32 } from './rng.js';

export type Vec3 = [number, number, number];
export type GameState = 'playing' | 'paused' | 'won' | 'lost';
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export interface Input {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}
type Button = 'jump' | 'interact' | 'pulse' | 'dash' | 'pause';
const BUTTONS: Button[] = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export interface Mote { id: string; pos: Vec3; kind: 'random' | 'dropped'; point: number; expires: number }
// target = id đèn đang nhắm/hút (wander, drain); drainStart = sim_tick bắt đầu hút.
export interface Shade { id: string; pos: Vec3; state: ShadeState; until: number; knockUntil: number; dir: [number, number]; target: string | null; drainStart: number }
// fuel lưu theo đơn vị nguyên 1/60 (Ticket-03 khuyến nghị); chỉ làm tròn khi xuất.
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number; fuel: number; everLit: boolean; relitCount: number }
export interface Charm { id: string; pos: Vec3; available: boolean; respawnAt: number }
// Gió Lạc: idle -> chase -> flee -> removed. until = tick biến mất khi flee; target = điểm lượn khi idle.
export interface Drifter { id: string; pos: Vec3; state: 'idle' | 'chase' | 'flee' | 'removed'; stolen: number; until: number; target: Vec3 | null; dir: [number, number] }
export interface Player {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  facing: [number, number];
  flames: number;
  carried: number;
  invulnUntil: number;
  dashUntil: number;
  dashCdUntil: number;
  dashDir: [number, number];
  pulseCdUntil: number;
  charmUntil: number;
  falling: boolean;
  fallUntil: number;
  launch: [number, number] | null;
  successfulLights: number;
}
export interface GameEvent { tick: number; name: string; data: Record<string, unknown> }
export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number; invuln_ticks?: number; dash_cd_ticks?: number; pulse_cd_ticks?: number; charm_ticks?: number; successful_lights?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number; target_lantern_id?: string }[];
  drifters?: { id?: string; pos: Vec3; state?: string; stolen?: number }[];
  charms?: { id?: string; pos: Vec3; available?: boolean }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number; fuel?: number; ever_lit?: boolean }[];
  time_left_s?: number;
}
export interface World {
  night: number;
  map: NightMap;
  tick: number;
  simTick: number;
  ticksLeft: number;
  state: GameState;
  score: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  charms: Charm[];
  drifters: Drifter[];
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  moteSeq: number;
  shadeSeq: number;
  drifterSeq: number;
  rng: () => number;
  prev: Record<Button, boolean>;
}

export const idleInput = (): Input => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false });
export const hasNight = (n: number) => n in MAPS;
export const lanternIds = (night: number) => MAPS[night].lanterns.map((_, i) => `L${i + 1}`);

// ponytail: dung sai cho "≤ r" vì vị trí cộng dồn float không rơi đúng biên.
const EPS = 1e-6;
// Đẩy ra hẳn ngoài safe_radius để tọa độ làm tròn 3 số vẫn đọc là "ngoài vùng".
const SAFE_MARGIN = 0.01;
export const r3 = (x: number) => Math.round(x * 1000) / 1000 || 0;
export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const byId = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
export const isStunned = (s: Shade) => s.state === 'stunned';
const FUEL_MAX = T.fuel_max * TPS;
const FUEL_LOW = T.low_fuel_threshold * TPS;
const r1 = (x: number) => Math.round(x * 10) / 10 || 0;
export const fuelOf = (l: Lantern) => (l.lit ? r1(l.fuel / TPS) : 0);
// Vùng an toàn: đèn đang sáng và fuel ≥ 30 (Ticket-03: dưới 30 mất vùng).
export const hasSafeZone = (l: Lantern) => l.lit && l.fuel >= FUEL_LOW;
export const capacityOf = (p: Player) => Math.min(T.capacity_max, T.carry_capacity + R.capacity_step * p.successfulLights);
const left = (until: number, t: number) => Math.max(0, until - t);
function awayXZ(from: Vec3, to: Vec3): [number, number] {
  const d = distXZ(from, to);
  return d > 1e-9 ? [(to[0] - from[0]) / d, (to[2] - from[2]) / d] : [1, 0]; // trùng vị trí: đẩy theo +X
}

export function createWorld(seed: number, sc: Scenario = {}, night = 1): World {
  const map = MAPS[night];
  const sp = sc.player ?? {};
  const w: World = {
    night,
    map,
    tick: 0,
    simTick: 0,
    ticksLeft: Math.round((sc.time_left_s ?? map.duration_s) * TPS),
    state: 'playing',
    score: 0,
    player: {
      pos: sp.pos ? [...sp.pos] : [...map.start],
      vel: [0, 0, 0],
      grounded: true,
      facing: [0, 1],
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invulnUntil: sp.invuln_ticks ?? 0,
      dashUntil: 0,
      dashCdUntil: sp.dash_cd_ticks ?? 0,
      dashDir: [0, 1],
      pulseCdUntil: sp.pulse_cd_ticks ?? 0,
      charmUntil: sp.charm_ticks ?? 0,
      falling: false,
      fallUntil: 0,
      launch: null,
      successfulLights: sp.successful_lights ?? 0,
    },
    lanterns: map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0, fuel: 0, everLit: false, relitCount: 0 })),
    shades: [],
    motes: [],
    charms: (sc.charms ?? map.charms.map((pos) => ({ pos }))).map((c, i) => ({
      id: (c as { id?: string }).id ?? `C${i + 1}`,
      pos: [...c.pos] as Vec3,
      available: (c as { available?: boolean }).available ?? true,
      respawnAt: 0,
    })),
    drifters: (sc.drifters ?? []).map((d, i) => {
      const state = (d.state ?? 'idle') as Drifter['state'];
      return { id: d.id ?? `D${i + 1}`, pos: [...d.pos] as Vec3, state, stolen: d.stolen ?? 0, until: state === 'flee' ? R.drifter_flee_ticks : 0, target: null, dir: [1, 0] as [number, number] };
    }),
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: sc.random_drifters ?? map.drifters,
    moteSeq: 0,
    shadeSeq: 0,
    drifterSeq: sc.drifters?.length ?? 0,
    rng: mulberry32(seed),
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  const g = map.ground(w.player.pos[0], w.player.pos[2]);
  w.player.grounded = g !== null && Math.abs(w.player.pos[1] - g) < 1e-9;
  for (const u of sc.lanterns ?? []) {
    const l = w.lanterns.find((x) => x.id === u.id);
    if (!l) throw new Error(`không có đèn ${u.id}`); // parseScenario đã chặn trước
    if (u.pos) l.pos = [...u.pos];
    if (u.lit !== undefined) l.lit = u.lit;
    if (u.deposited !== undefined) l.deposited = u.deposited;
    l.everLit = u.ever_lit ?? l.lit;
    l.fuel = l.lit ? Math.round((u.fuel ?? T.fuel_max) * TPS) : 0; // lit mà không có fuel -> 100
  }
  if (sc.motes) for (const pos of sc.motes) w.motes.push({ id: `M${++w.moteSeq}`, pos: [...pos], kind: 'random', point: -1, expires: 0 });
  else if (w.randomMotes) for (let i = 0; i < R.mote_start; i++) spawnMoteAtPoint(w);
  if (sc.shades) {
    const reserved = new Set(sc.shades.flatMap((s) => (s.id ? [s.id] : [])));
    for (const s of sc.shades) {
      const state = s.state ?? 'wander';
      const until = s.state_ticks_left ?? 0;
      w.shades.push({ id: s.id ?? newShadeId(w, reserved), pos: [...s.pos], state, until, knockUntil: 0, dir: awayXZ(w.player.pos, s.pos), target: s.target_lantern_id ?? null, drainStart: 0 });
    }
  }
  return w;
}

function newShadeId(w: World, reserved: Set<string> = new Set()): string {
  let id: string;
  do id = `S${++w.shadeSeq}`;
  while (reserved.has(id) || w.shades.some((s) => s.id === id));
  return id;
}

// Sinh 1 đom đóm ở một điểm trống (không có đom đóm random nào đang ở đó). Hết điểm thì bỏ lượt.
function spawnMoteAtPoint(w: World): boolean {
  const used = new Set(w.motes.map((m) => m.point));
  const free = w.map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
  if (!free.length) return false;
  const i = free[Math.floor(w.rng() * free.length)];
  w.motes.push({ id: `M${++w.moteSeq}`, pos: [...w.map.motePoints[i]], kind: 'random', point: i, expires: 0 });
  return true;
}

function spawnShade(w: World, t: number): Shade | null {
  const ok = w.map.shadePoints.filter(
    (pt) => distXZ(pt, w.player.pos) >= R.shade_min_dist && !w.lanterns.some((l) => hasSafeZone(l) && distXZ(pt, l.pos) <= T.safe_radius + EPS),
  );
  if (!ok.length) return null;
  const pt = ok[Math.floor(w.rng() * ok.length)];
  const s: Shade = { id: newShadeId(w), pos: [pt[0], pt[1] + R.shade_y, pt[2]], state: 'spawning', until: t + 1, knockUntil: 0, dir: [1, 0], target: null, drainStart: 0 };
  w.shades.push(s);
  return s;
}

// Đom đóm rơi: n con trên vành [minR, minR + 1] m quanh `at`, tồn tại drop_ttl tick.
function dropMotes(w: World, at: Vec3, n: number, minR: number, t: number): void {
  for (let i = 0; i < n; i++) {
    const a = w.rng() * 2 * Math.PI;
    const r = minR + (minR > 0 ? w.rng() : 0);
    const x = at[0] + r * Math.cos(a);
    const z = at[2] + r * Math.sin(a);
    w.motes.push({ id: `M${++w.moteSeq}`, pos: [r3(x), w.map.ground(x, z) ?? 0, r3(z)], kind: 'dropped', point: -1, expires: t + R.drop_ttl });
  }
}

function pushOutOfSafeZones(w: World, s: Shade): void {
  for (const l of w.lanterns) {
    if (!hasSafeZone(l)) continue;
    const d = distXZ(s.pos, l.pos);
    if (d > T.safe_radius + EPS) continue;
    const [ux, uz] = awayXZ(l.pos, s.pos);
    s.pos[0] = l.pos[0] + ux * (T.safe_radius + SAFE_MARGIN);
    s.pos[2] = l.pos[2] + uz * (T.safe_radius + SAFE_MARGIN);
  }
}

function movePlayer(w: World, inp: Input, E: Record<Button, boolean>, t: number, emit: (n: string, d: Record<string, unknown>) => void): void {
  const p = w.player;
  if (p.falling) {
    if (t < p.fallUntil) return; // đang chờ hồi sinh
    p.falling = false;
    p.pos = [...w.map.start];
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.launch = null;
    p.invulnUntil = t + R.invuln_ticks;
    return;
  }
  let [mx, mz] = inp.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (inp.cam_yaw_deg * Math.PI) / 180;
  const dx = mx * Math.cos(th) + mz * Math.sin(th);
  const dz = -mx * Math.sin(th) + mz * Math.cos(th);
  const mlen = Math.hypot(dx, dz);
  if (mlen > 1e-9) p.facing = [dx / mlen, dz / mlen];
  const charm = t < p.charmUntil;

  if (E.dash && t >= p.dashUntil && (charm || t >= p.dashCdUntil)) {
    p.dashUntil = t + R.dash_ticks;
    p.dashCdUntil = t + R.dash_cd_ticks;
    p.dashDir = [...p.facing];
    emit('dash', {});
  }
  const prevY = p.pos[1];
  if (t < p.dashUntil) {
    p.vel = [p.dashDir[0] * T.dash_speed, 0, p.dashDir[1] * T.dash_speed]; // lướt trên không giữ độ cao
  } else {
    if (p.launch) { p.vel[0] = p.launch[0]; p.vel[2] = p.launch[1]; }
    else {
      const speed = charm ? R.charm_speed : T.player_speed;
      p.vel[0] = dx * speed;
      p.vel[2] = dz * speed;
    }
    if (E.jump && p.grounded) p.vel[1] = R.jump_speed;
    p.vel[1] -= R.gravity / TPS;
  }
  p.pos[0] += p.vel[0] / TPS;
  p.pos[1] += p.vel[1] / TPS;
  p.pos[2] += p.vel[2] / TPS;
  const g = w.map.ground(p.pos[0], p.pos[2]);
  if (g !== null && p.pos[1] <= g && prevY >= g - 1e-6) {
    p.pos[1] = g;
    p.vel[1] = 0;
    p.grounded = true;
    p.launch = null;
  } else p.grounded = false;

  for (const pad of w.map.pads) {
    if (!p.grounded || distXZ(p.pos, pad.pos) > 1 + EPS) continue;
    const [ux, uz] = awayXZ(p.pos, pad.target);
    p.launch = [ux * pad.vh, uz * pad.vh];
    p.vel = [p.launch[0], pad.vy, p.launch[1]];
    p.grounded = false;
  }

  if (p.pos[1] < R.fall_y) { // rơi khỏi đảo: đúng 1 lần, bỏ qua bất tử
    const lost = p.carried;
    p.flames -= 1;
    p.carried = 0;
    p.falling = true;
    p.fallUntil = t + R.fall_wait;
    p.vel = [0, 0, 0];
    emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }
}

// Một bước: đọc input tick k, tạo trạng thái k+1. Sự kiện ghi tick = k+1.
export function step(w: World, inp: Input): GameEvent[] {
  const events: GameEvent[] = [];
  if (w.state === 'won' || w.state === 'lost') return events;
  w.tick += 1;
  const tick = w.tick;
  const emit = (name: string, data: Record<string, unknown>) => events.push({ tick, name, data });
  const E = Object.fromEntries(BUTTONS.map((b) => [b, inp[b] && !w.prev[b]])) as Record<Button, boolean>;
  for (const b of BUTTONS) w.prev[b] = inp[b];

  // 1. Tạm dừng xử lý trước.
  if (E.pause) {
    if (w.state === 'playing') { w.state = 'paused'; emit('paused', {}); return events; }
    w.state = 'playing';
    emit('resumed', {});
  } else if (w.state === 'paused') return events;

  // 2. Bộ đếm (dạng until): thời gian, TTL đom đóm rơi, hồi bùa.
  const t = ++w.simTick;
  w.ticksLeft -= 1;
  w.motes = w.motes.filter((m) => m.kind !== 'dropped' || t < m.expires);
  for (const c of w.charms) if (!c.available && t >= c.respawnAt) c.available = true;
  // Dầu đèn: tự hao 1/s + mỗi Bóng Mực đang hút 5/s (đơn vị 1/60 nên trừ thẳng theo tick); hết dầu thì tắt ngay.
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    const drainers = w.shades.filter((s) => s.state === 'drain' && s.target === l.id);
    l.fuel -= T.fuel_decay_per_s + T.drain_per_s * drainers.length;
    for (const s of drainers) {
      if ((t - s.drainStart) % R.fuel_drain_every === 0) emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: r1(Math.max(0, l.fuel) / TPS) });
    }
    if (l.fuel <= 0) {
      l.fuel = 0;
      l.lit = false;
      l.deposited = 0;
      emit('lantern_out', { lantern_id: l.id });
    }
  }

  // 3. Di chuyển Mây, kiểm tra rơi.
  movePlayer(w, inp, E, t, emit);
  const p = w.player;

  // 4. Nhặt đom đóm và bùa.
  if (!p.falling) {
    const reach = (pos: Vec3) => distXZ(pos, p.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - pos[1]) <= R.pickup_dy + EPS;
    const inReach = w.motes.filter((m) => reach(m.pos)).sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos) || byId(a.id, b.id));
    for (const m of inReach) {
      if (p.carried >= capacityOf(p)) break;
      w.motes.splice(w.motes.indexOf(m), 1);
      p.carried += 1;
      emit('mote_picked', { carried: p.carried });
    }
    for (const c of w.charms) {
      if (!c.available || !reach(c.pos)) continue;
      c.available = false;
      c.respawnAt = t + R.charm_respawn_ticks;
      p.charmUntil = t + R.charm_ticks;
      emit('charm_picked', { charm_id: c.id, charm_ticks: R.charm_ticks });
    }
  }

  // 5. Tương tác: đèn "nhận được" gần nhất (chưa sáng, hoặc sáng chưa đầy dầu). Đèn đầy dầu không được chọn.
  if (E.interact && !p.falling && p.carried > 0) {
    const need = (l: Lantern) =>
      l.lit ? Math.ceil((FUEL_MAX - l.fuel) / (T.fuel_per_mote * TPS)) : (l.everLit ? T.relight_cost : T.lantern_cost) - l.deposited;
    const target = w.lanterns
      .filter((l) => need(l) > 0 && distXZ(l.pos, p.pos) <= T.interact_radius + EPS)
      .sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos) || byId(a.id, b.id))[0];
    if (target) {
      const amount = Math.min(p.carried, need(target));
      p.carried -= amount;
      w.score += T.score.per_mote * amount;
      if (target.lit) { // châm dầu
        target.fuel = Math.min(FUEL_MAX, target.fuel + amount * T.fuel_per_mote * TPS);
        emit('refuel', { lantern_id: target.id, amount, fuel: fuelOf(target) });
      } else {
        target.deposited += amount;
        emit('deposit', { lantern_id: target.id, amount, deposited: target.deposited });
        if (need(target) <= 0) { // thắp (lần đầu 10, thắp lại 5)
          const relight = target.everLit;
          target.lit = true;
          target.everLit = true;
          target.fuel = FUEL_MAX;
          if (relight) target.relitCount += 1;
          p.successfulLights += 1;
          w.score += relight ? R.relight_score : T.score.per_lantern;
          emit('lantern_lit', { lantern_id: target.id, relight });
        }
      }
    }
  }

  // 6. Vùng an toàn: Bóng Mực trong vùng đèn đã Thắp ra mép ngay (≤ 30 tick theo ticket).
  for (const s of w.shades) pushOutOfSafeZones(w, s);

  // 7. Tỏa sáng: mục tiêu chốt ngay tick kích hoạt, khoảng cách 3D tới tâm (chân + 0.8 m).
  if (E.pulse && !p.falling && t >= p.pulseCdUntil && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCdUntil = t + R.pulse_cd_ticks;
    const c: Vec3 = [p.pos[0], p.pos[1] + R.pulse_center_dy, p.pos[2]];
    const stunned: string[] = [];
    for (const s of w.shades) {
      if (Math.hypot(s.pos[0] - c[0], s.pos[1] - c[1], s.pos[2] - c[2]) > T.pulse_radius + EPS) continue;
      w.score += s.state === 'drain' ? R.drain_stun_score - T.score.per_stun : 0; // đang hút: tổng +15
      s.state = 'stunned';
      s.until = t + R.stun_ticks;
      s.knockUntil = t + R.knock_ticks;
      s.dir = awayXZ(p.pos, s.pos);
      w.score += T.score.per_stun;
      stunned.push(s.id);
    }
    for (const d of w.drifters) {
      if (Math.hypot(d.pos[0] - c[0], d.pos[1] - c[1], d.pos[2] - c[2]) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase') { // trúng lúc đuổi: bỏ chạy, không cướp
        d.state = 'flee';
        d.until = t + R.drifter_flee_ticks;
        d.dir = awayXZ(p.pos, d.pos);
      } else if (d.state === 'flee' && d.stolen > 0) { // trúng lúc chạy có đồ: thả hết, biến mất sau 120 tick
        emit('drifter_drop', { drifter_id: d.id, amount: d.stolen });
        dropMotes(w, d.pos, d.stolen, 0, t);
        d.stolen = 0;
        d.until = t + R.drifter_vanish_ticks;
      }
    }
    emit('pulse', { stunned_ids: stunned });
  }

  // 8. Bóng Mực.
  for (const s of w.shades) {
    const d = distXZ(s.pos, p.pos);
    if (s.state === 'stunned' && t >= s.until) s.state = 'wander'; // Ticket-03: hết choáng về wander
    else if ((s.state === 'spawning' || s.state === 'recoil') && t >= s.until) {
      s.state = d <= (s.state === 'spawning' ? R.detect : R.give_up) ? 'chase' : 'wander';
    } else if (s.state === 'drain') {
      const l = w.lanterns.find((x) => x.id === s.target);
      if (d <= R.drain_exit_chase + EPS) s.state = 'chase';
      else if (!l || !l.lit || l.fuel >= FUEL_LOW || distXZ(s.pos, l.pos) > R.drain_range + EPS) s.state = 'wander';
    } else if (s.state === 'wander' && d <= R.detect) s.state = 'chase';
    else if (s.state === 'chase' && d > R.give_up) s.state = 'wander';
    let stepLen = 0;
    let dir = s.dir;
    if (s.state === 'stunned' && t < s.knockUntil) stepLen = T.pulse_push_m / R.knock_ticks;
    else if (s.state === 'recoil') stepLen = R.recoil_m / R.recoil_ticks;
    else if (s.state === 'chase' && !p.falling) {
      stepLen = Math.min(w.map.shadeSpeed / TPS, d);
      dir = d > 1e-9 ? [(p.pos[0] - s.pos[0]) / d, (p.pos[2] - s.pos[2]) / d] : [0, 0];
    } else if (s.state === 'wander') {
      // Ticket-03: tới đèn sáng có fuel < 30 gần nhất; không có thì về đèn tắt gần nhất.
      const near = (ls: Lantern[]) => ls.sort((a, b) => distXZ(a.pos, s.pos) - distXZ(b.pos, s.pos) || byId(a.id, b.id))[0];
      const l = near(w.lanterns.filter((x) => x.lit && x.fuel < FUEL_LOW)) ?? near(w.lanterns.filter((x) => !x.lit));
      s.target = l?.id ?? null;
      if (l) {
        const dl = distXZ(s.pos, l.pos);
        if (l.lit && dl <= R.drain_range + EPS) {
          s.state = 'drain';
          s.drainStart = t;
        } else if (dl > R.drain_range) {
          stepLen = Math.min(w.map.shadeSpeed / TPS, dl - R.drain_range);
          dir = [(l.pos[0] - s.pos[0]) / dl, (l.pos[2] - s.pos[2]) / dl];
        }
      }
    }
    s.pos[0] += dir[0] * stepLen;
    s.pos[2] += dir[1] * stepLen;
    pushOutOfSafeZones(w, s);
  }
  // Gió Lạc: không bị Vùng an toàn chặn.
  for (const d of w.drifters) {
    if (d.state === 'removed') continue;
    let dir = d.dir;
    let stepLen = R.drifter_speed / TPS;
    if (d.state === 'flee') {
      if (t >= d.until) { d.state = 'removed'; continue; }
    } else {
      const dist = distXZ(d.pos, p.pos);
      d.state = !p.falling && p.carried >= R.drifter_min_carried && dist <= R.drifter_detect + EPS ? 'chase' : 'idle';
      if (d.state === 'chase') {
        stepLen = Math.min(stepLen, dist);
        dir = dist > 1e-9 ? [(p.pos[0] - d.pos[0]) / dist, (p.pos[2] - d.pos[2]) / dist] : [0, 0];
      } else { // lượn chậm tới một điểm sương ngẫu nhiên
        if (!d.target || distXZ(d.pos, d.target) < 0.5) d.target = w.map.shadePoints[Math.floor(w.rng() * w.map.shadePoints.length)];
        const dt = distXZ(d.pos, d.target);
        stepLen = Math.min(R.drifter_idle_speed / TPS, dt);
        dir = dt > 1e-9 ? [(d.target[0] - d.pos[0]) / dt, (d.target[2] - d.pos[2]) / dt] : [0, 0];
      }
    }
    d.dir = dir;
    d.pos[0] += dir[0] * stepLen;
    d.pos[2] += dir[1] * stepLen;
  }

  // 9. Chạm: Gió Lạc cướp trước (bất tử không ngăn), rồi Bóng Mực.
  if (!p.falling) {
    for (const d of [...w.drifters].sort((a, b) => byId(a.id, b.id))) {
      if ((d.state !== 'idle' && d.state !== 'chase') || p.carried <= 0 || distXZ(d.pos, p.pos) > R.drifter_touch + EPS) continue;
      const amount = Math.min(R.drifter_steal, p.carried);
      p.carried -= amount;
      d.stolen = amount;
      d.state = 'flee';
      d.until = t + R.drifter_flee_ticks;
      d.dir = awayXZ(p.pos, d.pos);
      emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
  }
  // Bóng Mực theo id tăng dần, tối đa 1 Flame mỗi tick.
  if (!p.falling && t >= p.invulnUntil) {
    const hitter = [...w.shades]
      .sort((a, b) => byId(a.id, b.id))
      .find((s) => (s.state === 'chase' || s.state === 'wander') && distXZ(s.pos, p.pos) <= T.shade_hit_radius + EPS && Math.abs(s.pos[1] - p.pos[1]) <= R.hit_dy + EPS);
    if (hitter) {
      p.flames -= 1;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      dropMotes(w, p.pos, dropped, 1.5, t);
      p.invulnUntil = t + R.invuln_ticks;
      hitter.state = 'recoil';
      hitter.until = t + R.recoil_ticks;
      hitter.dir = awayXZ(p.pos, hitter.pos);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  // 10. Sinh theo lịch (thực thể mới tương tác từ tick sau).
  if (w.randomMotes && t % R.mote_every === 0 && w.motes.length < R.mote_cap) spawnMoteAtPoint(w);
  if (w.randomDrifters && t % R.drifter_every === 0 && w.drifters.filter((d) => d.state !== 'removed').length < R.drifter_max) {
    const pt = w.map.shadePoints[Math.floor(w.rng() * w.map.shadePoints.length)];
    w.drifters.push({ id: `D${++w.drifterSeq}`, pos: [pt[0], pt[1] + R.shade_y, pt[2]], state: 'idle', stolen: 0, until: 0, target: null, dir: [1, 0] });
  }
  if (w.randomShades && t >= R.shade_first && (t - R.shade_first) % w.map.shadeEvery === 0) {
    for (let i = 0; i < (t === R.shade_first ? 2 : 1); i++) {
      if (w.shades.length >= w.map.shadeMax) break;
      const s = spawnShade(w, t);
      if (s) emit('shade_spawned', { id: s.id });
    }
  }

  // 11. Thắng / thua (Ticket-03): hết Flame luôn thua trước; chỉ xét thắng ở bình minh, không thắng sớm.
  if (p.flames <= 0) {
    w.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (w.ticksLeft <= 0) {
    const lit = w.lanterns.filter((l) => l.lit);
    if (lit.length >= Math.ceil(T.win_ratio * w.lanterns.length - 1e-9)) {
      for (const l of lit) w.score += R.dawn_lantern_bonus + Math.floor(l.fuel / TPS);
      w.score += T.score.per_flame_left * p.flames;
      w.state = 'won';
      emit('game_over', { result: 'won', reason: 'dawn_survived' });
    } else {
      w.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }
  }
  return events;
}

const v3 = (v: Vec3): Vec3 => [r3(v[0]), r3(v[1]), r3(v[2])];
const secs = (until: number, t: number) => r3(left(until, t) / TPS);

export function snapshot(w: World) {
  const t = w.simTick;
  const p = w.player;
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: t,
    night: w.night,
    state: w.state,
    time_left_s: r3(Math.max(0, w.ticksLeft) / TPS),
    score: w.score,
    wind: { active: false, dir_deg: 0 },
    player: {
      pos: v3(p.pos),
      vel: v3(p.vel),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      invuln: t < p.invulnUntil,
      dash_cd_s: secs(p.dashCdUntil, t),
      pulse_cd_s: secs(p.pulseCdUntil, t),
      charm_s: secs(p.charmUntil, t),
      capacity: capacityOf(p),
    },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited, fuel: fuelOf(l), ever_lit: l.everLit, relit_count: l.relitCount })),
    shades: w.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? secs(m.expires, t) : null })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, pos: v3(c.pos), available: c.available, respawn_s: c.available ? 0 : secs(c.respawnAt, t) })),
  };
}
