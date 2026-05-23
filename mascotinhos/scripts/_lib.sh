#!/bin/bash
# Shared helpers for scripts/. Source from each script with:
#   source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

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
  echo "ERROR: no env file found (set ENV_FILE or create apps/web/.env)" >&2
  return 1
}

# Read a single env var from $1 (file path) named $2.
# Strips surrounding quotes, trailing literal `\n`, and trailing whitespace.
get_env() {
  python3 - "$1" "$2" <<'PY'
import re, sys
path, name = sys.argv[1], sys.argv[2]
with open(path) as f:
    s = f.read()
# Try quoted first (multiline-tolerant), then unquoted.
m = re.search(rf'^{re.escape(name)}="([^"]*)"', s, re.M | re.S)
if m is None:
    m = re.search(rf'^{re.escape(name)}=([^\n]*)$', s, re.M)
    if m is None:
        sys.exit(1)
val = m.group(1)
# Strip literal backslash-n (may appear multiple times) then real whitespace.
while val.endswith("\\n"):
    val = val[:-2]
val = val.rstrip()
sys.stdout.write(val)
PY
}

# Print to stderr.
err() { printf '%s\n' "$*" >&2; }
