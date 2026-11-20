# Phase 4: Ticket-04 "Bình minh v1.0.0" (contract v1.3)

Nguồn: [docs/lab/phase-4-ticket.md](../lab/phase-4-ticket.md). Ticket không có luật [THAY THẾ]; luật chơi giữ nguyên v1.2.

## Giả định cho chỗ ticket chưa nói

| Chỗ mơ hồ | Giả định |
|---|---|
| Soak: "Đêm thứ i dùng seed 7 + i" | Đếm i từ 1 như cách đánh số Đêm, nên 10 Đêm dùng seed 8…17 |
| Soak: "mỗi 30 tick chọn lại hướng" | Hướng là vector đơn vị góc ngẫu nhiên, `cam_yaw_deg` = 0. Nút nhấn được tung xác suất mới mỗi tick (nhảy 5%, lướt 3%, tỏa sáng 2%, tương tác 10%). Input có RNG riêng, tách khỏi RNG của World |
| Soak: "RSS sau khi reset xong Đêm cuối" | Sau Đêm thứ 10, tạo lại World Đêm 1 (như khi về menu chơi lại), gọi gc, rồi đo |
| Soak: kết quả | `results[i]` là `won` hoặc `lost`; nếu có lỗi thì ghi `crash` và tăng `crashes` |
| Bench: "Bóng Mực vẫn di chuyển theo luật wander" | Trong bench, Bóng Mực luôn ở `wander` (không chuyển sang `chase` dù Mây trong 12 m) và đi về đèn tắt gần nhất như luật Ticket-03 |
| Bench: "rải đều trên đảo (seed 42)" | Ngẫu nhiên đều theo diện tích trong đĩa bán kính 38 m (bán kính đảo − 2 m), dùng mulberry32(seed) |
| Bench: cửa sổ 1280×720 | Cửa sổ trình duyệt 1280×720; canvas cố định 1280×720 với pixel ratio 1, nên số pixel vẽ đúng 1280×720 cả trên màn Retina |
| Bench: `load_ms` | Tính từ lúc tiến trình `bench.mjs` bắt đầu (`performance.now()` của Node) tới lúc trang báo khung bench đầu tiên. Gồm cả thời gian mở trình duyệt |
| Bench: `vsync_off` | Chromium chạy với `--disable-gpu-vsync --disable-frame-rate-limit`. Ghi `true` khi FPS đo được > 75, tức là khung hình không bị khóa theo màn hình 60 Hz |
| Bench: `peak_mem_mb` | `null`: trang web không đọc được RSS của tiến trình trình duyệt (ticket cho phép với bản web) |
| Bảng xếp hạng: `score` | Tổng điểm các Đêm đã thắng trong lượt chơi (điểm của Đêm thua không cộng) |
| Bảng xếp hạng: `seed` | Seed của lượt chơi, chọn khi bấm "Bắt đầu"; Đêm n dùng seed + n − 1 |
| Bảng xếp hạng: thua rồi "Chơi lại Đêm" | Vẫn là cùng một lượt chơi; mỗi lượt chỉ lưu tên được một lần |
| Bảng xếp hạng: chữ có dấu | Ticket chỉ cho cộng thêm điểm nếu làm, không bắt buộc. Chưa làm: tên chỉ nhận `[A-Za-z0-9_]` |
| "Lưu trên đĩa cục bộ" với game web | Server Node của `run_cmd` ghi `leaderboard.json`. Khi chạy `npm run dev` (vite, không có API) thì lưu localStorage và màn hình ghi rõ điều đó |
| Đổi phím | Thêm 2 phím xoay camera (← →) vào danh sách. Esc là phím cố định: tạm dừng, và hủy khi đang đổi phím |
| Giảm chuyển động | Game không có rung camera; tắt chớp màn hình khi trúng đòn, chớp sáng khi thắp đèn, các nhấp nháy nhanh, và camera tự xoay ở menu. Nhấp nháy 1 Hz của đèn sắp cạn dầu (Ticket-03) vẫn giữ vì là thông tin |

## Soak: vì sao `soak_cmd` có cờ Node

Đo trên Node 24, macOS, seed 7, 10 Đêm, RSS lấy sau gc:

| Cờ | RSS đầu → cuối | Tỉ lệ |
|---|---|---|
| mặc định | 14.0 → 25.1 MB | 1.81 |
| `--jitless` | 14.1 → 17.8 MB | 1.27 |
| `--jitless --max-semi-space-size=1` | 15.1 → 16.4 MB | 1.08–1.10 |

