# Phase 2: luật thay đổi, giả định, acceptance criteria, đánh giá

Nguồn: [Ticket-02](../lab/phase-2-ticket.md) (Contract v1.1). Thuật ngữ: [GLOSSARY.md](../../GLOSSARY.md). Giả định Phase 1: [phase-1.md](phase-1.md).

Thuật ngữ mới: **Lướt** (`dash`), **Gió Lạc** (`drifter`), **Bùa Gió** (`charm`), **Đom đóm rơi** (`mote` có `kind: "dropped"`), **Tạm dừng** (`pause`).

## 1. Thay đổi so với Phase 1 (luật cũ bị thay)

Ticket-02 thắng mọi giả định Phase 1. Cột cuối nói test cũ (của mình và test ẩn Phase 1 chạy với số chuẩn) phải đổi gì.

| Luật Phase 1 | Ticket-02 nói bây giờ | Ảnh hưởng tới test cũ |
|---|---|---|
| Q13 Tuning | `lantern_cost` 5→10; nhặt 1.5→1.0 m XZ và chênh cao ≤ 1.5 m; Nạp 3→2 m; Tỏa sáng: chi phí 2→3, bán kính 6→5 m (3D, tâm = chân Mây + 0.8 m), Choáng 2.5 s→120 tick, đẩy 4 m trong 15 tick, hồi chiêu 1→3 s; Bóng Mực 3.5→4.0 m/s; nhảy 7 m/s, trọng lực −20. Giữ nguyên: chạy 6, sức chứa 10, 3 Flame, Bất tử 90 tick, rơi ½, Đêm 300 s | `tuning` khai báo lại + 5 khóa mới (`dash_*`, `night2/3_duration_s`). Test đọc số từ `tuning` tự theo; test viết cứng số cũ phải sửa |
| Q9 `per_mote` | +10 mỗi Đom đóm **Nạp** vào đèn, không cộng khi nhặt | Test "nhặt thì +10" đổi thành +0; test Nạp kỳ vọng thêm `10 × amount` |
| Q13 `per_stun` 25 | +5 | Đổi số kỳ vọng |
| Q21 Tỏa sáng trúng con đang Choáng | `per_stun` cộng cho **mỗi lần trúng**, kể cả con đang Choáng | Test "pulse lại không cộng điểm" đổi thành có cộng +5 |
| Q8 cùng tick thì thắng được ưu tiên | Hết Flame → **luôn thua** `no_flames`; sau đó mới xét `all_lit`, rồi `dawn` | Ca "mất Flame cuối và Thắp đèn cuối cùng tick" đổi từ thắng sang thua |
| Q14 Đom đóm "nhặt một sinh một", luôn 20, cách Mây ≥ 8 m | 20 Đom đóm lúc đầu ở 20 điểm khác nhau trong 24 điểm chuẩn (8 điểm r = 12 m, 16 điểm r = 33 m); trần 30; tick 240, 480, … sinh 1 ở điểm trống nếu < 30, hết điểm trống thì bỏ lượt | Bỏ test "luôn 20"; số Đom đóm giờ phụ thuộc tick |
| Q14 Bóng Mực 2 con đầu Ván, +1 mỗi 45 s, r = 38 m | 12 điểm r = 37 m (15°, 45°, …), cách Mây ≥ 15 m; 2 con tại tick 300, rồi 1 con mỗi 480 tick; tối đa 6 | Tick 0–299 không có Bóng Mực (trừ scenario); test đếm số con theo thời gian phải sửa |
| Q11 `fall_enabled: false` | Rơi bật: Y < −10 → −1 Flame (bỏ qua Bất tử), mất hết Đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát | Thêm test mới; test không ra mép đảo không đổi |
| Q11 Mây bị chặn ở mép đảo | Bỏ chặn; ngoài 40 m là biển mây | Test "đi mãi vẫn đứng ở mép" đổi thành rơi |
| Q6 Đom đóm rơi khi bị chạm thì mất luôn | `floor(carried / 2)` rơi ra vành 1.5–2.5 m quanh Mây thành Đom đóm rơi, sống 480 tick, nhặt lại được từ tick sau | Test kiểm `motes` có `kind: "dropped"` thay vì chỉ kiểm `carried` giảm |
| Q5 (b) Vùng an toàn chỉ quanh đèn đã Thắp | **Giữ** chỉ đèn đã Thắp; bán kính 5→6 m; Bóng Mực trong vùng lúc đèn vừa Thắp bị đẩy ra mép trong tối đa 30 tick, vô hại lúc đó | Đổi bán kính trong test; thêm ca 30 tick vô hại |
| Q11 không có `dash` | Có Lướt: 14 m/s, 0.2 s, hồi chiêu 1.5 s | Thêm input `dash` |
| Q16 thứ tự một bước | 12 bước: `pause` → giảm bộ đếm → di chuyển + rơi → nhặt → Nạp → Vùng an toàn → Tỏa sáng → Bóng Mực/Gió Lạc di chuyển → chạm → sinh → thắng/thua → snapshot | Test kiểm đúng tick (Bất tử, hồi chiêu, lúc sinh) phải xem lại theo thứ tự mới |

