// Scenario headless theo Test Contract v1.1 + số chuẩn Ticket-02, kiểm tra trên đầu ra JSONL.
// Test Phase 1 bị luật mới thay đã được sửa theo số chuẩn; lý do từng thay đổi: docs/notes/phase-2.md mục 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, QUIET, distXZ } from './helpers.mjs';

const press = (button, at) => [{ tick: at, [button]: true }, { tick: at + 1, [button]: false }];
const names = (r) => r.events.map((e) => [e.tick, e.name]);

test('định dạng v1.1: snapshot tick 0, night_start, trường mới, snapshot mỗi N tick, end', () => {
  const r = run({ ticks: 100, every: 10 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.deepEqual(r.events[0], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  const s0 = r.snaps[0];
  assert.equal(s0.night, 1);
  assert.equal(s0.sim_tick, 0);
  assert.deepEqual(s0.wind, { active: false, dir_deg: 0 });
  assert.deepEqual(s0.player, { pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0, invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0, capacity: 10 });
  assert.deepEqual(s0.lanterns[0], { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 });
  assert.deepEqual(s0.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(s0.motes_active, 20);
  assert.ok(s0.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.equal(new Set(s0.motes.map((m) => m.pos.join())).size, 20);
  assert.deepEqual(s0.drifters, []);
  assert.deepEqual(s0.charms, []);
  assert.deepEqual(s0.shades, []);
  assert.deepEqual(r.end, { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(r.snap(60).time_left_s, 239); // Ticket-03: Đêm 1 còn 240 s
});

test('tất định: cùng seed + input ra file giống hệt; khác seed thì khác', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, ...press('dash', 200), { tick: 400, move: [-1, 0] }, ...press('jump', 500)] };
  const a = run({ seed: 42, inputs, ticks: 3000, every: 5 });
  const b = run({ seed: 42, inputs, ticks: 3000, every: 5 });
  const c = run({ seed: 43, inputs, ticks: 3000, every: 5 });
  assert.equal(a.code, 0);
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, c.raw);
});

test('mã thoát: file sai định dạng -> 2, lỗi tham số -> khác 0', () => {
  assert.equal(run({ rawInputs: '{not json' }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 5 }, { tick: 5 }] } }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 0, move: [2, 0] }] } }).code, 2);
  assert.equal(run({ inputs: { frames: [{ tick: 0, pause: 'yes' }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L6', lit: true }] } }).code, 2);
  assert.equal(run({ scenario: { shades: [{ pos: [1, 1, 1], state: 'angry' }] } }).code, 2);
  assert.equal(run({ scenario: { motes: [[0, 0]] } }).code, 2);
  assert.notEqual(run({ extraArgs: ['--night', '4'] }).code, 0);
});

test('di chuyển: 6 m/s, xoay theo cam_yaw_deg, chuẩn hóa vector', () => {
  const go = (frame) => run({ scenario: QUIET, inputs: { frames: [{ tick: 0, ...frame }] }, ticks: 60 }).snap(60).player;
  assert.deepEqual(go({ move: [0, 1] }).pos, [0, 0, 6]);
  assert.deepEqual(go({ move: [0, 1] }).vel, [0, 0, 6]);
  assert.deepEqual(go({ move: [0, 1], cam_yaw_deg: 90 }).pos, [6, 0, 0]);
  assert.deepEqual(go({ move: [1, 1] }).pos, [4.243, 0, 4.243]);
});

test('nhảy 7 m/s, trọng lực 20: lên khoảng 1.2 m rồi đáp, grounded đổi đúng', () => {
  const r = run({ scenario: QUIET, inputs: { frames: press('jump', 0) }, ticks: 60 });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 1.1 && Math.max(...ys) < 1.3);
  assert.equal(r.snap(10).player.grounded, false);
  assert.equal(r.snap(60).player.pos[1], 0);
  assert.equal(r.snap(60).player.grounded, true);
});

test('Lướt: 14 m/s trong 12 tick theo hướng đi (đứng yên thì hướng mặt +Z), hồi chiêu 1.5 s từ lúc bắt đầu', () => {
  const r = run({ scenario: QUIET, inputs: { frames: [...press('dash', 0), ...press('dash', 30), ...press('dash', 90)] }, ticks: 100 });
  assert.deepEqual(names(r).filter(([, n]) => n === 'dash'), [[1, 'dash'], [91, 'dash']]);
  assert.deepEqual(r.snap(12).player.pos, [0, 0, 2.8]);
  assert.deepEqual(r.snap(13).player.pos, [0, 0, 2.8]);
  assert.equal(r.snap(1).player.dash_cd_s, 1.5);
});

test('Lướt trên không giữ nguyên độ cao', () => {
  const r = run({ scenario: QUIET, inputs: { frames: [...press('jump', 0), ...press('dash', 10)] }, ticks: 30 });
  assert.equal(r.snap(11).player.pos[1], r.snap(22).player.pos[1]);
  assert.ok(r.snap(11).player.pos[1] > 0.5);
});

test('Rơi khỏi đảo (Y < -10): -1 Flame, mất hết đom đóm, chờ 60 tick, hồi sinh ở xuất phát + bất tử', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [39.5, 0, 0], carried: 4 } }, inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] }, ticks: 200 });
  const fall = r.events.find((e) => e.name === 'player_hit');
  assert.deepEqual(fall.data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const ft = fall.tick;
  assert.equal(r.snap(ft).player.carried, 0);
  assert.ok(r.snap(ft + 59).player.pos[1] < -10);
  assert.deepEqual(r.snap(ft + 60).player.pos, [0, 0, 0]);
  assert.equal(r.snap(ft + 60).player.invuln, true);
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 1);
});

