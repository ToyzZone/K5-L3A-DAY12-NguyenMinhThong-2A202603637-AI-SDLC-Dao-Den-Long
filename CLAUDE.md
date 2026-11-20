# Đảo Đèn Lồng: hướng dẫn cho agent

Game 3D bằng TypeScript. Lõi mô phỏng thuần ở `src/sim/` (tất định, không DOM, không Three.js), headless ở `src/headless.ts`, giao diện Three.js ở `src/web/`.

## Lệnh
- Build headless: `npm run build` (tsc → `dist/`)
- Test: `npm test` (build rồi chạy node:test trên đầu ra của `dist/headless.js`)
- Chơi: `npm run play` (server Node, bảng xếp hạng ra đĩa); dev: `npm run dev`
- Bằng chứng: `scripts/proof.sh <phase>` (xem skill `proof`)
- Bench / soak: `npm run bench`, `npm run soak` (ra `bench.json`, `soak.json` ở gốc repo)

## Phạm vi hiện tại (contract v1.3, Ticket-02 + 03 + 04)
- Số chuẩn nằm ở `src/sim/tuning.ts` (`TUNING` = khóa contract, `RULES` = số chuẩn khác), bản đồ chuẩn ở `src/sim/maps.ts`. Không tự chọn số nữa.
- Thứ tự trong `step()` phải đúng 12 bước của Ticket-02. Bộ đếm lưu dạng "until" theo `sim_tick`, không theo `tick` (tạm dừng chỉ tăng `tick`).
- Mỗi tính năng mới cần ít nhất 1 scenario headless trong `tests/headless.test.mjs`.
- Dầu đèn lưu số nguyên đơn vị 1/60 (`Lantern.fuel`); Vùng an toàn dùng `hasSafeZone()`, không dùng `l.lit`.
- Luật bị ticket mới [THAY THẾ]: cập nhật `CHANGELOG.md`, ghi test bị sửa hoặc xóa vào `docs/notes/phase-N.md`, viết ADR nếu đổi mô hình.
- Ticket-04: `World.bench` chỉ cảnh benchmark được bật (`src/sim/bench.ts`); headless/scenario không bao giờ bật. Đổi `src/sim/` thì so đầu ra headless Đêm 1–3 trước/sau bằng `cmp`.
- Lệnh contract phải chạy đúng như máy chấm gõ: `run_cmd`/`bench_cmd`/`soak_cmd` + tham số (test trong `tests/release.test.mjs` chạy đúng chuỗi lệnh đó). `build_cmd` phải tạo cả `dist/web`.
- `src/web/main.ts` không được import file chưa commit (vite build hỏng → `build_cmd` hỏng → test ẩn hỏng). Sáng tạo thêm phải tắt khi `?bench`.

## Quy tắc
- Test Contract trong `docs/lab/` là luật cứng. Luật chơi đã chốt nằm ở `docs/notes/phase-N.md`, thuật ngữ ở `GLOSSARY.md`. Không tự bịa luật; chỗ mơ hồ thì hỏi người dùng rồi ghi vào notes.
- Đổi số trong `src/sim/tuning.ts` thì đổi luôn `game.contract.json` (test đỏ nếu lệch).
- `src/sim/` không dùng `Math.random`, `Date`, `performance.now`, DOM. Mọi ngẫu nhiên đi qua `w.rng`.
- Phần sáng tạo thêm chỉ nằm ở `src/web/` và không được đổi đầu ra headless.
- Test viết trên đầu ra JSONL của `dist/headless.js`, không trên state nội bộ.
- Không sửa tay file trong `docs/proof/`; chỉ sinh lại bằng `scripts/proof.sh`.
- Trước khi gắn tag: `git status` sạch, rồi clone sạch repo, chạy `build_cmd` và `npm test` trong bản clone. Test xanh trên máy không chứng minh được gì nếu file chưa commit.
- Yêu cầu mới làm sai test cũ: sửa hoặc xóa test kèm lý do trong `docs/notes/`, không skip âm thầm.
- Không commit `.env`, key, token.
