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
- "đồ hoạ xấu quá, dùng agent fable /design … 1 option theo phong cách một ca sĩ và bài hát nổi tiếng" (tên không ghi vào repo) → agent tạo 3 theme + `preview.html` (chỉ file mới, không đụng `main.ts` của phiên Phase 2). Option đó chỉ dùng mô-típ tự làm (đom đóm, giàn thiên lý), không ảnh/tên trong game. Nhạc nền: người dùng chọn dùng (dự án học tập, không phát hành); file do người dùng tự đặt ở `music/nhac-nen.mp3` (ngoài `public/` nên `vite build` không chép vào bản phát hành, chỉ phát khi chạy dev), đã gitignore nên không vào repo/bài nộp; thiếu file thì game im lặng.
- "chốt ý tưởng chạy show … kẹp thêm 1 bản mượt (sơn mài)", "1 có, 2 bỏ" → `src/web/skin.ts` phủ theme lên vật thể của main.ts (dev: Chạy Show, build: Sơn Mài, `?theme=classic` tắt, `?bench` tắt hẳn). Bỏ tên ca sĩ/bài hát khỏi file commit; nhạc và câu meme nằm ở `music/` (gitignore), chỉ đọc khi chạy dev. Lỗi AI tự bắt khi kiểm tra bằng Chrome headless: sân khấu/antifan tạo lại mỗi khung (quên lưu cache), số PointLight gấp đôi làm vỡ shader, theme che mất dấu hiệu chế độ mù màu, đèn bị ACES làm nhạt màu.
- Sau lab: "check xem lab này tôi xong chưa, dùng browser driver để test game và quay video" → agent clone sạch từng tag, chạy lại build, test và bằng chứng; viết driver Playwright + Edge (ngoài repo) kiểm 57 mục giao diện trên `phase-4` và 63 mục trên `main`, cho bot chơi trọn Đêm 1; dựng `demo.mp4` từ chính các lần chạy đó. "video ko có tiếng à, import nhạc … vào cả video" → ghép `music/nhac-nen.mp3` lặp suốt video. Người dùng chọn giữ nhạc và ghi rõ nguồn trong CREDITS, đổi lại quyết định "không ghi tên" ở trên. Từ đây bản nhạc có trong bài nộp, nhưng chỉ trong video; file nhạc vẫn nằm ngoài repo và bản build.

## Lỗi của AI và cách xử lý

| Lỗi | Phát hiện thế nào | Sửa / chỉnh harness |
|---|---|---|
| Buổi làm rõ yêu cầu không giới hạn thời gian, ăn hết 60 phút Phase 1, không kịp code | Chạy `date` trước khi build: 15:29, hạn 15:30 | Gắn tag `phase-1` trung thực ("chưa đạt"); từ Phase 2 giới hạn làm rõ ≤ 10 phút, headless trước |
| Agent đề xuất "bypass" trợ giảng bằng cách đọc kho tri thức của trang | Người dùng hỏi; agent tự kiểm mã nguồn trang | Từ chối lấy nguyên kho và phase chưa mở (RULES mục 11); chỉ hỏi trợ giảng như học viên |
| Đọc lab board bằng công cụ Artifact chỉ ra HTML tĩnh, không có phase mới | Agent đọc trả về "Chưa phát hành" | Đọc qua Safari đã đăng nhập |
| Rủi ro test "luôn đạt" | Tự kiểm: cài 4 lỗi vào lõi (bất tử lệch 1 tick, biên Vùng an toàn, vùng cho đèn chưa Thắp, làm tròn số rơi) | Cả 4 bị test bắt; giữ quy tắc "test trên JSONL của dist/headless.js" trong CLAUDE.md |
| Agent sửa `src/headless.ts` cho v1.1 nhưng không `git add` file đó; tag `phase-2` và `phase-3` chứa bản headless cũ (không có `night_start`, chặn `--night 2`, dừng vòng lặp khi tạm dừng) dù test và CI local đều xanh trên thư mục làm việc | 16:14 `git status` thấy `M src/headless.ts` sau khi gắn tag phase-3; xác nhận bằng `git show phase-3:src/headless.ts` | Commit bản sửa, clone sạch chạy `build_cmd` + test (37/37), được người dùng đồng ý thì gắn lại `phase-3` (5f115da) và `phase-2` (commit phụ 449d860 = c930352 + headless.ts, 26/26 test). Harness: `proof.sh` từ chối chạy khi còn thay đổi chưa commit; CLAUDE.md bắt clone sạch trước khi gắn tag |

