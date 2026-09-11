#!/usr/bin/env bash
# PreToolUse hook (Edit|Write). Blocks hand edits to values the brief says are
# generated or fixed:
#   - `macros:` blocks in recipe frontmatter  -> produced by scripts/compute-macros.mjs
#   - per-serving gram quantities, `portion`, `anchorGrams` in the seed / plan YAML
#   - per-100g nutrition numbers in the ingredient table (source: strings may change)
# Exit 2 blocks the tool call and shows the message to Claude.
# Escape hatch: touch .claude/allow-computed-edits to bypass for a session, remove it after.
set -u
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -f "$root/.claude/allow-computed-edits" ] && exit 0

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
old=$(printf '%s' "$input" | jq -r '.tool_input.old_string // empty')
new=$(printf '%s' "$input" | jq -r '.tool_input.new_string // empty')
content=$(printf '%s' "$input" | jq -r '.tool_input.content // empty')
touched=$(printf '%s\n%s\n%s' "$old" "$new" "$content")

block() { printf '%s\n' "BLOCKED by .claude/hooks/guard-computed-fields.sh: $1" >&2; exit 2; }

case "$file" in
  */src/content/recipes/*.md)
    if printf '%s' "$touched" | grep -Eq '^\s*macros:'; then
      block "the macros block in recipe frontmatter is generated. Edit ingredient quantities and run 'npm run compute-macros' instead."
    fi
    ;;
  */diet-chart-seed.yaml|*/src/data/ingredients.yaml|*/src/content/plan/*.yaml)
    # Whole-file overwrite of fixed data is never what we want.
    [ -n "$content" ] && block "'$file' holds fixed seed data. Use Edit for a targeted change, or scripts for migration."
    # portion / anchorGrams are the plan's tuning knobs the brief fixed.
    if printf '%s' "$touched" | grep -Eq '^\s*(portion|anchorGrams):'; then
      block "portion / anchorGrams are fixed by the validated 14-day plan. Day totals depend on them."
    fi
    # Bare gram lines inside a recipe's ingredient list, e.g. "      paneer_lowfat: 130"
    if printf '%s' "$touched" | grep -Eq '^\s+[a-z_]+:\s*[0-9]+(\.[0-9]+)?\s*(#.*)?$'; then
      block "per-serving gram quantities are fixed by the seed. Changing them breaks the reproduced day totals."
    fi
    # Ingredient table rows: allow only the source: field to change.
    if printf '%s' "$old" | grep -q '{ kcal:'; then
      strip() { sed -E 's/source:[^,}]*//g; s/[[:space:]]+//g'; }
      if [ "$(printf '%s' "$old" | strip)" != "$(printf '%s' "$new" | strip)" ]; then
        block "per-100g nutrition values in the ingredient table are fixed. Only the source: field may change. If a value is genuinely wrong per IFCT/USDA, touch .claude/allow-computed-edits, make the change, re-run the validator, then remove the marker."
      fi
    fi
    ;;
esac
exit 0
