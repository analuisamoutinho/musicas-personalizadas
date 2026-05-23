#!/bin/bash
# Scan an env file for keys that have stray `\n` literals or trailing real
# newlines. Useful after `vercel env pull` since secrets sometimes get a
# literal backslash-n appended.
#
# Exits 1 if any value needs cleaning, 0 otherwise.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

resolve_env_file() {
  if [[ -n "${ENV_FILE:-}" && -f "$ENV_FILE" ]]; then
    echo "$ENV_FILE"
    return
  fi
  local candidate="$REPO_ROOT/apps/web/.env"
  if [[ -f "$candidate" ]]; then
    echo "$candidate"
    return
  fi
  if [[ -f "/tmp/.env.mascotinhos" ]]; then
    echo "/tmp/.env.mascotinhos"
    return
  fi
  echo "ERROR: no env file found (set ENV_FILE)" >&2
  exit 2
}

ENV_PATH="$(resolve_env_file)"

echo "=== inspect-env ==="
echo "Reading: $ENV_PATH"
echo ""

python3 - "$ENV_PATH" <<'PY'
import re, sys
path = sys.argv[1]
with open(path) as f:
    text = f.read()

# Match KEY="..." possibly spanning lines (greedy until closing quote on same key line).
# Capture both KEY=value (no quotes) and KEY="value" forms.
pattern = re.compile(r'^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|([^\n]*))$', re.M)

rows = []
needs = 0
for m in pattern.finditer(text):
    key = m.group(1)
    val = m.group(2) if m.group(2) is not None else (m.group(3) or "")
    raw_len = len(val)
    has_literal_backslash_n = val.endswith("\\n")
    # Real trailing newline / whitespace inside the quoted block
    has_real_trailing = val != val.rstrip()
    needs_cleaning = has_literal_backslash_n or has_real_trailing
    if needs_cleaning:
        needs += 1
    last5 = repr(val[-5:]) if val else "''"
    rows.append((key, raw_len, "yes" if needs_cleaning else "no", last5))

print(f"{'KEY':<40} {'LEN':>6}  {'CLEAN?':<8} LAST_5_CHARS")
print("-" * 80)
for key, n, clean, last5 in rows:
    print(f"{key:<40} {n:>6}  {clean:<8} {last5}")

print("")
print(f"Total keys: {len(rows)}")
print(f"Need cleaning: {needs}")
sys.exit(1 if needs > 0 else 0)
PY
