#!/usr/bin/env bash
# ===================================================================
# publish-brief.sh — publish today's brief and push it to GitHub Pages
# -------------------------------------------------------------------
# Your morning "Job triage" routine calls this with the brief text.
# It writes the plaintext brief to brief.txt and commits + pushes, so
# opening triage.roiesh.com shows the board with no pasting. The brief is
# anonymised (no personal profile), so it is published in the clear — no
# passphrase, no encryption.
#
# Usage:
#   ./scripts/publish-brief.sh path/to/brief.txt
#   <command that prints the brief> | ./scripts/publish-brief.sh
# ===================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1. Write the plaintext brief to brief.txt (from a file arg, or stdin)
if [ "${1:-}" ]; then
  cp "$1" brief.txt
else
  cat > brief.txt
fi
if [ ! -s brief.txt ]; then
  echo "Empty brief — nothing to publish." >&2
  exit 1
fi

# 2. Publish only if the brief actually changed
git add brief.txt
if git diff --cached --quiet; then
  echo "brief.txt unchanged — nothing to publish."
  exit 0
fi
git commit -m "Publish brief $(date +%Y-%m-%d)"

# Land the commit cleanly even if code commits raced in from another session
# (this repo is used for development too). Rebase onto origin, then push; retry.
branch="$(git rev-parse --abbrev-ref HEAD)"
pushed=0
for attempt in 1 2 3; do
  git pull --rebase --autostash origin "$branch" >/dev/null 2>&1 || true
  if git push origin "$branch"; then pushed=1; break; fi
  echo "Push attempt $attempt failed — retrying in 3s…" >&2
  sleep 3
done
[ "$pushed" = 1 ] || { echo "Could not push brief.txt after 3 attempts." >&2; exit 1; }
echo "Published. Live at https://triage.roiesh.com/ within a minute."

# 3. Native macOS notification (best-effort) so you know it's ready even if
#    the browser is closed. Silently skipped on non-macOS / no osascript.
if command -v osascript >/dev/null 2>&1; then
  osascript -e 'display notification "Today’s job brief is ready." with title "Job triage" sound name "Glass"' >/dev/null 2>&1 || true
fi
