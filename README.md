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

## Luật và cách tính điểm (số chuẩn Ticket-02, contract v1.1)

- Chạy 6 m/s, nhảy 7 m/s (trọng lực 20), Lướt 14 m/s trong 0.2 s, hồi 1.5 s (phím Shift trong giao diện: *chưa có*, xem notes Phase 2).
- Đom đóm nhặt tự động khi ≤ 1.0 m (chênh cao ≤ 1.5 m), mang tối đa 10. 20 con đầu Đêm trên điểm chuẩn, cứ 240 tick thêm 1 vào điểm trống (trần 30).
- Nạp: mỗi đèn cần 10, nạp nhiều lần, bán kính 2 m. Đèn đã Thắp tạo **Vùng an toàn** 6 m.
- Tỏa sáng tốn 3, bán kính 5 m (3D, tâm ở chân + 0.8 m), hồi 3 s: Bóng Mực Choáng 120 tick, bị đẩy 4 m trong 15 tick.
- Bóng Mực: sinh 2 con ở giây 5 rồi mỗi 8 s (tối đa 6), đuổi khi ≤ 12 m, bỏ khi > 18 m. Chạm: −1 Flame, rơi `floor(carried / 2)` Đom đóm ra vành 1.5–2.5 m (tồn tại 8 s), Bất tử 1.5 s.
- Rơi khỏi đảo (Y < −10): −1 Flame, mất hết Đom đóm, hồi sinh ở xuất phát sau 1 s.
- Hết Flame luôn thua; còn sống và Thắp hết đèn thì thắng; hết giờ thì thua (Bình minh).

| Sự kiện | Điểm |
|---|---|
| Mỗi Đom đóm Nạp vào đèn | +10 |
| Thắp một đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa sáng (mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại (`floor`) | +2 |
| Khi thắng: mỗi Flame còn lại | +50 |

## Tuning và giả định

`tuning` trong `game.contract.json` là đúng số chuẩn của Ticket-02 (test `contract.test.mjs` đỏ nếu lệch). `shade_speed` = 4.0 là số Đêm 1/2; Đêm 3 dùng 4.5 m/s theo ticket nhưng Đêm 3 **chưa làm**. Giả định cho chỗ ticket chưa nói: [docs/notes/phase-2.md](docs/notes/phase-2.md). Giả định Phase 1: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Chưa có (làm lõi và bằng chứng trước).

## Tài liệu

- Giả định, đánh giá từng phase: [docs/notes/](docs/notes/)
- Bằng chứng: [docs/proof/](docs/proof/)
- Thuật ngữ: [GLOSSARY.md](GLOSSARY.md) · Quyết định kiến trúc: [docs/adr/](docs/adr/)
- Harness AI: [CLAUDE.md](CLAUDE.md), skill [`.claude/skills/proof`](.claude/skills/proof/SKILL.md), Stop hook [`.claude/settings.json`](.claude/settings.json) chặn kết thúc khi test đỏ, CI [`.github/workflows/test.yml`](.github/workflows/test.yml)
- Đề bài gốc: [docs/lab/](docs/lab/)