## 2. Giả định cho chỗ ticket chưa nói

| # | Chỗ ticket chưa nói | Giả định đã chốt |
|---|---|---|
| A1 | `spawning` kéo dài bao lâu | Chỉ trong tick sinh; từ tick sau thành `wander` hoặc `chase` ("thực thể mới chỉ tương tác được từ tick sau"). |
| A2 | `wander` làm gì | Bóng Mực lơ lửng tại chỗ. |
| A3 | Khoảng cách phát hiện / bỏ đuổi đo thế nào | Trên mặt phẳng XZ. |
| A4 | Sau `stunned` / `recoil` | Về `chase` nếu cách Mây ≤ 18 m, ngược lại `wander`. |
| A5 | Độ cao tâm Bóng Mực | Y = 1 m trên mặt đất phẳng. |
| A6 | `recoil` lùi thế nào | Lùi 2 m ra xa Mây, chia đều trong 60 tick sau cú chạm. |
| A7 | Đẩy lùi của Tỏa sáng chia thế nào | 4/15 m mỗi tick, ở tick kích hoạt và 14 tick tiếp theo. |
| A8 | Bóng Mực trong scenario không có `state` | Bắt đầu là `wander` (luật thường: đuổi ngay nếu cách ≤ 12 m). |
| A9 | Kiểu `player.invuln` | Boolean. |
| A10 | `*_cd_s`, `charm_s`, `ttl_s` | Số giây còn lại; `ttl_s` là `null` với Đom đóm `random`. |
| A11 | Khi nào phát `night_start` | Sự kiện ở tick 0, ngay sau snapshot tick 0. |
| A12 | `pause` | Bật/tắt: nhấn lần đầu tạm dừng, lần sau tiếp tục. Tick tạm dừng tăng `tick`, không tăng `sim_tick`. Dòng `end` có thể có state `paused`. |
| A13 | Sự kiện rơi | `player_hit {by: "fall", flames, dropped: 0, lost: n}`; chờ 60 tick rồi hồi sinh ở điểm xuất phát của Đêm, Bất tử 90 tick. |
| A14 | Trần 30 tính gì | Mọi Đom đóm, cả `random` lẫn `dropped`. |
| A15 | "Điểm trống" | Điểm đang không có Đom đóm `random` nào. |
| A16 | Tốc độ Bóng Mực 4.5 m/s ở Đêm 3 | Hằng số theo Đêm; `tuning.shade_speed` khai báo 4.0 (giá trị Đêm 1). Phải giải thích trong README (việc còn nợ). |

## 3. Acceptance criteria cho Phần 3

Lướt và Rơi khỏi đảo không nằm trong Phần 3 nhưng là tính năng headless mới nên có mục riêng.

