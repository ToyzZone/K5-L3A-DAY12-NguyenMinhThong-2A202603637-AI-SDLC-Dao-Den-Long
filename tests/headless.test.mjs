// Scenario headless cho các yêu cầu PRD-0 + Test Contract v1.0, kiểm tra trên đầu ra JSONL.
// Số liệu theo game.contract.json; luật theo docs/notes/phase-1.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, QUIET, distXZ } from './helpers.mjs';

const press = (button, at) => [{ tick: at, [button]: true }, { tick: at + 1, [button]: false }];

test('định dạng: snapshot tick 0 đầu tiên, snapshot mỗi N tick, dòng end cuối, đúng N bước', () => {
  const r = run({ ticks: 100, every: 10 });
  assert.equal(r.code, 0);
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.equal(r.snaps[0].sim_tick, 0);
  assert.equal(r.snaps[0].time_left_s, 300);
  assert.equal(r.snaps[0].lanterns.length, 5);
  assert.equal(r.snaps[0].motes_active, 20);
  assert.deepEqual(r.end, { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(r.snap(60).time_left_s, 299);
});

test('tất định: cùng seed + input ra file giống hệt; khác seed thì khác', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, ...press('pulse', 200), { tick: 400, move: [-1, 0] }, ...press('jump', 500)] };
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
  assert.equal(run({ inputs: { frames: [{ tick: 0, pulse: 'yes' }] } }).code, 2);
  assert.equal(run({ scenario: { lanterns: [{ id: 'L9', lit: true }] } }).code, 2);
  assert.equal(run({ scenario: { motes: [[0, 0]] } }).code, 2);
  assert.notEqual(run({ extraArgs: ['--night', '2'] }).code, 0);
});

test('di chuyển: player_speed, xoay theo cam_yaw_deg, chuẩn hóa vector, chặn mép đảo', () => {
  const go = (frame, scenario = QUIET) => run({ scenario, inputs: { frames: [{ tick: 0, ...frame }] }, ticks: 60 }).snap(60).player.pos;
  assert.deepEqual(go({ move: [0, 1] }), [0, 0, 6]);
  assert.deepEqual(go({ move: [0, 1], cam_yaw_deg: 90 }), [6, 0, 0]);
  assert.deepEqual(go({ move: [1, 1] }), [4.243, 0, 4.243]);
  assert.deepEqual(go({ move: [1, 0] }, { ...QUIET, player: { pos: [39, 0, 0] } }), [40, 0, 0]);
});

test('nhảy: Y tăng rồi về 0, cạnh lên mới kích hoạt', () => {
  const r = run({ scenario: QUIET, inputs: { frames: press('jump', 0) }, ticks: 60 });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 0.5);
  assert.equal(r.snap(60).player.pos[1], 0);
});

test('nhặt: tự động trong pickup_radius (biên tính là trong), đầy thì không nhặt', () => {
  const r = run({ scenario: { ...QUIET, motes: [[0, 0, 1.5]] }, ticks: 5 });
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(r.snap(1).score, 10);
  assert.equal(r.snap(1).motes_active, 0);
  assert.equal(run({ scenario: { ...QUIET, motes: [[0, 0, 1.51]] }, ticks: 30 }).events.length, 0);
  assert.equal(run({ scenario: { ...QUIET, player: { carried: 10 }, motes: [[0, 0, 1]] }, ticks: 30 }).events.length, 0);
});

test('đom đóm: nhặt một sinh một (cách Mây >= 8 m) khi random_motes bật', () => {
  const r = run({ scenario: { random_shades: false, shades: [], motes: [[0, 0, 1]] }, ticks: 1 });
  const s = r.snap(1);
  assert.equal(s.motes_active, 1);
  assert.equal(s.motes[0].id, 'M2');
  assert.ok(distXZ(s.motes[0].pos, s.player.pos) >= 8);
});

test('nạp và thắp: trong interact_radius, nạp một phần, đủ lantern_cost thì thắp + per_lantern', () => {
  const at = (carried, deposited = 0, pos = [0, 0, 22]) =>
    run({ scenario: { ...QUIET, player: { pos, carried }, lanterns: [{ id: 'L1', deposited }] }, inputs: { frames: press('interact', 0) }, ticks: 5 });
  const full = at(5);
  assert.deepEqual(full.events.map((e) => [e.tick, e.name, e.data]), [
    [1, 'deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }],
    [1, 'lantern_lit', { lantern_id: 'L1' }],
  ]);
  assert.equal(full.snap(1).score, 100);
  assert.equal(full.snap(1).lanterns[0].lit, true);
  const partial = at(3);
  assert.deepEqual(partial.events.map((e) => e.data), [{ lantern_id: 'L1', amount: 3, deposited: 3 }]);
  assert.equal(partial.snap(1).player.carried, 0);
  const topUp = at(3, 4);
  assert.equal(topUp.events[0].data.amount, 1);
  assert.equal(topUp.snap(1).player.carried, 2);
  assert.equal(at(5, 0, [0, 0, 21.9]).events.length, 0);
});

test('tỏa sáng: tốn pulse_cost, choáng đúng pulse_stun_s, đẩy pulse_push_m, cộng per_stun', () => {
  const r = run({ scenario: { ...QUIET, player: { carried: 2 }, shades: [{ id: 'S1', pos: [6, 1, 0] }] }, inputs: { frames: press('pulse', 0) }, ticks: 152 });
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } });
  const s1 = r.snap(1);
  assert.deepEqual(s1.shades[0], { id: 'S1', pos: [10, 1, 0], state: 'stunned' });
  assert.equal(s1.player.carried, 0);
  assert.equal(s1.score, 25);
  assert.equal(r.snap(150).shades[0].state, 'stunned');
  assert.deepEqual(r.snap(150).shades[0].pos, [10, 1, 0]);
  assert.equal(r.snap(151).shades[0].state, 'chase');
  assert.ok(r.snap(151).shades[0].pos[0] < 10);
});

