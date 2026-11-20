# Đảo Đèn Lồng: hướng dẫn cho agent

Game 3D bằng TypeScript. Lõi mô phỏng thuần ở `src/sim/` (tất định, không DOM, không Three.js), headless ở `src/headless.ts`, giao diện Three.js ở `src/web/`.

## Lệnh
- Build headless: `npm run build` (tsc → `dist/`)
- Test: `npm test` (build rồi chạy node:test trên đầu ra của `dist/headless.js`)
- Chơi: `npm run play`
- Bằng chứng: `scripts/proof.sh <phase>` (xem skill `proof`)

## Quy tắc
- Test Contract trong `docs/lab/` là luật cứng. Luật chơi đã chốt nằm ở `docs/notes/phase-N.md`, thuật ngữ ở `GLOSSARY.md`. Không tự bịa luật; chỗ mơ hồ thì hỏi người dùng rồi ghi vào notes.
- Đổi số trong `src/sim/tuning.ts` thì đổi luôn `game.contract.json` (test đỏ nếu lệch).
- `src/sim/` không dùng `Math.random`, `Date`, `performance.now`, DOM. Mọi ngẫu nhiên đi qua `w.rng`.
- Phần sáng tạo thêm chỉ nằm ở `src/web/` và không được đổi đầu ra headless.
- Test viết trên đầu ra JSONL của `dist/headless.js`, không trên state nội bộ.
- Không sửa tay file trong `docs/proof/`; chỉ sinh lại bằng `scripts/proof.sh`.
- Yêu cầu mới làm sai test cũ: sửa hoặc xóa test kèm lý do trong `docs/notes/`, không skip âm thầm.
- Không commit `.env`, key, token.
