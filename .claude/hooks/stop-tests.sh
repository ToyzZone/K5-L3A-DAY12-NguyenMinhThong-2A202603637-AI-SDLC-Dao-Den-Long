#!/bin/sh
# Stop hook: không cho agent kết thúc lượt khi test đang đỏ.
# stop_hook_active = true nghĩa là đã chặn một lần rồi; cho qua để tránh vòng lặp vô hạn.
input=$(cat)
case "$input" in *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;; esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -f package.json ] || exit 0
if ! out=$(npm test --silent 2>&1); then
  echo "Test đang đỏ, chưa được kết thúc. Sửa cho xanh (hoặc ghi rõ 'chưa đạt' kèm lý do) rồi mới dừng:" >&2
  echo "$out" | grep -E '✖|fail|Error' | head -20 >&2
  exit 2
fi
exit 0