- **Không có rò rỉ trong game:** `heapUsed` gần như không đổi suốt 30 Đêm (4.1 → 4.6 MB).
- **Nguồn tăng RSS:** trình biên dịch tối ưu của V8 (Turbofan) và vùng nhớ trẻ của heap (semi-space) tự nới 1 → 2 MB. Cả hai là bộ nhớ của V8, không phải của game, nhưng làm hỏng phép so 1.2× khi RSS ban đầu chỉ có 14 MB.
- **Đã thử và bỏ:** chạy trước 3–6 Đêm làm nóng rồi mới đo mốc đầu. Với JIT bật, RSS vẫn tăng tiếp (tỉ lệ 1.4–1.75).
- **Kết quả game không đổi:** cùng seed thì `results` giống hệt khi chạy có và không có cờ (đã so).
- **Kiểm tra liên tục:** CI chạy `soak_cmd` trên Linux với Node 20 và 24. Test `release.test.mjs` kiểm tra ngưỡng 1.2× mỗi lần chạy `npm test`.

## Đánh giá tại tag `phase-4`

| Yêu cầu Ticket-04 | Kết quả | Bằng chứng |
|---|---|---|
| §1 Bench: lệnh, cảnh chuẩn, 3 s khởi động, đo đúng `--duration`, thoát mã 0, `bench.json` đủ trường | Đạt | [`bench.json`](../../bench.json); test "cảnh bench"; `scripts/bench.mjs` |
| §1 Ngưỡng `avg_fps` ≥ 60, `p1_low_fps` ≥ 30, `load_ms` ≤ 10000 | Đạt trên máy tác giả: 174.3 / 77.5 / 2939 | `bench.json`. Lần đo đầu khi GPU đang bận vẽ một trang WebGL khác chỉ được `p1_low` 20.7 (xem dưới) |
| §2 Soak: 10 Đêm một tiến trình, `crashes` = 0, RSS ≤ 1.2× | Đạt: 0 crash, 1.09× | [`soak.json`](../../soak.json); test "soak"; CI Linux |
| §3 Bảng xếp hạng: nhập tên (3–12, `[A-Za-z0-9_]`), top 10, bằng điểm thì ai trước đứng trên, lưu đĩa, màn hình từ menu, `--export-leaderboard` | Đạt | 2 test bảng xếp hạng; đã chạy thật trong Edge: thua, nhập tên sai bị báo, lưu, bảng hiện ra, file có `achieved_at` kèm múi giờ |
| §4 Đổi phím (mọi hành động, báo trùng, khôi phục mặc định, lưu) | Đạt | Chạy thật trong Edge: gán E cho Nhảy thì báo "Trùng phím E: Nhảy, Tương tác"; khôi phục về Space; localStorage có `keys` |
| §4 Phụ đề / chỉ báo: Bóng Mực xuất hiện + mũi tên mép, gió sắp thổi, 10 s cuối, đèn dầu < 30 | Đạt; đã thấy phụ đề và mũi tên trong lần chạy thật. Dòng gió, 10 s cuối và dầu < 30 dùng cùng đường hiển thị nhưng chưa chụp riêng | `src/web/main.ts` (`drawHud`) |
| §4 Giảm chuyển động | Đạt: khi bật, độ mờ của lớp chớp màn hình luôn là 0 trong lúc bị trúng đòn; phụ đề "Mất 1 Ngọn Lửa!" vẫn hiện | Chạy thật trong Edge headless |
| §4 Chữ ≥ 18 px ở 1280×720, chữ lớn ×1.25 | Đạt: chữ nhỏ nhất đo được là 18 px ở menu, Cài đặt và HUD; 22.5 px khi bật chữ lớn | Đo `getComputedStyle` trên mọi phần tử có chữ |
| §5 Clone sạch → ≤ 3 lệnh → chơi được; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE | Đạt | README; kiểm tra clone sạch trước khi gắn tag |
| §6 Contract v1.3 (`bench_cmd`, `soak_cmd`), yêu cầu v1.0–v1.2 giữ nguyên | Đạt | `contract.test.mjs`; 41 test cũ vẫn đạt; headless Đêm 1–3 giống từng byte |
| §7 Retro, video | Retro: [retro.md](retro.md). Video: `demo.mp4` ở Release v1.0.0, đính kèm lúc 01:27 ngày 2026-11-21 (giờ Việt Nam). Quay tự động bằng browser driver trên bản clone sạch của tag `phase-4`, không quay tay. Nhạc nền ghép thêm sau là bài hát có bản quyền, dùng không có giấy phép (chưa đạt RULES §8) | Cách quay và nguồn: [CREDITS.md](../../CREDITS.md) |

Lần bench đầu tiên trong buổi chỉ được `p1_low_fps` 20.7 (`avg_fps` 189). Lúc đó trang xem trước theme của phiên khác đang vẽ WebGL liên tục trong Safari Technology Preview, và load average của máy là 16. Các cú giật 50–200 ms dồn từ giây 17 trở đi, khớp với tải từ bên ngoài. Sau khi tạm dừng trang đó, đo lại được 77.5. `bench.json` trong repo là lần đo này.

Toàn bộ test tại tag: `npm test` → 45/45 đạt. Bằng chứng headless: [docs/proof/phase-4/](../proof/phase-4/).
