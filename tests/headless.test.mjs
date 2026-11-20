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
  assert.deepEqual(s0.player, { pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0, invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0 });
  assert.deepEqual(s0.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(s0.motes_active, 20);
  assert.ok(s0.motes.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.equal(new Set(s0.motes.map((m) => m.pos.join())).size, 20);
  assert.deepEqual(s0.drifters, []);
  assert.deepEqual(s0.charms, []);
  assert.deepEqual(s0.shades, []);
  assert.deepEqual(r.end, { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(r.snap(60).time_left_s, 299);
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

test('nạp: trong 2.0 m, +10 mỗi đom đóm nạp, đủ 10 thì thắp +100', () => {
  const at = (carried, deposited = 0, pos = [0, 0, 23]) =>
    run({ scenario: { ...QUIET, player: { pos, carried }, lanterns: [{ id: 'L1', deposited }] }, inputs: { frames: press('interact', 0) }, ticks: 5 });
  const full = at(10);
  assert.deepEqual(full.events.slice(1).map((e) => [e.tick, e.name, e.data]), [
    [1, 'deposit', { lantern_id: 'L1', amount: 10, deposited: 10 }],
    [1, 'lantern_lit', { lantern_id: 'L1' }],
  ]);
  assert.equal(full.snap(1).score, 200);
  const partial = at(3);
  assert.equal(partial.snap(1).score, 30);
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
  assert.equal(r.snap(121).shades[0].state, 'chase');
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

const allButL1 = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
test('kết thúc: thắp đèn cuối thì thắng, +floor(giây còn)*2 + 50*Flame', () => {
  const r = run({ scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: 1 }, lanterns: [{ id: 'L1', deposited: 9 }, ...allButL1] }, inputs: { frames: press('interact', 0) }, ticks: 10 });
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: 10 + 100 + 2 * 299 + 50 * 3 });
});

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
  assert.equal(r.snap(0).time_left_s, 330);
  const end = r.snap(150).player;
  assert.equal(end.grounded, true);
  assert.ok(distXZ(end.pos, [70, 0, 0]) <= 28, `đáp ở ${end.pos}`);
});