test('tỏa sáng: thiếu ánh sáng thì không có gì; hồi chiêu đúng pulse_cooldown_s; trúng 0 con vẫn có sự kiện', () => {
  const none = run({ scenario: { ...QUIET, player: { carried: 1 } }, inputs: { frames: press('pulse', 0) }, ticks: 5 });
  assert.equal(none.events.length, 0);
  const pulses = (second) =>
    run({ scenario: { ...QUIET, player: { carried: 10 } }, inputs: { frames: [...press('pulse', 0), ...press('pulse', second)] }, ticks: 100 })
      .events.filter((e) => e.name === 'pulse').map((e) => [e.tick, e.data.stunned_ids]);
  assert.deepEqual(pulses(59), [[1, []]]);
  assert.deepEqual(pulses(60), [[1, []], [61, []]]);
});

test('tỏa sáng trúng con đang Choáng: đẩy lại, vẫn trong stunned_ids, không cộng per_stun lần nữa', () => {
  const r = run({ scenario: { ...QUIET, player: { carried: 4 }, shades: [{ id: 'S1', pos: [1, 1, 0] }] }, inputs: { frames: [...press('pulse', 0), ...press('pulse', 60)] }, ticks: 70 });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name]), [[1, 'pulse'], [61, 'pulse']]);
  assert.deepEqual(r.events[1].data.stunned_ids, ['S1']);
  assert.deepEqual(r.snap(61).shades[0].pos, [9, 1, 0]);
  assert.equal(r.snap(61).score, 25);
});

test('bị chạm: mất 1 Flame, rơi floor(carried*hit_drop_ratio), bất tử invuln_s, hết Flame thì thua', () => {
  const r = run({ scenario: { ...QUIET, player: { carried: 5 }, shades: [{ id: 'S1', pos: [1, 1, 0] }] }, ticks: 400 });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name, e.data]), [
    [1, 'player_hit', { by: 'shade', flames: 2, dropped: 2 }],
    [91, 'player_hit', { by: 'shade', flames: 1, dropped: 1 }],
    [181, 'player_hit', { by: 'shade', flames: 0, dropped: 1 }],
    [181, 'game_over', { result: 'lost', reason: 'no_flames' }],
  ]);
  assert.deepEqual(r.end, { type: 'end', ticks: 181, state: 'lost', score: 0 });
});

test('Vùng an toàn: chỉ quanh đèn đã Thắp, Bóng Mực không bao giờ ở trong safe_radius', () => {
  const lit = run({ scenario: { ...QUIET, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ id: 'S1', pos: [0, 1, 30] }] }, ticks: 300 });
  for (const s of lit.snaps.slice(1)) assert.ok(distXZ(s.shades[0].pos, s.lanterns[0].pos) > 5, `tick ${s.tick}`);
  assert.equal(lit.events.length, 0);
  const unlit = run({ scenario: { ...QUIET, player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 1, 30] }] }, ticks: 300 });
  assert.ok(unlit.events.some((e) => e.name === 'player_hit'));
});

test('Vùng an toàn: đèn vừa Thắp đẩy Bóng Mực đang ở trong ra mép ngay bước đó', () => {
  const r = run({
    scenario: { ...QUIET, player: { pos: [0, 0, 22], carried: 1 }, lanterns: [{ id: 'L1', deposited: 4 }], shades: [{ id: 'S1', pos: [2, 1, 25] }] },
    inputs: { frames: press('interact', 0) },
    ticks: 1,
  });
  assert.equal(r.events[1].name, 'lantern_lit');
  assert.ok(distXZ(r.snap(1).shades[0].pos, [0, 0, 25]) > 5);
});

test('kết thúc: Bình minh thua (dawn), dừng đúng tick, time_left_s lấy từ scenario', () => {
  const r = run({ scenario: { ...QUIET, time_left_s: 1 }, ticks: 100 });
  assert.equal(r.snap(0).time_left_s, 1);
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
});

test('kết thúc: thắp đèn cuối thì thắng, cộng per_second_left*floor(time_left) + per_flame_left*flames', () => {
  const r = run({
    scenario: { ...QUIET, player: { pos: [0, 0, 22], carried: 1 }, lanterns: [{ id: 'L1', deposited: 4 }, ...['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }))] },
    inputs: { frames: press('interact', 0) },
    ticks: 10,
  });
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: 100 + 2 * 299 + 50 * 3 });
});

test('dựng scenario không phát sự kiện, không cộng điểm', () => {
  const r = run({ scenario: { ...QUIET, lanterns: [{ id: 'L1', lit: true }] }, ticks: 10 });
  assert.equal(r.snap(0).score, 0);
  assert.equal(r.snap(0).lanterns[0].lit, true);
  assert.equal(r.events.length, 0);
});

test('Bóng Mực sinh theo nhịp 45 s, cách Mây >= 15 m, có sự kiện shade_spawned', () => {
  const r = run({ scenario: { random_motes: false, motes: [], shades: [] }, ticks: 2700, every: 2700 });
  assert.deepEqual(r.events, [{ type: 'event', tick: 2700, name: 'shade_spawned', data: { id: 'S1' } }]);
  assert.ok(distXZ(r.snap(2700).shades[0].pos, [0, 0, 0]) >= 15);
});