test('nhặt: XZ ≤ 1.0 (biên tính là trong), đầy thì không nhặt, nhặt không cộng điểm', () => {
  const r = run({ scenario: { ...QUIET, motes: [[0, 0, 1]] }, ticks: 5 });
  assert.deepEqual(r.events[1], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(r.snap(1).score, 0);
  assert.equal(run({ scenario: { ...QUIET, motes: [[0, 0, 1.01]] }, ticks: 30 }).events.length, 1);
  assert.equal(run({ scenario: { ...QUIET, player: { carried: 10 }, motes: [[0, 0, 0.5]] }, ticks: 30 }).events.length, 1);
});

test('đom đóm: 20 lúc đầu trên điểm chuẩn, mỗi 240 tick thêm 1 vào điểm trống, hết điểm thì bỏ lượt', () => {
  const r = run({ scenario: { random_shades: false }, ticks: 1200, every: 240 });
  assert.deepEqual(r.snaps.map((s) => s.motes_active), [20, 21, 22, 23, 24, 24]);
});

// Ticket-03 thay điểm: +5 mỗi đom đóm nạp (trước +10); lantern_lit thêm relight.
test('nạp: trong 2.0 m, +5 mỗi đom đóm nạp, đủ 10 thì thắp lần đầu +100', () => {
  const at = (carried, deposited = 0, pos = [0, 0, 23]) =>
    run({ scenario: { ...QUIET, player: { pos, carried }, lanterns: [{ id: 'L1', deposited }] }, inputs: { frames: press('interact', 0) }, ticks: 5 });
  const full = at(10);
  assert.deepEqual(full.events.slice(1).map((e) => [e.tick, e.name, e.data]), [
    [1, 'deposit', { lantern_id: 'L1', amount: 10, deposited: 10 }],
    [1, 'lantern_lit', { lantern_id: 'L1', relight: false }],
  ]);
  assert.equal(full.snap(1).score, 150);
  assert.equal(full.snap(1).lanterns[0].fuel, 100);
  assert.equal(full.snap(1).player.capacity, 12);
  const partial = at(3);
  assert.equal(partial.snap(1).score, 15);
  assert.equal(partial.snap(1).lanterns[0].deposited, 3);
  const topUp = at(5, 8);
  assert.equal(topUp.events[1].data.amount, 2);
  assert.equal(topUp.snap(1).player.carried, 3);
  assert.equal(at(10, 0, [0, 0, 22.9]).events.length, 1);
});

test('Tỏa sáng: tốn 3, bán kính 3D 5 m từ chân + 0.8, choáng 120 tick, đẩy 4 m trong 15 tick, +5', () => {
  const r = run({ scenario: { ...QUIET, player: { carried: 3 }, shades: [{ id: 'S1', pos: [4.9, 1, 0] }] }, inputs: { frames: press('pulse', 0) }, ticks: 125 });
  assert.deepEqual(r.events[1], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
  assert.equal(r.snap(1).shades[0].state, 'stunned');
  assert.equal(r.snap(1).score, 5);
  assert.equal(r.snap(1).player.carried, 0);
  assert.equal(r.snap(1).player.pulse_cd_s, 3);
  assert.deepEqual(r.snap(15).shades[0].pos, [8.9, 1, 0]);
  assert.deepEqual(r.snap(30).shades[0].pos, [8.9, 1, 0]);
  assert.equal(r.snap(120).shades[0].state, 'stunned');
  assert.equal(r.snap(121).shades[0].state, 'wander'); // Ticket-03: hết choáng về wander (trước: chase)
  const out = run({ scenario: { ...QUIET, player: { carried: 3 }, shades: [{ id: 'S1', pos: [5, 1, 0] }] }, inputs: { frames: press('pulse', 0) }, ticks: 3 });
  assert.deepEqual(out.events[1].data, { stunned_ids: [] });
});

test('Tỏa sáng: thiếu 3 đom đóm thì không kích hoạt; hồi chiêu 3 s; trúng con đang choáng vẫn +5', () => {
  assert.equal(run({ scenario: { ...QUIET, player: { carried: 2 } }, inputs: { frames: press('pulse', 0) }, ticks: 5 }).events.length, 1);
  const pulses = (second) =>
    names(run({ scenario: { ...QUIET, player: { carried: 10 } }, inputs: { frames: [...press('pulse', 0), ...press('pulse', second)] }, ticks: 200 })).filter(([, n]) => n === 'pulse');
  assert.deepEqual(pulses(179), [[1, 'pulse']]);
  assert.deepEqual(pulses(180), [[1, 'pulse'], [181, 'pulse']]);
  const again = run({ scenario: { ...QUIET, player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0], state: 'stunned', state_ticks_left: 100 }] }, inputs: { frames: press('pulse', 0) }, ticks: 2 });
  assert.equal(again.snap(0).shades[0].state, 'stunned');
  assert.deepEqual(again.events[1].data, { stunned_ids: ['S1'] });
  assert.equal(again.snap(1).score, 5);
});

