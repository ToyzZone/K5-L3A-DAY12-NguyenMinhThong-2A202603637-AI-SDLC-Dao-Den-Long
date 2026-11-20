# Đảo Đèn Lồng

Ngôn ngữ chung của game Đảo Đèn Lồng (Day 12 AI SDLC). Tên trong ngoặc là tên dùng trong code và Test Contract.

## Nhân vật và vật thể

**Mây** (`player`):
Người giữ đèn nhỏ tuổi, nhân vật người chơi điều khiển.
_Avoid_: nhân vật chính, hero

**Đom đóm** (`mote`):
Đốm sáng nằm trên mặt đất của đảo, Mây nhặt để mang đi.
_Avoid_: đốm sáng, firefly, orb

**Ánh sáng** (`carried`):
Số Đom đóm Mây đang mang. Đây là thứ duy nhất được gọi là ánh sáng: vừa dùng để Nạp đèn, vừa để Tỏa sáng.
_Avoid_: năng lượng, mana, thanh sáng

**Đèn Lồng Lớn** (`lantern`, id `L1`…`L5`):
Một trong năm cột đèn của đảo, cần được Nạp đủ Đom đóm để Thắp.
_Avoid_: đèn, cột đèn, lamp

**Bóng Mực** (`shade`):
Sinh vật mực đen trong sương, đuổi theo Mây; chạm vào Mây thì Mây mất một Flame.
_Avoid_: quái, kẻ địch, ghost, enemy

**Flame** (`flames`):
Một mạng của Mây. Hết Flame thì thua.
_Avoid_: máu, HP, mạng, lives

## Hành động và trạng thái

**Nạp** (`deposit`):
Chuyển Ánh sáng từ Mây vào một Đèn Lồng Lớn chưa Thắp.
_Avoid_: đổ đèn, fill, charge

**Thắp** (`lit`):
Trạng thái của Đèn Lồng Lớn khi lượng đã Nạp đủ chi phí đèn. Không đảo ngược.
_Avoid_: bật, sáng (khi nói về trạng thái)

**Tỏa sáng** (`pulse`):
Kỹ năng của Mây: tiêu Ánh sáng để làm Choáng và đẩy lùi các Bóng Mực gần đó.
_Avoid_: skill, nova, burst

**Choáng** (`stunned`):
Trạng thái Bóng Mực sau khi trúng Tỏa sáng: đứng yên và vô hại trong một khoảng thời gian.
_Avoid_: đóng băng, freeze

**Bất tử** (`invuln`):
Khoảng thời gian ngay sau khi Mây mất một Flame, trong đó Mây không mất thêm Flame.
_Avoid_: khiên, i-frame

**Vùng an toàn** (`safe_radius`):
Vùng tròn quanh một Đèn Lồng Lớn **đã Thắp**, Bóng Mực không vào được. Đèn chưa Thắp không có Vùng an toàn.
_Avoid_: hào quang, aura

## Màn chơi

**Đêm** (`night`):
Một màn chơi có thời lượng cố định. Phase 1 chỉ có Đêm 1 – Đảo Bến.
_Avoid_: level, màn

**Bình minh** (`dawn`):
Thời điểm Đêm hết thời lượng. Tới Bình minh mà chưa Thắp hết đèn thì thua.
_Avoid_: hết giờ, timeout

**Ván** (`game`):
Một lượt chơi từ đầu Đêm tới khi thắng hoặc thua.
_Avoid_: round, session

## Test Contract

**Scenario**:
Tình huống dựng sẵn trước tick 0 để kiểm thử. Dựng Scenario không phát sự kiện và không cộng điểm.
_Avoid_: fixture, level file

**Tuning**:
Bộ con số game thật sự dùng, khai báo trong `game.contract.json`; test ẩn sinh tình huống từ chính các số này.
_Avoid_: config, settings