| Bộ nhớ soak tăng 1.85× (ngưỡng 1.2×) dù game không rò rỉ | Chạy soak 3 lần trước khi tin; đo `heapUsed` theo từng Đêm (đứng yên 4.1 → 4.6 MB) và thử 6 cấu hình cờ Node | Chọn `--jitless --max-semi-space-size=1` (1.08×), so `results` có/không cờ giống hệt, ghi số đo vào notes; CI chạy soak trên Linux Node 20/24 |
| Bench lần đầu `p1_low_fps` 20.7 < 30 | Ghi `dt` từng khung: giật dồn từ giây 17, load average 16, GPU Safari TP đang vẽ trang khác | Nhờ phiên kia tạm dừng trang WebGL, đo lại 77.5; ghi cả hai số trong notes thay vì chỉ giữ số đẹp |
| Phiên khác gửi 4 dòng hook import `skin.js` chưa commit vào `main.ts` | Rà trước khi áp: commit `main.ts` một mình sẽ làm clone sạch không `vite build` được, kéo theo `build_cmd` và test ẩn | Chưa áp; hook phải vào chung commit với `skin.ts` khi người dùng duyệt |
| Giao diện Phase 3/Night 3 chưa từng được xem chạy thật (tab Safari ẩn không vẽ) | Advisor nhắc: build xanh không có nghĩa là UI đúng | Viết script CDP điều khiển Edge headless: bấm qua menu → cài đặt → đổi phím → chơi → thua → lưu tên, chụp màn hình và đo cỡ chữ nhỏ nhất bằng `getComputedStyle` |

## Token và chi phí

Lấy từ trường `usage` trong transcript của Claude Code, chia theo giờ phát hành từng phase (Phase 1 tới 15:30, Phase 2 tới 16:03, Phase 3 tới 16:39, Phase 4 tới lúc ghi). Đơn vị: nghìn token. "Đọc cache" là ngữ cảnh được dùng lại với giá rẻ; "ghi cache" và "đầu ra" mới là phần đắt.

| Phase | Phiên | Đầu ra | Ghi cache | Đọc cache | Ghi chú tiết kiệm |
|---|---|---|---|---|---|
| 1 | chính | 56 | 194 | 3 171 | Hỏi theo vòng có đề xuất sẵn để người dùng trả lời "ok" |
| 2 | chính + subagent | 130 + 86 | 171 + 383 | 7 243 + 3 898 | Subagent chạy nền cho giao diện/review; phiên chính chỉ đọc báo cáo |
| 3 | chính + subagent | 84 + 74 | 204 + 615 | 17 118 + 8 043 | Subagent đọc lab board bằng Safari tốn ghi cache nhiều nhất |
| 4 | chính + subagent | 106 + 17 | 175 + 38 | 11 086 + 2 500 | Tự làm UI thay vì giao subagent (đã có `main.ts` trong ngữ cảnh) |
| **Tổng phiên làm bài** | | **≈ 553** | **≈ 1 780** | **≈ 53 060** | |
| Phiên theme (sáng tạo, chưa vào v1.0.0) | lab-12-ac | 326 | 1 387 | 35 404 | Chạy song song, không chặn phiên chính |
| Kiểm tra sau lab và video demo | phiên riêng (Fable 5.2) | 383 | 757 | 41 587 | Thử bot trên lõi mô phỏng trước khi chạy trong trình duyệt; dựng video từ các đoạn đã quay, không quay lại cả buổi |

Không quy ra tiền vì chưa có bảng giá chắc chắn cho model đang dùng. Cách đã tiết kiệm:
- giao subagent các việc đọc nhiều (lab board, review) và chỉ nhận báo cáo ngắn;
- dùng script (`proof.sh`, CDP, đọc `usage` từ transcript) thay cho đọc tay nhiều lần;
- đọc từng đoạn file thay vì cả file;
- không chạy workflow nhiều agent.