test('bị chạm: -1 Flame, rơi floor(carried/2) đom đóm ra vành 1.5–2.5 m (TTL 480 tick), bất tử 90, bóng recoil', () => {
  const r = run({ scenario: { ...QUIET, player: { carried: 5 }, shades: [{ id: 'S1', pos: [1, 1, 0] }] }, ticks: 600 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  const s1 = r.snap(1);
  assert.equal(s1.player.carried, 3);
  assert.equal(s1.player.invuln, true);
  assert.equal(s1.shades[0].state, 'recoil');
  const dropped = s1.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const d = distXZ(m.pos, s1.player.pos);
    assert.ok(d >= 1.49 && d <= 2.51, `khoảng cách ${d}`);
    assert.equal(m.ttl_s, 8);
  }
  assert.ok(hits[1].tick >= 91);
  assert.ok(distXZ(r.snap(60).shades[0].pos, [0, 0, 0]) > 2.5);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('Vùng an toàn 6 m chỉ quanh đèn đã Thắp', () => {
  const lit = run({ scenario: { ...QUIET, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ id: 'S1', pos: [0, 1, 32] }] }, ticks: 300 });
  for (const s of lit.snaps.slice(1)) assert.ok(distXZ(s.shades[0].pos, s.lanterns[0].pos) > 6, `tick ${s.tick}`);
  assert.equal(lit.events.length, 1);
  const unlit = run({ scenario: { ...QUIET, player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 1, 32] }] }, ticks: 300 });
  assert.ok(unlit.events.some((e) => e.name === 'player_hit'));
});

test('Vùng an toàn: đèn vừa Thắp đẩy Bóng Mực đang ở trong ra mép', () => {
  const r = run({
    scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: 1 }, lanterns: [{ id: 'L1', deposited: 9 }], shades: [{ id: 'S1', pos: [3, 1, 25] }] },
    inputs: { frames: press('interact', 0) },
    ticks: 1,
  });
  assert.equal(r.events[2].name, 'lantern_lit');
  assert.ok(distXZ(r.snap(1).shades[0].pos, [0, 0, 25]) > 6);
});

test('kết thúc: Bình minh thua (dawn), time_left_s lấy từ scenario', () => {
  const r = run({ scenario: { ...QUIET, time_left_s: 1 }, ticks: 100 });
  assert.equal(r.snap(0).time_left_s, 1);
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
});