| Mục | Tiêu chí (làm A thì thấy B) | Cách kiểm chứng |
|---|---|---|
| Lướt | Đứng yên quay mặt +Z, nhấn `dash` → sự kiện `dash {}`, Mây đi ≈ 2.8 m theo +Z trong 12 tick | Scenario headless |
| | Đang chạy theo +X rồi lướt → hướng lướt là +X, không phải hướng quay mặt | Scenario headless |
| | Lướt khi đang trên không → Y giữ nguyên trong 12 tick lướt | Scenario headless |
| | Nhấn lại trong 1.5 s tính từ lúc bắt đầu lướt → không có `dash`; sau 90 tick nhấn → có `dash` | Scenario headless |
| | Bị Bóng Mực chạm khi đang lướt → vẫn có `player_hit` (không bất tử) | Scenario headless |
| Rơi khỏi đảo | Mây ở (39,0,0) đi +X → khi Y < −10 có đúng 1 `player_hit {by: "fall", dropped: 0, lost: n}`, `carried` = 0 | Scenario headless |
| | Trong 60 tick chờ: không nhặt, không bị chạm; sau đó Mây ở (0,0,0), `vel` = 0, `invuln` = true trong 90 tick | Scenario headless |
| | Rơi lúc đang Bất tử → vẫn mất 1 Flame | Scenario headless |
| | Rơi khi còn 1 Flame → `game_over` `no_flames` ngay, không hồi sinh | Scenario headless |
| Gió Lạc | Đêm 2, `random_drifters` bật → `D1` xuất hiện ở tick 1200, không quá 2 con cùng lúc | Scenario headless |
| | Mây mang 5 Đom đóm, Gió Lạc `idle` cách 10 m → `chase`; mang 4 hoặc cách 16 m → `idle` | Scenario headless |
| | Gió Lạc chạm Mây (XZ ≤ 1.2 m) khi Mây mang 7 → `drifter_steal {amount: 3, carried: 4}`, `flee`, sau 240 tick `removed`; con đó không cướp lần 2 | Scenario headless |
| | Tỏa sáng trúng con `chase` → `flee`, `stolen` = 0; trúng con `flee` đang mang 3 → `drifter_drop {amount: 3}` và 3 Đom đóm rơi tại chỗ | Scenario headless |
| | Mây đang Bất tử hoặc đứng trong Vùng an toàn vẫn bị cướp; `flames` không đổi | Scenario headless |
| Bùa Gió | Mây đứng cạnh `C1` → `charm_picked {charm_id: "C1", charm_ticks: 600}`, `charm_s` = 10 | Scenario headless |
| | Có bùa, chạy 60 tick → đi 7.2 m (không bùa: 6.0 m) | Scenario headless |
| | Có bùa: lướt xong nhấn lại ngay → lướt lần 2; nhấn trong lúc đang lướt → bị bỏ qua | Scenario headless |
| | Sau khi nhặt: `available` = false, `respawn_s` = 45; sau 2700 tick `available` = true | Scenario headless |
| | Đêm 2 có bùa ở (35,0,0); Đêm 3 có 2 bùa ở (±30,0,25), đỏ viền vàng | Ảnh chụp |
| Chuỗi 3 Đêm | Mở game → menu chính; chọn chơi → màn giới thiệu Đêm 1 (tên đảo, lời Ông Đăng) | Chơi thủ công |
| | Thắng Đêm 1 → màn kết quả → giới thiệu Đêm 2 – Đảo Cau | Chơi thủ công |
| | Thua Đêm 2 → được chơi lại Đêm 2 (không về Đêm 1) | Chơi thủ công |
| | Thắng Đêm 3 → màn Bình Minh với tổng điểm = tổng điểm các Đêm đã thắng | Chơi thủ công + ảnh chụp |
| Tạm dừng | Nhấn `pause` → `paused {}`, snapshot `state: "paused"`, `tick` tăng nhưng `sim_tick`, thời gian, hồi chiêu, TTL đứng yên | Scenario headless |
| | Nhấn `pause` lần nữa → `resumed {}`; kết quả Ván giống hệt chạy không tạm dừng (chỉ lệch `tick`) | Scenario headless |
| | Nhấn Esc hoặc P → menu có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; Bóng Mực đứng yên | Chơi thủ công + ảnh chụp |
| | Chọn Chơi lại Đêm → Đêm bắt đầu lại từ đầu, 3 Flame | Chơi thủ công |
| Cài đặt | Kéo âm lượng về 0 → không nghe gì | Chơi thủ công |
| | Tăng độ nhạy chuột → cùng quãng kéo chuột, camera xoay nhiều hơn | Chơi thủ công |
| | Đổi cả hai, tải lại trang → giá trị vẫn giữ | Chơi thủ công |
| Âm thanh | Vào Đêm → nhạc nền đêm phát lặp | Chơi thủ công |
| | Nhặt, Thắp, Tỏa sáng, bị chạm, nhảy, Lướt, thắng, thua, Bóng Mực xuất hiện → mỗi việc có tiếng riêng | Chơi thủ công (checklist 9 ô) |
| | Còn 10 s → tiếng đếm ngược mỗi giây | Chơi thủ công |
| | Chạy headless → không phát âm thanh, đầu ra không đổi | Scenario headless |
| HUD đầy đủ | Đầu Đêm 1 → Flame trên trái, `05:00` trên giữa, `0/5` và điểm trên phải, thanh 10 ô dưới giữa, biểu tượng Lướt + Tỏa sáng dưới phải | Ảnh chụp |
| | Còn ≤ 30 s → đồng hồ đỏ và nhấp nháy | Ảnh chụp |
| | Đứng cách đèn chưa Thắp ≤ 2 m → hiện "E — Nạp ánh sáng (x/10)" với x = số đã Nạp | Ảnh chụp |
| | Quay lưng với đèn chưa Thắp gần nhất → mũi tên ở mép màn hình chỉ về đèn; đèn vào màn hình → mũi tên ẩn | Chơi thủ công |
| | Lướt hoặc Tỏa sáng → biểu tượng tương ứng hiện hồi chiêu đang chạy | Chơi thủ công |
| Bảng màu chuẩn | Lấy mẫu pixel trời, cỏ, đèn tắt/sáng, Đom đóm, Bóng Mực, áo/khăn Mây → mỗi kênh RGB lệch ≤ 10% so với hex chuẩn | Ảnh chụp |
| | Tỏa sáng trúng Bóng Mực → thân đổi sang `#3A3450` khi Choáng | Ảnh chụp |
| | 0/5 đèn → cảnh tối (ánh sáng môi trường 0.15); 5/5 → sáng hơn rõ (0.70) | Ảnh chụp |
| | Chữ UI `#F5F1E6`, đồng hồ nguy hiểm `#FF5A5F`, điểm `#F2C14E` | Ảnh chụp |

## 4. Đánh giá tại tag `phase-2` (trung thực)

<!-- cập nhật lại trước khi gắn tag -->
| Yêu cầu Ticket-02 | Kết quả |
|---|---|
| Đêm 1 với số chuẩn + trường contract v1.1 | Đạt |
| Lướt | Đạt |
| Tạm dừng (headless) | Đạt |
| Rơi khỏi đảo | Đạt |
| Đom đóm rơi + TTL | Đạt |
| Trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`) | Đạt |
| Bùa Gió | Đạt (headless qua scenario) |
| Đêm 2 (bản đồ, bục nhảy) | Đạt một phần: đảo + cầu + bục nhảy + đèn + điểm sinh + bùa chạy headless (test "Đêm 2"); chưa có Gió Lạc, chưa có giao diện Đêm 2 |
| Đêm 3 (bản đồ, tầng, bục nhảy, gió) | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Gió Lạc | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Chuỗi 3 Đêm | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Menu tạm dừng (giao diện) | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Cài đặt | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Âm thanh | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| HUD đầy đủ | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Bảng màu chuẩn | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
| Đo FPS (≥ 30 ở 1280×720) | **Chưa đạt**: không đủ thời gian trong 60 phút, ưu tiên test ẩn |
