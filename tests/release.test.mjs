// Ticket-04: soak test, cảnh benchmark, bảng xếp hạng (lệnh xuất).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { benchWorld } from '../dist/sim/bench.js';
import { idleInput, step } from '../dist/sim/game.js';

const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'ddl-rel-'));
// Chạy đúng chuỗi lệnh trong contract + tham số, như máy chấm.
const sh = (cmd, args) => spawnSync(`${cmd} ${args}`, { shell: true, encoding: 'utf8' });

test('soak: 10 Đêm trong một tiến trình, không crash, đủ trường, kết quả tất định, RSS ≤ 1.2×', () => {
  const runSoak = (out) => {
    const r = sh(contract.soak_cmd, `--seed 7 --nights 10 --out ${out}`);
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(readFileSync(out, 'utf8'));
  };
  const a = runSoak(join(dir, 'soak-a.json')), b = runSoak(join(dir, 'soak-b.json'));
  assert.deepEqual(Object.keys(a), ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']);
  assert.equal(a.nights, 10);
  assert.equal(a.crashes, 0);
  assert.equal(a.results.length, 10);
  for (const r of a.results) assert.ok(r === 'won' || r === 'lost', r);
  assert.deepEqual(a.results, b.results); // cùng seed → cùng kết quả
  assert.ok(a.mem_end_mb <= 1.2 * a.mem_start_mb, `${a.mem_end_mb} > 1.2 × ${a.mem_start_mb}`);
});

test('cảnh bench: 200 Bóng Mực luôn wander, 100 đom đóm, L1–L3 dầu 100, không sát thương/nhặt/hao dầu/kết thúc', () => {
  const w = benchWorld(42);
  assert.equal(w.night, 1);
  assert.equal(w.shades.length, 200);
  assert.equal(w.motes.length, 100);
  assert.deepEqual(w.player.pos, [0, 0, 0]);
  const evs = [];
  for (let k = 0; k < 240 * 60 + 600; k++) evs.push(...step(w, idleInput())); // quá thời lượng Đêm 1
  assert.equal(w.state, 'playing');
  assert.deepEqual(evs.map((e) => e.name), []);
  assert.equal(w.shades.length, 200);
  assert.ok(w.shades.every((s) => s.state === 'wander'));
  assert.equal(w.motes.length, 100);
  assert.deepEqual(w.lanterns.map((l) => [l.id, l.lit, l.fuel / 60]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.equal(w.player.flames, 3);
  // Rải đều: các Bóng Mực phủ đủ 4 góc phần tư của đảo lúc đầu.
  const q = new Set(benchWorld(42).shades.map((s) => `${s.pos[0] > 0}${s.pos[2] > 0}`));
  assert.equal(q.size, 4);
});

test('bảng xếp hạng: <run_cmd> --export-leaderboard cho top 10 đúng thứ tự (bằng điểm: ai trước đứng trên), bỏ mục sai', () => {
  const file = join(dir, 'lb.json'), out = join(dir, 'export.json');
  const at = (m) => `2026-11-20T10:${String(m).padStart(2, '0')}:00+07:00`;
  const entries = Array.from({ length: 12 }, (_, i) => ({ name: `P_${i}`, score: [50, 900, 300, 300, 10, 700, 300, 0, 120, 60, 40, 20][i], nights_won: 1, achieved_at: at(59 - i), seed: i }));
  entries.push({ name: 'x', score: 9999, nights_won: 3, achieved_at: at(1), seed: 1 }); // tên quá ngắn: bỏ
  writeFileSync(file, JSON.stringify({ entries }));
  const r = spawnSync(`${contract.run_cmd} --export-leaderboard ${out}`, { shell: true, encoding: 'utf8', env: { ...process.env, DDL_LEADERBOARD: file } });
  assert.equal(r.status, 0, r.stderr);
  const got = JSON.parse(readFileSync(out, 'utf8')).entries;
  // 300 điểm có P_2 (10:57), P_3 (10:56), P_6 (10:53): người đạt sớm hơn đứng trên.
  assert.deepEqual(got.map((e) => e.name), ['P_1', 'P_5', 'P_6', 'P_3', 'P_2', 'P_8', 'P_9', 'P_0', 'P_10', 'P_11']);
  assert.deepEqual(Object.keys(got[0]), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  // Chưa có file: bảng trống, vẫn thoát 0.
  const r2 = spawnSync(`${contract.run_cmd} --export-leaderboard ${out}`, { shell: true, encoding: 'utf8', env: { ...process.env, DDL_LEADERBOARD: join(dir, 'none.json') } });
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), { entries: [] });
});

test('bảng xếp hạng: server lưu ra đĩa, từ chối tên sai, còn sau khi khởi động lại', async () => {
  const file = join(dir, 'lb-server.json');
  process.env.DDL_LEADERBOARD = file;
  const { serve, readBoard } = await import(`../scripts/server.mjs?t=${Date.now()}`);
  const { server, url } = await serve({}, 0);
  const post = (e) => fetch(`${url}api/leaderboard`, { method: 'POST', body: JSON.stringify(e) });
  const ok = { name: 'Thong_01', score: 420, nights_won: 2, achieved_at: '2026-11-20T17:00:00+07:00', seed: 9 };
  assert.equal((await post({ ...ok, name: 'ab' })).status, 400);
  assert.equal((await post({ ...ok, name: 'Đăng' })).status, 400); // chỉ A–Z, 0–9, _
  assert.equal((await post({ ...ok, nights_won: 4 })).status, 400);
  assert.equal((await post(ok)).status, 200);
  server.close();
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).entries, [ok]); // đã ghi đĩa
  assert.deepEqual(readBoard(), [ok]);
});
