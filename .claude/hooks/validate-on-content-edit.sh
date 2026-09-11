#!/usr/bin/env bash
# PostToolUse hook (Edit|Write). After any change under src/content, src/data,
# or to the seed file, run the plan validator so failures surface immediately
# with the per-day actuals table. No-op until scripts/validate-plan.mjs exists.
set -u
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
case "$file" in
  */src/content/*|*/src/data/*|*/diet-chart-seed.yaml|*/src/nutrition.config.ts) ;;
  *) exit 0 ;;
esac
[ -f "$root/scripts/validate-plan.mjs" ] || exit 0
cd "$root" || exit 0
out=$(NODE_NO_WARNINGS=1 node --experimental-strip-types scripts/validate-plan.mjs --quiet 2>&1); rc=$?
if [ $rc -ne 0 ]; then
  printf 'validate-plan.mjs failed after editing %s:\n%s\n' "$file" "$out" >&2
  exit 2
fi
exit 0
