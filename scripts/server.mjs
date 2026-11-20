// Server tĩnh không phụ thuộc (chỉ Node): phục vụ dist/web và API bảng xếp hạng lưu trên đĩa.
// Dùng bởi scripts/play.mjs (run_cmd) và scripts/bench.mjs (bench_cmd).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryError, rank } from './leaderboard.mjs';

const env = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WEB = join(ROOT, 'dist', 'web');
export const BOARD_FILE = env.DDL_LEADERBOARD ?? join(ROOT, 'leaderboard.json');

export function readBoard() {
  try { return rank(JSON.parse(readFileSync(BOARD_FILE, 'utf8')).entries ?? []); } catch { return []; } // chưa có file = bảng trống
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const send = (res, code, body, type = 'application/json') =>
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }).end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));

function readJson(req) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 8e6) { req.destroy(); fail(new Error('quá lớn')); } else chunks.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { fail(e); } });
    req.on('error', fail);
  });
}

// routes: { 'POST /đường-dẫn': async (body) => trả về JSON } cho bench.
export function serve(routes = {}, port = 0) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (env.DDL_LOG) console.error(`${Math.round(performance.now())} ms ${req.method} ${path}`);
    try {
      const route = routes[`${req.method} ${path}`];
      if (route) return send(res, 200, (await route(req.method === 'POST' ? await readJson(req) : {})) ?? {});
      if (path === '/api/leaderboard' && req.method === 'GET') return send(res, 200, { entries: readBoard() });
      if (path === '/api/leaderboard' && req.method === 'POST') {
        const e = await readJson(req), err = entryError(e);
        if (err) return send(res, 400, { error: err });
        const entries = rank([...readBoard(), e]);
        writeFileSync(BOARD_FILE, JSON.stringify({ entries }, null, 2) + '\n');
        return send(res, 200, { entries });
      }
      if (req.method !== 'GET') return send(res, 405, { error: 'method' });
      const file = resolve(WEB, '.' + (path.endsWith('/') ? path + 'index.html' : path));
      if (!file.startsWith(WEB + sep)) return send(res, 403, 'forbidden', 'text/plain');
      send(res, 200, readFileSync(file), TYPES[extname(file)] ?? 'application/octet-stream');
    } catch (e) {
      send(res, e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500, String(e.message ?? e), 'text/plain');
    }
  });
  return new Promise((ok) => {
    server.once('error', () => server.listen(0, '127.0.0.1')); // cổng bận: lấy cổng trống
    server.listen(port, '127.0.0.1', () => {});
    server.on('listening', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

export function openUrl(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}
