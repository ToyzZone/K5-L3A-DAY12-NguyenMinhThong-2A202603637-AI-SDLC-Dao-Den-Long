# Phase 1: giả định, quyết định, đánh giá

Nguồn: PRD-0 và Test Contract v1.0 trên lab board. Thuật ngữ: [GLOSSARY.md](../../GLOSSARY.md). Stack: [ADR 0001](../adr/0001-typescript-threejs-thay-vi-rust.md).

## Giả định (chốt qua buổi grilling với agent, 21 câu)

| # | Chỗ mơ hồ | Giả định đã chốt |
|---|---|---|
| Q1 | Stack | TypeScript; lõi mô phỏng thuần dùng chung cho headless và giao diện Three.js + Vite. `build_cmd` chỉ build headless. |
| Q2 | "Tốn ánh sáng", "mất máu" | Ánh sáng = số Đom đóm đang mang (`carried`); máu = Flame (một mạng). |
| Q3 | Nhặt | Tự động khi khoảng cách XZ ≤ `pickup_radius`; đầy `carry_capacity` thì không nhặt, giao diện nhắc "túi đầy". |
| Q4 | Nạp đèn | Cạnh lên `interact` trong `interact_radius` của đèn chưa Thắp gần nhất (hòa thì id nhỏ); `amount = min(carried, lantern_cost − deposited)`; Thắp khi đủ. |
| Q5 | Vùng an toàn | **Chỉ quanh đèn đã Thắp** (người dùng chọn (b), khác đề xuất (a) "mọi đèn" của agent). |
| Q6 | Bị chạm | Mất 1 Flame, rơi `floor(carried × hit_drop_ratio)` Đom đóm (mất luôn), Bất tử `invuln_s`; Bóng Mực đang Choáng vô hại. |
| Q7 | Tỏa sáng | Cần `carried ≥ pulse_cost` và hết hồi chiêu; Choáng `pulse_stun_s`, đẩy `pulse_push_m` ra xa Mây; không đủ điều kiện thì không có sự kiện; trúng 0 con vẫn ghi `pulse` với `stunned_ids: []`. |
| Q8 | Kết thúc | `all_lit` thắng; `no_flames` thua; Bình minh (`dawn`) thua; cùng bước thì thắng được ưu tiên. |
| Q9 | Điểm | `per_mote` khi nhặt; `per_lantern` khi Thắp; `per_stun` mỗi con bị Choáng; `per_second_left × floor(time_left_s)` và `per_flame_left × flames` chỉ khi thắng. |
| Q10 | Sinh thực thể | Đom đóm và Bóng Mực sinh theo seed; chỉ con sinh trong lúc chơi mới ghi `shade_spawned`; id tuần tự S1, M1… |
| Q11 | Nhảy, lướt, rơi | Nhảy chỉ đổi Y; không có `dash`; `fall_enabled: false`, Mây bị chặn ở mép đảo. |
| Q13 | Tuning | speed 6; capacity 10; lantern_cost 5; pickup 1.5; interact 3; pulse cost 2, radius 6, stun 2.5 s, push 4 m, cooldown 1 s; safe_radius 5; shade speed 3.5, hit 1; đêm 300 s; 3 Flame; invuln 1.5 s; drop 0.5. Điểm: mote 10, lantern 100, stun 25, giây còn lại 2, Flame còn lại 50. Đảo bán kính 40 m; đèn trên vòng 25 m, L1 tại (0, 0, 25), cách nhau 72°. |
| Q14 | Số lượng | Luôn 20 Đom đóm (nhặt một sinh một, cách Mây ≥ 8 m); Bóng Mực: 2 con đầu Ván ở bán kính 38 m, thêm 1 con mỗi 45 s, tối đa 6, cách Mây ≥ 15 m, ngoài Vùng an toàn. |
| Q15 | Vùng an toàn chi tiết | Đèn vừa Thắp đẩy Bóng Mực ra mép; bị Tỏa sáng đẩy vào thì dừng ở mép; vùng chỉ chặn Bóng Mực, không bảo vệ trực tiếp Mây. |
| Q16 | Thứ tự trong một bước | Mây di chuyển và nhảy → nhặt → Nạp và Thắp → Tỏa sáng → Bóng Mực di chuyển → va chạm (tối đa 1 Flame mỗi bước) → kết thúc Ván (thưởng cộng trước `game_over`). |
| Q17 | Nhắc túi đầy | Chỉ trên giao diện; không thêm sự kiện headless. |
| Q18 | Điều khiển | WASD theo camera, kéo chuột hoặc ←/→ xoay camera, Space nhảy, E nạp, F tỏa sáng, R chơi lại. |
| Q19 | Sáng tạo | Để sau khi lõi và bằng chứng xong. |
| Q20 | Tài liệu lab | Chuyển vào `docs/lab/`; README gốc là README của game. |
| Q21 | Tỏa sáng trúng con đang Choáng | Vẫn đẩy và đặt lại thời gian Choáng, có trong `stunned_ids`; `per_stun` chỉ cộng nếu trước đó chưa Choáng. |

## Đánh giá tại tag `phase-1` (trung thực)

| Yêu cầu PRD-0 | Kết quả |
|---|---|
| Làm rõ yêu cầu, giả định, glossary, ADR | Đạt (file này, GLOSSARY.md, docs/adr/) |
| Game chơi được Đêm 1 | **Chưa đạt**: chưa có code |
| `game.contract.json` và headless theo Test Contract v1.0 | **Chưa đạt**: chưa có code |
| Bằng chứng game chạy đúng | **Chưa đạt** |
| Harness AI (CLAUDE.md, skill, hook) | **Chưa đạt** |

**Vì sao:** toàn bộ 60 phút Phase 1 dồn vào việc làm rõ yêu cầu (buổi grilling 21 câu, có tra mã nguồn lab board và kiểm tra công cụ trên máy). Không đặt giới hạn thời gian cho bước làm rõ nên không còn thời gian build.

**Điều chỉnh:** từ Phase 2, làm rõ yêu cầu tối đa 10 phút, ưu tiên headless trước. Phần lõi Phase 1 được làm bù trong giờ Phase 2; test ẩn của Phase 1 được chạy lại ở các tag sau.
