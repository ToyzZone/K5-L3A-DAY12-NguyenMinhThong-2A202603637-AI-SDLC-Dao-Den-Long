# Phase 3: Ticket-03 "Đèn cạn dầu" (contract v1.2)

Nguồn: [docs/lab/phase-3-ticket.md](../lab/phase-3-ticket.md). Quyết định thiết kế: [ADR 0002](../adr/0002-den-co-dau-va-luat-thang-binh-minh.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).

## Giả định cho chỗ ticket chưa nói

| Chỗ mơ hồ | Giả định |
|---|---|
| Khóa `score` cũ trong `tuning` | `per_mote` 5, `per_lantern` 100 (thắp lần đầu), `per_stun` 5, `per_second_left` 0 (đã bỏ), `per_flame_left` 50. Không có khóa cho +40 thắp lại, +15 Tỏa sáng con đang `drain`, +50 + floor(fuel): để trong `RULES` |
| `carry_capacity` | Giữ 10 = sức chứa gốc; sức chứa thật `capacity` trong snapshot |
| Nhịp `fuel_drain` | Mỗi 60 tick tính từ tick con đó bắt đầu `drain` |
| Bóng Mực `wander` "đi về đèn tắt gần nhất như trước" | Đi tới đèn mục tiêu với tốc độ Bóng Mực, dừng cách 2 m. Không có đèn nào thì đứng yên |
| Hết choáng | Về `wander` và không đổi trạng thái thêm trong tick đó |
| Đêm 3: xuất phát | (0, 0, −28): tâm đảo là tháp chuông |
| Đêm 3: vách và dốc | Mỗi (x, z) là cột đặc; bước lên ≤ 0.35 m đi được (dốc), cao hơn là vách chặn đi ngang |
| Đêm 3: gió | Bắt đầu ở sim tick 1800k, kéo dài 300 tick, hướng `rng × 360°` đo từ +X; `wind_enabled` mặc định bật ở Đêm 3 |
| Bóng Mực trên địa hình | Lướt theo đỉnh cột + 1 m (bỏ qua tháp) |
| Scenario `lit: true` | `ever_lit` mặc định = `lit`; `fuel` mặc định 100 |
| Đèn đầy dầu | Do bước 2 trừ dầu trước bước tương tác, đèn 100 ở tick trước sẽ còn 99.98 → vẫn châm được 1 |

## Test cũ bị luật mới làm sai (sửa hoặc xóa, có lý do)

| Test | Xử lý | Lý do |
|---|---|---|
| "thắp đèn cuối thì thắng, + floor(giây còn) × 2 + 50 × Flame" | **Xóa** | [THAY THẾ] không còn thắng sớm, bỏ thưởng thời gian. Thay bằng test "luật thắng mới" |
| "nạp … +10 mỗi đom đóm" | **Sửa** +5/con, `lantern_lit` thêm `relight`, kiểm tra thêm `fuel` và `capacity` | [THAY THẾ] công thức điểm |
| "Tỏa sáng … choáng 120 tick" | **Sửa** hết choáng → `wander` | Ticket-03 mục 2 |
| "định dạng v1.1", "Đêm 2" | **Sửa** thời lượng 240 / 270 s, thêm các trường v1.2 | Ticket-03 mục 3, 7 |

## Đánh giá tại tag `phase-3`

| Yêu cầu Ticket-03 | Kết quả | Bằng chứng |
|---|---|---|
| Dầu đèn: hao, tắt, thắp lại 5, châm dầu | Đạt | test "dầu", "thắp lại", "châm dầu" |
| Vùng an toàn mất khi dầu < 30 | Đạt | test "Vùng an toàn: fuel < 30" |
| Bóng Mực `drain`: chọn đèn yếu, hút 5/s, `fuel_drain` mỗi 60 tick, thoát `drain` | Đạt | 3 test `drain` |
| Luật thắng mới, lý do `dawn_survived` | Đạt | test "luật thắng mới" |
| Sức chứa tăng dần | Đạt | test "sức chứa" |
| Điểm mới | Đạt | các test trên kiểm tra điểm |
| Contract v1.2 (tuning, snapshot, scenario, sự kiện) | Đạt | `contract.test.mjs` + test định dạng |
| Giao diện: thanh dầu, nhấp nháy 1 Hz, HUD `mang/sức chứa`, nhắc châm dầu | Đã làm, build đạt; **chưa xem chạy thật** (tab Safari của agent bị ẩn nên không render) | `src/web/main.ts` |
| Chế độ mù màu | Đã làm (cài đặt được lưu); **chưa xem chạy thật** | `src/web/main.ts`, `index.html` |
| Đêm 3 (nợ từ Phase 2): tầng, vách, dốc, tháp, bục nhảy, gió, 7 đèn, 4.5 m/s | Đạt headless sau tag `phase-3` (commit sau 16:20); giao diện Đêm 3 chưa xem | 4 test "Đêm 3" |

Toàn bộ test tại tag: `npm test` → 37/37 đạt (sau đó thêm Đêm 3: 41/41). Bằng chứng chạy: [docs/proof/phase-3/](../proof/phase-3/).