// Bỏ test 'thắp đèn cuối thì thắng + thưởng giây còn lại': Ticket-03 [THAY THẾ] không còn thắng sớm, bỏ thưởng thời gian.
// Thay bằng các test 'bình minh' ở cuối file.
// Bỏ test 'cùng tick thắp đèn cuối và mất Flame cuối': đèn vừa Thắp đẩy Bóng Mực ra mép 6 m ở bước 6, trước bước chạm,
// nên không dựng được tình huống này; luật no_flames ưu tiên vẫn nằm ở bước 11 của step().

test('dựng scenario không phát sự kiện (ngoài night_start), không cộng điểm', () => {
  const r = run({ scenario: { ...QUIET, lanterns: [{ id: 'L1', lit: true }] }, ticks: 10 });
  assert.equal(r.snap(0).score, 0);
  assert.equal(r.snap(0).lanterns[0].lit, true);
  assert.deepEqual(names(r), [[0, 'night_start']]);
});

test('Bóng Mực: 2 con ở tick 300, rồi mỗi 480 tick; spawning -> wander; cách Mây >= 15 m; đuổi khi <= 12 m', () => {
  const r = run({ scenario: { random_motes: false, motes: [] }, ticks: 781 });
  assert.deepEqual(r.events.filter((e) => e.name === 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
  assert.deepEqual(r.snap(300).shades.map((s) => s.state), ['spawning', 'spawning']);
  assert.deepEqual(r.snap(301).shades.map((s) => s.state), ['wander', 'wander']);
  for (const s of r.snap(300).shades) assert.ok(distXZ(s.pos, [0, 0, 0]) >= 15);
  const near = run({ scenario: { ...QUIET, shades: [{ id: 'S1', pos: [11.9, 1, 0] }, { id: 'S2', pos: [12.5, 1, 5] }] }, ticks: 1 });
  assert.deepEqual(near.snap(1).shades.map((s) => s.state), ['chase', 'wander']);
});

test('Tạm dừng: tick vẫn tăng, sim_tick và thời gian đứng yên, state paused, sự kiện paused/resumed', () => {
  const r = run({ scenario: QUIET, inputs: { frames: [{ tick: 0, move: [0, 1] }, ...press('pause', 10), ...press('pause', 20)] }, ticks: 30 });
  assert.deepEqual(names(r).slice(1), [[11, 'paused'], [21, 'resumed']]);
  const s15 = r.snap(15);
  assert.equal(s15.state, 'paused');
  assert.equal(s15.sim_tick, 10);
  assert.deepEqual(s15.player.pos, r.snap(10).player.pos);
  assert.equal(s15.time_left_s, r.snap(10).time_left_s);
  assert.equal(r.snap(21).sim_tick, 11);
  assert.equal(r.snap(30).state, 'playing');
});

test('Bùa Gió: nhặt như đom đóm, 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick', () => {
  const r = run({ scenario: { ...QUIET, charms: [{ id: 'C1', pos: [0, 0, 0.5] }] }, inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 61 });
  assert.deepEqual(r.events[1], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(r.snap(1).player.charm_s, 10);
  assert.deepEqual(r.snap(1).charms[0], { id: 'C1', pos: [0, 0, 0.5], available: false, respawn_s: 45 });
  assert.equal(r.snap(61).player.pos[2], 7.3);
  const d = run({ scenario: { ...QUIET, charms: [{ pos: [0, 0, 0] }] }, inputs: { frames: [...press('dash', 1), ...press('dash', 20)] }, ticks: 30 });
  assert.equal(d.events.filter((e) => e.name === 'dash').length, 2);
});

test('Đêm 2: 6 đèn, bùa C1 ở (35,0,0), bục nhảy bắn sang đảo kia', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [20, 0, 18] } }, ticks: 150, extraArgs: ['--night', '2'] });
  assert.equal(r.snap(0).night, 2);
  assert.equal(r.snap(0).lanterns.length, 6);
  assert.deepEqual(r.snap(0).charms, [{ id: 'C1', pos: [35, 0, 0], available: true, respawn_s: 0 }]);
  assert.equal(r.snap(0).time_left_s, 270);
  const end = r.snap(150).player;
  assert.equal(end.grounded, true);
  assert.ok(distXZ(end.pos, [70, 0, 0]) <= 28, `đáp ở ${end.pos}`);
});

