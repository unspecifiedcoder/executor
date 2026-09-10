#!/usr/bin/env bash
# Fails if a number the docs assert disagrees with the number the repo produces.
#
# This exists because the test count in the submission copy was wrong in three
# consecutive review rounds. Every time, the fix was to edit a number by hand,
# and every time it went stale again the next commit that added a test. A claim
# a reader can check in one command has to be checked by CI in one command too.
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.foundry/bin"

fail=0
note() { echo "  MISMATCH: $1"; fail=1; }

total=$(cd contracts && forge test 2>/dev/null | grep -oE '[0-9]+ tests passed' | tail -1 | grep -oE '^[0-9]+')
if [ -z "$total" ]; then echo "could not run forge test"; exit 2; fi
echo "forge test reports $total tests"

# Per-suite counts, read from forge's own summary table.
declare -A suites
while read -r name count; do suites[$name]=$count; done < <(
  cd contracts && forge test --summary 2>/dev/null \
    | awk -F'|' '/^\| [A-Za-z]+Test/ {gsub(/ /,"",$2); gsub(/ /,"",$3); print $2, $3}'
)
for s in "${!suites[@]}"; do echo "  $s: ${suites[$s]}"; done

# A doc may legitimately cite the total *or* an individual suite's count, so a
# number is acceptable if it is any of them. What this catches is a number that
# matches nothing the repo actually produces - which is what "37 tests" became
# the moment the registry suite grew to 43.
valid="$total"
for s in "${!suites[@]}"; do valid="$valid ${suites[$s]}"; done

for f in README.md docs/*.md; do
  [ -f "$f" ] || continue
  while read -r n; do
    ok=0
    for v in $valid; do [ "$n" = "$v" ] && ok=1; done
    [ "$ok" = 1 ] || note "$f says '$n tests' - no suite or total has that count (total $total)"
  done < <(grep -oE '\b[0-9]{2,4} tests\b' "$f" | grep -oE '^[0-9]+' | sort -u)
done

if [ "$fail" = 0 ]; then echo "docs agree with the repo"; else
  echo
  echo "Fix the docs, or the number, but do not ship them disagreeing."
fi
exit $fail
