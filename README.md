# Đảo Đèn Lồng (Day 12 AI SDLC, cá nhân)

Nguyễn Minh Thông, 2A202603637, K5 L3A. Video demo: *(sẽ có ở Release v1.0.0)*

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, nhặt Đom đóm, Nạp vào 5 Đèn Lồng Lớn để Thắp, và Tỏa sáng để xua Bóng Mực. Thắp hết đèn thì thắng; hết Flame hoặc tới Bình minh thì thua.

## Cài đặt và chạy (macOS / Linux, Node ≥ 20)

```bash
npm ci
npm run build      # build headless (dist/)
npm run play       # mở game trong trình duyệt
```

Headless theo Test Contract v1.2 (`game.contract.json`):

```bash
node dist/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Test: `npm test` (scenario headless cho từng tính năng + kiểm tra contract). Bằng chứng: `scripts/proof.sh <phase>` → `docs/proof/phase-N/`.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | Đi theo hướng camera |
| Kéo chuột hoặc ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đèn (đứng gần đèn chưa Thắp) |
| F | Tỏa sáng |
| R | Chơi lại sau khi thắng hoặc thua |

## Luật và cách tính điểm (contract v1.2, Ticket-03)

- **Mục tiêu:** giữ đảo sáng tới bình minh. Thắng khi còn sống lúc hết giờ và có ≥ 60% số đèn đang sáng (Đêm 1: 3/5, Đêm 2: 4/6). Hết Flame thì thua ngay. Đêm 1 dài 240 s, Đêm 2 dài 270 s.
- **Di chuyển:** chạy 6 m/s, nhảy 7 m/s, Lướt 14 m/s trong 0.2 s (hồi 1.5 s). Rơi khỏi đảo: −1 Flame, mất hết Đom đóm.
- **Đom đóm:** nhặt tự động khi ≤ 1 m. Sức chứa `10 + 2 × số lần thắp thành công`, tối đa 20.
- **Đèn:** thắp lần đầu cần 10 Đom đóm, thắp lại cần 5. Khi sáng có 100 dầu, hao 1/s, hết dầu thì tắt. Bấm E ở đèn đang sáng để châm dầu (+10 dầu mỗi Đom đóm). Đèn sáng có dầu ≥ 30 tạo **Vùng an toàn** 6 m.
- **Bóng Mực:** đuổi khi ≤ 12 m; khi lang thang thì tìm đèn yếu (dầu < 30) để **hút dầu** 5/s. Tỏa sáng (E→F, tốn 3) làm Choáng 2 s và đẩy lùi 4 m.

| Sự kiện | Điểm |
|---|---|
| Mỗi Đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Bóng Mực trúng Tỏa sáng (đang hút dầu) | +5 (+15) |
| Khi thắng: mỗi đèn đang sáng | +50 + `floor(dầu)` |
| Khi thắng: mỗi Flame còn lại | +50 |

## Tuning và giả định

`tuning` trong `game.contract.json` là đúng số chuẩn của Ticket-02/03 (test `contract.test.mjs` đỏ nếu lệch). `shade_speed` = 4.0 là số Đêm 1/2; Đêm 3 dùng 4.5 m/s theo ticket nhưng Đêm 3 **chưa làm**. Giả định cho chỗ ticket chưa nói: [phase-2](docs/notes/phase-2.md), [phase-3](docs/notes/phase-3.md). Breaking changes: [CHANGELOG.md](CHANGELOG.md). Giả định Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Chưa có (làm lõi và bằng chứng trước).

## Tài liệu

- Giả định, đánh giá từng phase: [docs/notes/](docs/notes/)
- Bằng chứng: [docs/proof/](docs/proof/)
- Thuật ngữ: [GLOSSARY.md](GLOSSARY.md) · Quyết định kiến trúc: [docs/adr/](docs/adr/)
- Harness AI: [CLAUDE.md](CLAUDE.md), skill [`.claude/skills/proof`](.claude/skills/proof/SKILL.md), Stop hook [`.claude/settings.json`](.claude/settings.json) chặn kết thúc khi test đỏ, CI [`.github/workflows/test.yml`](.github/workflows/test.yml)
- Đề bài gốc: [docs/lab/](docs/lab/)