test('Gió Lạc: đuổi khi Mây mang >= 5 và <= 15 m, cướp min(3, mang), bỏ chạy 240 tick rồi removed', () => {
  const r = run({ scenario: { ...QUIET, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [5, 1, 0] }] }, ticks: 300, extraArgs: ['--night', '2'] });
  const steal = r.events.find((e) => e.name === 'drifter_steal');
  assert.deepEqual(steal.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(r.snap(1).drifters[0].state, 'chase');
  assert.deepEqual(r.snap(steal.tick).drifters[0].stolen, 3);
  assert.equal(r.snap(steal.tick).drifters[0].state, 'flee');
  assert.equal(r.snap(steal.tick + 240).drifters[0].state, 'removed');
  const calm = run({ scenario: { ...QUIET, player: { carried: 4 }, drifters: [{ id: 'D1', pos: [5, 1, 0] }] }, ticks: 5, extraArgs: ['--night', '2'] });
  assert.equal(calm.snap(5).drifters[0].state, 'idle');
});

test('Gió Lạc: Tỏa sáng lúc chase -> flee không cướp; lúc flee có đồ -> thả lại thành đom đóm rơi', () => {
  const chase = run({ scenario: { ...QUIET, player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 1, 0], state: 'chase' }] }, inputs: { frames: press('pulse', 0) }, ticks: 30, extraArgs: ['--night', '2'] });
  assert.equal(chase.snap(1).drifters[0].state, 'flee');
  assert.ok(!chase.events.some((e) => e.name === 'drifter_steal'));
  const loot = run({ scenario: { ...QUIET, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'flee', stolen: 3 }] }, inputs: { frames: press('pulse', 0) }, ticks: 130, extraArgs: ['--night', '2'] });
  assert.deepEqual(loot.events.find((e) => e.name === 'drifter_drop').data, { drifter_id: 'D1', amount: 3 });
  assert.equal(loot.snap(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(loot.snap(121).drifters[0].state, 'removed');
});

test('Gió Lạc tự sinh ở Đêm 2 tại tick 1200 (D1), không có ở Đêm 1', () => {
  const r = run({ scenario: { random_motes: false, motes: [], random_shades: false }, ticks: 1200, every: 1200, extraArgs: ['--night', '2'] });
  assert.deepEqual(r.snap(1200).drifters.map((d) => [d.id, d.state]), [['D1', 'idle']]);
  const n1 = run({ scenario: { random_motes: false, motes: [], random_shades: false }, ticks: 1200, every: 1200 });
  assert.deepEqual(n1.snap(1200).drifters, []);
});

// ---- Ticket-03 (contract v1.2): dầu đèn, Bóng Mực hút dầu, luật thắng mới, sức chứa ----
const lit = (id, fuel, extra = {}) => ({ id, lit: true, ...(fuel === undefined ? {} : { fuel }), ...extra });

test('dầu: đèn lit mặc định fuel 100, hao 1/s, xuất 1 chữ số thập phân; hết dầu thì tắt, deposited=0, ever_lit giữ', () => {
  const r = run({ scenario: { ...QUIET, lanterns: [lit('L1'), lit('L2', 0.5)] }, ticks: 61 });
  assert.equal(r.snap(0).lanterns[0].fuel, 100);
  assert.equal(r.snap(60).lanterns[0].fuel, 99);
  assert.deepEqual(names(r).slice(1), [[30, 'lantern_out']]);
  assert.deepEqual(r.events[1].data, { lantern_id: 'L2' });
  const l2 = r.snap(30).lanterns[1];
  assert.deepEqual([l2.lit, l2.fuel, l2.deposited, l2.ever_lit], [false, 0, 0, true]);
});

test('thắp lại: đèn ever_lit cần 5 đom đóm, +5 mỗi con +40, relight true, relit_count, sức chứa tăng', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: 7 }, lanterns: [{ id: 'L1', ever_lit: true }] }, inputs: { frames: press('interact', 0) }, ticks: 2 });
  assert.deepEqual(r.events.slice(1).map((e) => [e.name, e.data]), [
    ['deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }],
    ['lantern_lit', { lantern_id: 'L1', relight: true }],
  ]);
  const s = r.snap(1);
  assert.equal(s.score, 25 + 40);
  assert.deepEqual([s.lanterns[0].fuel, s.lanterns[0].relit_count, s.player.carried, s.player.capacity], [100, 1, 2, 12]);
});

