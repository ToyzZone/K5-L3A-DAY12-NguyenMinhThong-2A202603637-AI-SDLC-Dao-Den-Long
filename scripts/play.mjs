// run_cmd: `node scripts/play.mjs` mở game (dist/web + bảng xếp hạng lưu ở leaderboard.json).
//          `node scripts/play.mjs --export-leaderboard out.json` chỉ xuất bảng xếp hạng rồi thoát.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openUrl, readBoard, serve, WEB } from './server.mjs';

const i = process.argv.indexOf('--export-leaderboard');
if (i > 1) {
  const out = process.argv[i + 1];
  if (!out) { console.error('cách dùng: node scripts/play.mjs --export-leaderboard out.json'); process.exit(1); }
  writeFileSync(out, JSON.stringify({ entries: readBoard() }, null, 2) + '\n');
  process.exit(0);
}
if (!existsSync(join(WEB, 'index.html'))) { console.error('Chưa có bản build web: chạy `npm run build` trước.'); process.exit(1); }
// Cổng cố định để cài đặt (lưu localStorage theo origin) còn nguyên giữa các lần mở.
const { url } = await serve({}, Number(process.env.PORT ?? 5174));
console.log(`Đảo Đèn Lồng đang chạy ở ${url} (Ctrl+C để thoát)`);
if (!process.env.NO_OPEN) openUrl(url);
