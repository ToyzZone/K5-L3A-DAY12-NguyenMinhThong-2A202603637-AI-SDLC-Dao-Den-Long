# Đảo Đèn Lồng (Day 12 AI SDLC, cá nhân)

Nguyễn Minh Thông, 2A202603637, K5 L3A. Video demo: *(sẽ có ở Release v1.0.0)*

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, nhặt Đom đóm, Nạp vào 5 Đèn Lồng Lớn để Thắp, và Tỏa sáng để xua Bóng Mực. Thắp hết đèn thì thắng; hết Flame hoặc tới Bình minh thì thua.

## Cài đặt và chạy (macOS / Linux, Node ≥ 20)

```bash
npm ci
npm run build      # build headless (dist/)
npm run play       # mở game trong trình duyệt
```

Headless theo Test Contract v1.0 (`game.contract.json`):

```bash
node dist/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Test: `npm test` (21 scenario headless + kiểm tra contract). Bằng chứng: `scripts/proof.sh <phase>` → `docs/proof/phase-N/`.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | Đi theo hướng camera |
| Kéo chuột hoặc ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đèn (đứng gần đèn chưa Thắp) |
| F | Tỏa sáng |
| R | Chơi lại sau khi thắng hoặc thua |

## Luật và cách tính điểm

- Đom đóm được nhặt tự động khi tới gần (≤ 1.5 m), mang tối đa 10. Túi đầy thì HUD nhắc mang tới đèn.
- Nạp: mỗi đèn cần 5 Đom đóm, nạp được nhiều lần. Đèn đã Thắp tạo **Vùng an toàn** bán kính 5 m mà Bóng Mực không vào được (đèn chưa Thắp thì không).
- Tỏa sáng tốn 2 Đom đóm, hồi chiêu 1 s: Bóng Mực trong 6 m bị Choáng 2.5 s và bị đẩy lùi 4 m.
- Bóng Mực chạm (≤ 1 m): mất 1 Flame, rơi mất `floor(carried × 0.5)` Đom đóm, Bất tử 1.5 s. Có 3 Flame.
- Đêm dài 300 s. Cùng một bước vừa thắng vừa thua thì tính thắng.

| Sự kiện | Điểm |
|---|---|
| Nhặt một Đom đóm | +10 |
| Thắp một đèn | +100 |
| Làm Choáng một Bóng Mực (chưa Choáng) | +25 |
| Khi thắng: mỗi giây còn lại (`floor(time_left_s)`) | +2 |
| Khi thắng: mỗi Flame còn lại | +50 |

## Tuning và giả định ngoài contract

Mọi số trong `tuning` là số game đang dùng (test `contract.test.mjs` đỏ nếu lệch). `fall_enabled: false`: đảo có bán kính 40 m, Mây bị chặn ở mép nên không có rơi khỏi đảo và không có sự kiện `player_hit` với `by: "fall"`. Không có `dash` (contract ghi "nếu có").

Số không có trong contract: đảo bán kính 40 m; 5 đèn trên vòng tròn 25 m, L1 tại (0, 0, 25), cách nhau 72°; luôn 20 Đom đóm (nhặt một sinh một, cách Mây ≥ 8 m); Bóng Mực: 2 con đầu Ván ở bán kính 38 m, thêm 1 con mỗi 45 s, tối đa 6; Bóng Mực lơ lửng ở Y = 1; nhảy 6 m/s, trọng lực 20 m/s². Toàn bộ giả định và lý do: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Chưa có (làm lõi và bằng chứng trước).

## Tài liệu

- Giả định, đánh giá từng phase: [docs/notes/](docs/notes/)
- Bằng chứng: [docs/proof/](docs/proof/)
- Thuật ngữ: [GLOSSARY.md](GLOSSARY.md) · Quyết định kiến trúc: [docs/adr/](docs/adr/)
- Harness AI: [CLAUDE.md](CLAUDE.md), skill [`.claude/skills/proof`](.claude/skills/proof/SKILL.md), Stop hook [`.claude/settings.json`](.claude/settings.json) chặn kết thúc khi test đỏ, CI [`.github/workflows/test.yml`](.github/workflows/test.yml)
- Đề bài gốc: [docs/lab/](docs/lab/)