test('châm dầu: used = min(mang, ceil((100-fuel)/10)), fuel tối đa 100, +5 mỗi con, sự kiện refuel', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: 10 }, lanterns: [lit('L1', 50)] }, inputs: { frames: press('interact', 0) }, ticks: 2 });
  // bước 2 trừ dầu trước khi tương tác: 50 -> 49.983, cần ceil(50.017/10) = 6
  assert.deepEqual(r.events[1].data, { lantern_id: 'L1', amount: 6, fuel: 100 });
  assert.equal(r.snap(1).score, 30);
  assert.equal(r.snap(1).player.carried, 4);
});

test('sức chứa = 10 + 2*successful_lights, tối đa 20', () => {
  assert.equal(run({ scenario: { ...QUIET, player: { successful_lights: 3 } }, ticks: 1 }).snap(0).player.capacity, 16);
  assert.equal(run({ scenario: { ...QUIET, player: { successful_lights: 9 } }, ticks: 1 }).snap(0).player.capacity, 20);
});

test('Vùng an toàn: fuel < 30 mất vùng, đúng 30 vẫn còn', () => {
  const zone = (fuel) => run({ scenario: { ...QUIET, player: { pos: [0, 0, 25] }, lanterns: [lit('L1', fuel)], shades: [{ id: 'S1', pos: [0, 1, 30] }] }, ticks: 1 }).snap(1);
  assert.ok(distXZ(zone(30.02).shades[0].pos, [0, 0, 25]) > 6); // sau 1 tick hao vẫn ≥ 30
  assert.ok(distXZ(zone(29).shades[0].pos, [0, 0, 25]) < 6);
});

test('Bóng Mực wander tới đèn yếu (fuel < 30), ≤ 2 m thì drain: hút 5/s cộng hao 1/s, fuel_drain mỗi 60 tick, đèn tắt thì về wander', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [0, 0, -30] }, lanterns: [lit('L1', 20)], shades: [{ id: 'S1', pos: [0, 1, 30] }] }, ticks: 400 });
  const drainAt = r.snaps.find((s) => s.shades[0].state === 'drain').tick;
  assert.ok(drainAt >= 44 && drainAt <= 47, `drain từ tick ${drainAt}`);
  const f0 = r.snap(drainAt + 60).lanterns[0].fuel;
  const f1 = r.snap(drainAt + 120).lanterns[0].fuel;
  assert.equal(Math.round((f0 - f1) * 10) / 10, 6);
  const drains = r.events.filter((e) => e.name === 'fuel_drain');
  assert.deepEqual(drains[0].data.shade_id, 'S1');
  assert.equal(drains[1].tick - drains[0].tick, 60);
  const out = r.events.find((e) => e.name === 'lantern_out');
  assert.equal(r.snap(out.tick + 1).shades[0].state, 'wander');
});

test('drain -> chase khi Mây vào trong 6 m; Tỏa sáng trúng con đang drain: tổng +15', () => {
  const sc = { ...QUIET, lanterns: [lit('L1', 20)], shades: [{ id: 'S1', pos: [0, 1, 26.5], state: 'drain', target_lantern_id: 'L1' }] };
  const walk = run({ scenario: { ...sc, player: { pos: [0, 0, 15] } }, inputs: { frames: [{ tick: 0, move: [0, 1] }] }, ticks: 60 });
  assert.equal(walk.snap(10).shades[0].state, 'drain');
  assert.equal(walk.snap(60).shades[0].state, 'chase');
  const zap = run({ scenario: { ...sc, player: { pos: [0, 0, 23], carried: 3 } }, inputs: { frames: press('pulse', 0) }, ticks: 1 });
  assert.equal(zap.snap(1).shades[0].state, 'stunned');
  assert.equal(zap.snap(1).score, 15);
});

test('châm dầu lên ≥ 30 đẩy Bóng Mực trong 6 m ra mép', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: 3 }, lanterns: [lit('L1', 20)], shades: [{ id: 'S1', pos: [1.5, 1, 26], state: 'drain', target_lantern_id: 'L1' }] }, inputs: { frames: press('interact', 0) }, ticks: 1 });
  assert.equal(r.events[1].name, 'refuel');
  assert.ok(distXZ(r.snap(1).shades[0].pos, [0, 0, 25]) > 6);
});

