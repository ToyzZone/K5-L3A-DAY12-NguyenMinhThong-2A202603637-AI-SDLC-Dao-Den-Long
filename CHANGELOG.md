# Changelog

## phase-4 / v1.0.0: contract v1.3 (Ticket-04 "Bình minh v1.0.0")

Không có luật [THAY THẾ]. Đầu ra headless của Đêm 1–3 giữ nguyên từng byte (so 18 lần chạy trước và sau).
- **Contract v1.3:**
  - thêm `bench_cmd` (`node scripts/bench.mjs`) và `soak_cmd` (`node --jitless --max-semi-space-size=1 dist/soak.js`);
  - `run_cmd` đổi thành `node scripts/play.mjs`, vì `npm run play --export-leaderboard` sẽ bị npm nuốt mất cờ.
- **Build:** `npm run build` = `tsc && vite build`, nên `build_cmd` tạo đủ `dist/` cho headless, soak, bench và chơi.
- **Benchmark:** cảnh chuẩn `?bench`. Sim có cờ `World.bench` tắt sinh thêm, sát thương, nhặt, hao dầu, chuyển `wander` → `chase` và kết thúc Đêm; headless không bao giờ bật cờ này.
- **Soak test:** 10 Đêm trong một tiến trình, ghi `soak.json`.
- **Bảng xếp hạng cục bộ:** lưu `leaderboard.json` trên đĩa, có màn hình xem, nhập tên khi thua hoặc khi tới Bình Minh, xuất bằng `--export-leaderboard`.
- **Hỗ trợ tiếp cận:** đổi phím (báo trùng, khôi phục mặc định), phụ đề và chỉ báo hình, giảm chuyển động, chữ ≥ 18 px và chữ lớn ×1.25.
- **Phát hành:** README đủ mục, CREDITS, LICENSE (MIT), bản Release chỉ cần Node để chạy.

## phase-3: contract v1.2 (Ticket-03 "Đèn cạn dầu")

### Breaking changes
- **Thắng:** bỏ thắng sớm khi thắp hết đèn và lý do `all_lit`. Chỉ thắng ở bình minh khi còn sống và ≥ `ceil(0.6 × số đèn)` đèn đang sáng (`dawn_survived`).
- **Điểm:** thay toàn bộ. +5 mỗi Đom đóm nạp (trước +10), +100 thắp lần đầu, +40 thắp lại, +5 mỗi Bóng Mực trúng Tỏa sáng (+15 nếu đang `drain`). Khi thắng: +50 + `floor(fuel)` mỗi đèn sáng, +50 mỗi Flame. Bỏ thưởng thời gian (`per_second_left` = 0).
- **Đèn:** có dầu (0–100), hao 1/s, hết dầu thì tắt (`lantern_out`, `deposited` = 0). Đèn đã sáng vẫn nhận Đom đóm để châm dầu (`refuel`).
- **Vùng an toàn:** đèn sáng nhưng dầu < 30 mất vùng an toàn.
- **Bóng Mực:** thêm trạng thái `drain`. Con ở `wander` đi tới đèn yếu hoặc đèn tắt gần nhất, không đứng yên như trước. Hết Choáng thì về `wander` (trước: `chase` nếu ≤ 18 m).
- **Thời lượng Đêm:** 240 / 270 / 300 s (trước 300 / 330 / 360).
- **Sức chứa:** `10 + 2 × successful_lights`, tối đa 20.
- **Contract v1.2:**
  - `tuning` thêm 8 khóa dầu, thắng và sức chứa;
  - snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`;
  - sự kiện mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.

## phase-2: contract v1.1 (Ticket-02 "Ba hòn đảo")
- Dùng số chuẩn thay số tự chọn; có Lướt, Tạm dừng, rơi khỏi đảo, Đom đóm rơi có TTL, 5 trạng thái Bóng Mực, Bùa Gió, bản đồ Đêm 2, Gió Lạc.
- `per_mote` tính khi nạp (trước: khi nhặt); `no_flames` thắng ưu tiên (trước: thắng được ưu tiên).

## phase-1: contract v1.0
- Làm rõ yêu cầu (21 giả định). Code headless làm bù trong giờ Phase 2.
