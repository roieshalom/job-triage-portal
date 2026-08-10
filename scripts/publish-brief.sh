#!/usr/bin/env bash
# ===================================================================
# publish-brief.sh — encrypt today's brief and push it to GitHub Pages
# -------------------------------------------------------------------
# Your morning "Job triage" routine calls this with the brief text.
# It encrypts to brief.enc (see encrypt-brief.mjs) and commits + pushes,
# so opening triage.roiesh.com shows the board with no pasting.
#
# Usage:
#   ./scripts/publish-brief.sh path/to/brief.txt
#   <command that prints the brief> | ./scripts/publish-brief.sh
# ===================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1. Encrypt (passphrase comes from $BRIEF_PASSPHRASE or .brief-key)
if [ "${1:-}" ]; then
  node scripts/encrypt-brief.mjs "$1"
else
  node scripts/encrypt-brief.mjs
fi

# 2. Publish only if the ciphertext actually changed
git add brief.enc
if git diff --cached --quiet; then
  echo "brief.enc unchanged — nothing to publish."
  exit 0
fi
git commit -m "Publish brief $(date +%Y-%m-%d)"
git push
echo "Published. Live at https://triage.roiesh.com/ within a minute."