test('luật thắng mới: không thắng sớm; bình minh còn sống và ≥ ceil(0.6*5)=3 đèn sáng -> dawn_survived + 50+floor(fuel) mỗi đèn + 50 mỗi Flame', () => {
  const all = run({ scenario: { ...QUIET, lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => lit(id)), time_left_s: 2 }, ticks: 200 });
  assert.equal(all.snap(1).state, 'playing');
  assert.equal(all.end.ticks, 120);
  const three = run({ scenario: { ...QUIET, lanterns: ['L1', 'L2', 'L3'].map((id) => lit(id)), time_left_s: 1 }, ticks: 100 });
  assert.deepEqual(three.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } });
  assert.deepEqual(three.end, { type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 50 * 3 });
  const two = run({ scenario: { ...QUIET, lanterns: ['L1', 'L2'].map((id) => lit(id)), time_left_s: 1 }, ticks: 100 });
  assert.deepEqual(two.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(two.end.score, 0);
});

// ---- Đêm 3 (Ticket-02 Phần 2): tầng, vách, dốc, tháp, bục nhảy, gió ----
const n3 = (scenario, inputs, ticks, every = 1) => run({ scenario: { ...QUIET, wind_enabled: false, ...scenario }, inputs, ticks, every, extraArgs: ['--night', '3'] });

test('Đêm 3: 7 đèn, 300 s, 2 bùa, Bóng Mực 4.5 m/s', () => {
  const s0 = n3({}, undefined, 1).snap(0);
  assert.deepEqual([s0.night, s0.lanterns.length, s0.time_left_s, s0.charms.length], [3, 7, 300, 2]);
  assert.deepEqual(s0.lanterns[0].pos, [0, 6, 6]);
  const r = n3({ player: { pos: [0, 0, -28] }, shades: [{ id: 'S1', pos: [10, 1, -28] }] }, undefined, 60);
  assert.equal(r.snap(60).shades[0].pos[0], 10 - 4.5);
});

test('Đêm 3: vách tầng 1 chặn đi ngang; dốc 30° đưa lên Y=3; tháp chuông không đi xuyên', () => {
  const wall = n3({ player: { pos: [0, 0, 10] } }, { frames: [{ tick: 0, move: [0, 1] }] }, 60).snap(60).player;
  assert.ok(wall.pos[2] <= 12 && wall.pos[1] === 0, `vách: ${wall.pos}`);
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const ramp = n3({ player: { pos: [30 * c, 0, 30 * s] } }, { frames: [{ tick: 0, move: [-c, -s] }, { tick: 60, move: [0, 0] }] }, 70).snap(70).player;
  assert.ok(Math.abs(ramp.pos[1] - 3) < 0.01 && ramp.grounded, `dốc: ${ramp.pos}`);
  const tower = n3({ player: { pos: [0, 6, 5] } }, { frames: [{ tick: 0, move: [0, -1] }] }, 60).snap(60).player;
  assert.ok(tower.pos[2] >= 2 && tower.pos[1] === 6, `tháp: ${tower.pos}`);
});

test('Đêm 3: bục nhảy (0,3,13) bắn lên tầng 2', () => {
  const p = n3({ player: { pos: [0, 3, 13] } }, undefined, 90).snap(90).player;
  assert.equal(p.pos[1], 6);
  assert.ok(p.grounded && Math.hypot(p.pos[0], p.pos[2]) <= 8, `${p.pos}`);
});

test('Đêm 3: gió mạnh mỗi 30 s kéo dài 5 s, đẩy Mây 2 m/s; tắt bằng wind_enabled', () => {
  const r = n3({ wind_enabled: true, player: { pos: [0, 0, -28] } }, undefined, 2101, 1);
  assert.equal(r.snap(1799).wind.active, false);
  assert.equal(r.snap(1800).wind.active, true);
  assert.equal(r.snap(2099).wind.active, true);
  assert.equal(r.snap(2100).wind.active, false);
  const moved = distXZ(r.snap(2100).player.pos, r.snap(1799).player.pos);
  assert.ok(moved > 9.5 && moved <= 10.01, `gió đẩy ${moved} m`);
  const calm = n3({ player: { pos: [0, 0, -28] } }, undefined, 2100, 2100);
  assert.deepEqual(calm.snap(2100).player.pos, [0, 0, -28]);
});
