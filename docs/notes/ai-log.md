# Nhật ký dùng AI

Công cụ chính: Claude Code (VS Code extension), model Claude Opus 5.5 / Fable 5.2, một phiên chính điều phối và vài subagent chạy nền.

## Harness

| Thành phần | Ở đâu | Dùng khi |
|---|---|---|
| `CLAUDE.md` | repo | Mọi lượt: lệnh build/test, quy tắc tất định, cấm sửa tay bằng chứng |
| Skill `proof` + `scripts/proof.sh` | repo | Trước khi gắn tag: chạy test, chạy mẫu 2 lần so sánh, ghi `docs/proof/phase-N/` |
| Stop hook `.claude/hooks/stop-tests.sh` | repo | Mỗi lần agent định kết thúc lượt: chạy `npm test`, đỏ thì chặn (mã 2) |
| CI `.github/workflows/test.yml` | repo | Mỗi lần push: build như máy chấm, chạy headless, chạy test trên Node 20 và 24 |
| Subagent review độc lập | phiên Claude Code | Agent khác (không phải agent viết code) đối chiếu headless với PRD-0 |
| Skill `grill-with-docs` (mattpocock-skills) | plugin ngoài repo | Phase 1: phỏng vấn làm rõ yêu cầu (21 câu), ghi GLOSSARY + ADR |
| Plugin `ponytail`, `superpowers`, công cụ `advisor` | plugin ngoài repo | Giữ code tối giản; advisor rà kế hoạch trước khi build |

## Các lời nhắc chính

- "đọc qua repo lab 12 …" → tóm tắt đề, rubric, Test Contract.
- "/mattpocock-skills:grill-with-docs" → 2 vòng hỏi đáp, chốt Q1–Q21 (`docs/notes/phase-1.md`).
- "1 ok dùng type script … 5 b …" → chốt stack TS và Vùng an toàn chỉ quanh đèn đã Thắp.
- Giao subagent: giao diện Three.js (brief có điều khiển, HUD, phong cách PRD), đọc tab Phase 2 qua Safari, review độc lập.
- "đồ hoạ xấu quá, dùng agent fable /design … 1 option dùng Jack J97, Đom Đóm, Thiên Lý Ơi" → agent tạo 3 theme + `preview.html` (chỉ file mới, không đụng `main.ts` của phiên Phase 2). Option Đom Đóm chỉ dùng mô-típ tự làm (đom đóm, giàn thiên lý), không ảnh/tên trong game. Nhạc "Thiên Lý Ơi": người dùng chọn dùng (dự án học tập, không phát hành); file do người dùng tự đặt ở `public/music/thien-ly-oi.mp3`, đã gitignore nên không vào repo/bài nộp; thiếu file thì game im lặng.

## Lỗi của AI và cách xử lý

| Lỗi | Phát hiện thế nào | Sửa / chỉnh harness |
|---|---|---|
| Buổi làm rõ yêu cầu không giới hạn thời gian, ăn hết 60 phút Phase 1, không kịp code | Chạy `date` trước khi build: 15:29, hạn 15:30 | Gắn tag `phase-1` trung thực ("chưa đạt"); từ Phase 2 giới hạn làm rõ ≤ 10 phút, headless trước |
| Agent đề xuất "bypass" trợ giảng bằng cách đọc kho tri thức của trang | Người dùng hỏi; agent tự kiểm mã nguồn trang | Từ chối lấy nguyên kho và phase chưa mở (RULES mục 11); chỉ hỏi trợ giảng như học viên |
| Đọc lab board bằng công cụ Artifact chỉ ra HTML tĩnh, không có phase mới | Agent đọc trả về "Chưa phát hành" | Đọc qua Safari đã đăng nhập |
| Rủi ro test "luôn đạt" | Tự kiểm: cài 4 lỗi vào lõi (bất tử lệch 1 tick, biên Vùng an toàn, vùng cho đèn chưa Thắp, làm tròn số rơi) | Cả 4 bị test bắt; giữ quy tắc "test trên JSONL của dist/headless.js" trong CLAUDE.md |

## Token và chi phí

| Phase | Ước tính | Ghi chú tiết kiệm |
|---|---|---|
| 1 | *(chờ số `/cost`)* | Đọc đề bằng 1 lần clone; hỏi theo vòng có đề xuất sẵn để trả lời "ok" |
| 2 | *(chờ số `/cost`)* | Subagent chạy nền cho giao diện/review, phiên chính không đọc file dài của subagent |
