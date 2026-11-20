---
name: proof
description: Sinh bằng chứng kiểm chứng cho một phase (test, chạy headless mẫu, kiểm tra tất định) vào docs/proof/phase-N/. Dùng trước khi gắn tag phase-N hoặc khi cần chứng minh game chạy đúng.
---

1. Chạy `scripts/proof.sh <N>` từ gốc repo (N = số phase hiện tại).
2. Script build, chạy toàn bộ test, chạy hai lần kịch bản mẫu của contract cùng một ván mặc định đến lúc kết thúc, so sánh hai lần chạy (tất định) và ghi vào `docs/proof/phase-N/`.
3. Script đỏ thì dừng: sửa code hoặc test (kèm lý do), không sửa file bằng chứng.
4. Cập nhật bảng "yêu cầu → bằng chứng → kết quả" trong `docs/notes/phase-N.md`, trỏ tới file trong `docs/proof/phase-N/`.
5. Commit bằng chứng cùng commit sẽ gắn tag, để bằng chứng khớp mã ở tag.
