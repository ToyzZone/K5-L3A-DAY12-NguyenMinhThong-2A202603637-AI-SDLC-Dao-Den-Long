// Luật bảng xếp hạng Ticket-04 §3, dùng chung cho server (Node) và giao diện (trình duyệt). Không đụng đĩa ở đây.
export const NAME_RE = /^[A-Za-z0-9_]{3,12}$/;
export const TOP = 10;

// ISO 8601 có múi giờ địa phương, vd. 2026-11-20T16:45:12+07:00.
export function isoNow(d = new Date()) {
  const p = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0'), off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${p(off / 60)}:${p(off % 60)}`;
}

// Trả lỗi (chuỗi) hoặc null nếu mục hợp lệ.
export function entryError(e) {
  if (!e || typeof e !== 'object') return 'mục không phải object';
  if (typeof e.name !== 'string' || !NAME_RE.test(e.name)) return 'tên phải 3–12 ký tự A–Z, a–z, 0–9 hoặc _';
  if (!Number.isInteger(e.score) || e.score < 0) return 'score phải là số nguyên ≥ 0';
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) return 'nights_won phải từ 0 tới 3';
  if (typeof e.achieved_at !== 'string' || Number.isNaN(Date.parse(e.achieved_at))) return 'achieved_at phải là ISO 8601';
  if (!Number.isInteger(e.seed)) return 'seed phải là số nguyên';
  return null;
}

// Top 10: điểm giảm dần; bằng điểm thì ai đạt trước đứng trên.
export function rank(entries) {
  return entries
    .filter((e) => entryError(e) === null)
    .map(({ name, score, nights_won, achieved_at, seed }) => ({ name, score, nights_won, achieved_at, seed }))
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at))
    .slice(0, TOP);
}
