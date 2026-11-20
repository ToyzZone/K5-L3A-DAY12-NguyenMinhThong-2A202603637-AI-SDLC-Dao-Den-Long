# Retro: Đảo Đèn Lồng (4 phase)

## Tổng hợp Evaluation

| Phase | Tag | Kết quả chính | Test tại tag |
|---|---|---|---|
| 1. PRD-0, contract v1.0 | `phase-1` | **Chưa đạt phần game.** Làm rõ 21 giả định, viết GLOSSARY và ADR, nhưng hết giờ trước khi kịp code | 0 |
| 2. Ticket-02, v1.1 | `phase-2` | Đạt headless Đêm 1–2 với số chuẩn, 5 trạng thái Bóng Mực, Lướt, Tạm dừng, Gió Lạc; có giao diện 3D. Đêm 3 bị trễ sang Phase 3 | 26/26 |
| 3. Ticket-03, v1.2 | `phase-3` | Đạt: dầu đèn, `drain`, luật thắng ở bình minh, điểm mới, sức chứa, thanh dầu, chế độ mù màu | 37/37 (sau đó 41 khi thêm Đêm 3) |
| 4. Ticket-04, v1.3 | `phase-4`, `v1.0.0` | Đạt bench (174 / 77.5 / 2.9 s), soak (0 crash, 1.09×), bảng xếp hạng, hỗ trợ tiếp cận, đóng gói | 45/45 |

Chi tiết và bằng chứng: [phase-1](phase-1.md), [phase-2](phase-2.md), [phase-3](phase-3.md), [phase-4](phase-4.md).

## Điều hiệu quả khi làm với AI

- **Lõi sim thuần, test trên JSONL:** headless và giao diện dùng chung `src/sim/`, và mọi test chạy trên đầu ra của `dist/headless.js` giống như máy chấm. Khi ticket đổi luật, test đỏ đúng chỗ và AI sửa có mục tiêu. Thử cài 4 lỗi giả vào lõi thì test bắt cả 4.
- **So từng byte trước và sau:** khi thêm cờ bench vào sim, chụp 18 lần chạy headless trước khi sửa rồi `cmp` sau khi sửa. Nhờ vậy chắc chắn đầu ra không đổi, không cần đoán.
- **Subagent cho việc đọc nhiều:** đọc lab board qua Safari, review độc lập. Phiên chính chỉ nhận báo cáo ngắn nên ngữ cảnh gọn.
- **Advisor trước khi làm:** ở Phase 4, advisor chỉ ra trước các bẫy: `npm run play --flag` bị npm nuốt mất cờ, `build_cmd` phải tạo cả `dist/web`, soak dễ trượt vì RSS, và UI chưa từng được xem chạy thật. Cả bốn đều đúng.

## Điều không hiệu quả

- **Phase 1 không giới hạn thời gian làm rõ yêu cầu.** Hỏi 21 câu, mỗi câu đều hợp lý, nhưng hết 60 phút mà không có dòng code nào.
- **Tin test xanh trên thư mục làm việc.** Tag `phase-2` và `phase-3` từng chứa bản `src/headless.ts` cũ vì file chưa được `git add`, dù test chạy local đều xanh.
- **Giao diện chỉ được kiểm bằng "build đạt" suốt Phase 2–3**, vì tab Safari của agent bị ẩn nên không vẽ. Tới Phase 4 mới có script CDP để chạy thật.

## Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện |
|---|---|
| Không commit `src/headless.ts`, nên tag chứa CLI cũ | `git status` sau khi gắn tag; `git show phase-3:src/headless.ts` |
| Đề xuất "bypass" trợ giảng bằng cách đọc kho tri thức của trang | Người dùng hỏi; agent tự kiểm rồi từ chối |
| Soak trượt 1.85× | Chạy 3 lần, đo `heapUsed` từng Đêm, thử 6 bộ cờ Node |
| Bench `p1_low` 20.7 | Ghi `dt` từng khung, thấy giật dồn theo thời điểm và load average 16, nên tìm ra GPU bị tranh |
| Hook theme có thể làm hỏng `build_cmd` | Rà trước khi áp: hook import một file chưa commit |

Chi tiết: [ai-log.md](ai-log.md).

## Harness giúp nhiều nhất

1. **`CLAUDE.md` + test trên JSONL headless.** Mọi thay đổi luật đều phải qua test giống máy chấm.
2. **Quy tắc clone sạch trước khi gắn tag** và `proof.sh` từ chối chạy khi còn file chưa commit. Hai thứ này sinh ra từ lỗi `headless.ts` và chặn được loại lỗi nguy hiểm nhất: chạy được trên máy mình nhưng không chạy trên máy chấm.
3. **Stop hook chặn kết thúc lượt khi test đỏ**, và **CI Node 20/24** chạy đúng `build_cmd`. CI cho biết soak cũng đạt trên Linux, không riêng macOS.

## Token

Phiên làm bài dùng khoảng 553 nghìn token đầu ra, 1.78 triệu token ghi cache và 53 triệu token đọc cache. Phiên theme song song dùng thêm khoảng 326 nghìn token đầu ra. Bảng theo từng phase và cách tiết kiệm: [ai-log.md](ai-log.md#token-và-chi-phí).

## Nếu làm lại

- Giới hạn làm rõ yêu cầu ≤ 10 phút cho mỗi phase, ghi giả định rồi làm headless ngay. Câu nào chưa rõ thì hỏi trợ giảng song song.
- Có quy tắc "clone sạch + chạy đủ lệnh contract trước khi gắn tag" từ Phase 1, không đợi tới lúc gặp lỗi.
- Dựng script chạy giao diện thật (CDP) ngay ở Phase 2 để mỗi tính năng UI có một bước kiểm chạy được, giống test headless.
- Đo hiệu năng trên máy đã tắt các tab WebGL khác, và ghi điều kiện đo cùng với số đo.
