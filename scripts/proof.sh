#!/bin/sh
# Sinh bằng chứng cho phase N vào docs/proof/phase-N/. Không chứa thời gian chạy hay đường dẫn tuyệt đối,
# nên chạy lại ở cùng commit sẽ ra cùng nội dung.
set -e
phase=${1:?cách dùng: scripts/proof.sh <số-phase>}
dir=docs/proof/phase-$phase
# Bằng chứng phải khớp mã ở tag: không cho chạy khi code/test còn thay đổi chưa commit
# (bài học phase-2/3: src/headless.ts bị bỏ quên, tag chứa bản cũ dù test local xanh).
dirty=$(git status --porcelain -- src tests package.json package-lock.json game.contract.json tsconfig.json index.html)
if [ -n "$dirty" ]; then echo "Còn thay đổi chưa commit, commit trước rồi mới sinh bằng chứng:"; echo "$dirty"; exit 1; fi
mkdir -p "$dir"
npm run build --silent

if ! node --test tests/*.test.mjs > "$dir/tests.raw" 2>&1; then
  cat "$dir/tests.raw"; rm "$dir/tests.raw"; echo "TEST ĐỎ: không sinh bằng chứng"; exit 1
fi
grep -E '^(✔|✖|ℹ (tests|pass|fail))' "$dir/tests.raw" | sed -E 's/ \([0-9.]+m?s\)$//' > "$dir/tests.txt"
rm "$dir/tests.raw"

run() { node dist/headless.js --night 1 "$@"; }
# 1) Đúng scenario + inputs ví dụ trong Test Contract v1.0
run --seed 7 --scenario docs/proof/contract-example.scenario.json --inputs docs/proof/contract-example.inputs.json \
    --ticks 600 --out "$dir/contract-example.jsonl"
run --seed 7 --scenario docs/proof/contract-example.scenario.json --inputs docs/proof/contract-example.inputs.json \
    --ticks 600 --out "$dir/rerun.jsonl"
cmp -s "$dir/contract-example.jsonl" "$dir/rerun.jsonl"
# 2) Một ván mặc định (seed 1, Mây đứng yên) chạy tới khi kết thúc
run --seed 1 --ticks 18000 --snapshot-every 60 --out "$dir/default-night.jsonl"
run --seed 1 --ticks 18000 --snapshot-every 60 --out "$dir/rerun.jsonl"
cmp -s "$dir/default-night.jsonl" "$dir/rerun.jsonl"
rm "$dir/rerun.jsonl"

{
  echo "Tất định: mỗi kịch bản chạy 2 lần, cmp giống hệt từng byte."
  echo "contract-example: $(tail -1 "$dir/contract-example.jsonl")"
  echo "default-night:    $(tail -1 "$dir/default-night.jsonl")"
  echo "sự kiện contract-example:"; grep '"type":"event"' "$dir/contract-example.jsonl"
  echo "sự kiện default-night:"; grep '"type":"event"' "$dir/default-night.jsonl"
} > "$dir/summary.txt"
cat "$dir/tests.txt" | tail -3
cat "$dir/summary.txt"
