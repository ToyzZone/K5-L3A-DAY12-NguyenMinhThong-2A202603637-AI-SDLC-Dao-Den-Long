import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TUNING } from '../dist/sim/tuning.js';

const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));

test('game.contract.json có đủ trường bắt buộc của contract v1.3', () => {
  assert.equal(contract.contract_version, '1.3');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.equal(typeof contract[k], 'string', k);
  assert.equal(contract.headless_cmd, 'node dist/headless.js');
});

test('tuning trong contract khớp đúng số game đang dùng (chặn lệch số)', () => {
  assert.deepEqual(contract.tuning, TUNING);
});

test('lõi mô phỏng không dùng nguồn không tất định', () => {
  for (const f of readdirSync('src/sim')) {
    const code = readFileSync(`src/sim/${f}`, 'utf8');
    assert.doesNotMatch(code, /Math\.random|Date\.|new Date|performance\.now/, f);
  }
});
