// bench_cmd (Ticket-04 §1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Phục vụ dist/web, mở trình duyệt họ Chromium (profile tạm, cửa sổ 1280×720, tắt vsync) ở trang ?bench.
// Trang gửi về thời gian từng khung; script tính số đo, ghi bench.json, đóng trình duyệt, thoát mã 0.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { serve, WEB } from './server.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 1 ? process.argv[i + 1] : d; };
const int = (k, d) => { const v = arg(k, d); if (!/^\d+$/.test(v)) { console.error(`bench: --${k} phải là số nguyên`); process.exit(1); } return Number(v); };
const seed = int('seed', '42'), duration = int('duration', '30'), out = arg('out', 'bench.json');
if (!existsSync(join(WEB, 'index.html'))) { console.error('bench: chưa có dist/web, chạy `npm run build` trước.'); process.exit(1); }

const env = process.env, pf = env.PROGRAMFILES, pf86 = env['PROGRAMFILES(X86)'], la = env.LOCALAPPDATA;
const CANDIDATES = {
  darwin: ['Google Chrome.app/Contents/MacOS/Google Chrome', 'Chromium.app/Contents/MacOS/Chromium', 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Brave Browser.app/Contents/MacOS/Brave Browser']
    .flatMap((p) => [`/Applications/${p}`, join(os.homedir(), 'Applications', p)]),
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']
    .flatMap((b) => ['/usr/bin/', '/usr/local/bin/', '/snap/bin/', '/opt/google/chrome/'].map((d) => d + b)),
  win32: [[pf, 'Google/Chrome/Application/chrome.exe'], [pf86, 'Google/Chrome/Application/chrome.exe'], [la, 'Google/Chrome/Application/chrome.exe'],
    [pf86, 'Microsoft/Edge/Application/msedge.exe'], [pf, 'Microsoft/Edge/Application/msedge.exe'], [la, 'Chromium/Application/chrome.exe']]
    .filter(([base]) => base).map(([base, p]) => join(base, p)),
};
const exe = env.BENCH_BROWSER ?? (CANDIDATES[process.platform] ?? []).find((p) => existsSync(p));
if (!exe) { console.error('bench: không tìm thấy Chrome/Edge/Chromium. Đặt BENCH_BROWSER=<đường dẫn trình duyệt họ Chromium>.'); process.exit(1); }

let loadMs = null, browser = null;
const profile = mkdtempSync(join(os.tmpdir(), 'ddl-bench-'));
const finish = (code) => { try { browser?.kill(); } catch { /* đã tắt */ } setTimeout(() => { rmSync(profile, { recursive: true, force: true }); process.exit(code); }, 500); };
const timer = setTimeout(() => { console.error('bench: quá thời gian chờ trang bench'); finish(1); }, (duration + 60) * 1000);

const { server, url } = await serve({
  'POST /bench/first': () => { loadMs ??= Math.round(performance.now()); }, // performance.now() của Node tính từ lúc tiến trình bắt đầu
  'POST /bench/result': ({ dts, renderer }) => {
    const n = dts.length, sum = dts.reduce((a, b) => a + b, 0), sorted = [...dts].sort((a, b) => a - b);
    const k = Math.max(1, Math.ceil(0.01 * n)), worst = sorted.slice(-k);
    const r2 = (x) => Math.round(x * 100) / 100;
    const avgFps = (1000 * n) / sum;
    const result = {
      contract_version: JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8')).contract_version,
      avg_fps: r2(avgFps),
      p1_low_fps: r2(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
      frame_ms_p95: r2(sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)]),
      frames: n,
      load_ms: loadMs,
      peak_mem_mb: null, // bản web: trang không đọc được RSS của tiến trình trình duyệt (xem README)
      // Chromium chạy với --disable-gpu-vsync --disable-frame-rate-limit; chỉ ghi true khi số đo vượt hẳn 60 Hz (không bị khóa theo màn hình).
      vsync_off: avgFps > 75,
      renderer: `${renderer} · ${exe.split(/[\\/]/).pop()} · three.js r187`,
      os: `${os.type()} ${os.release()} ${os.arch()} · ${os.cpus()[0]?.model ?? '?'} · ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
    };
    writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    clearTimeout(timer);
    server.close();
    finish(0);
  },
});

browser = spawn(exe, [
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
  '--window-size=1280,720', '--window-position=0,0', `--app=${url}?bench&seed=${seed}&duration=${duration}`,
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // tắt vsync và trần khung hình
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
], { stdio: 'ignore' });
browser.on('error', (e) => { console.error(`bench: không mở được ${exe}: ${e.message}`); finish(1); });
