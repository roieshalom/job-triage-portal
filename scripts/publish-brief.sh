#!/usr/bin/env bash
# ===================================================================
# publish-brief.sh — encrypt today's brief and push it to GitHub Pages
# -------------------------------------------------------------------
# Your morning "Job triage" routine calls this with the brief text.
# It encrypts the brief to brief.enc (AES-256-GCM, see encrypt-brief.mjs)
# and commits + pushes, so opening triage.roiesh.com shows the board once
# the reader unlocks it with the passphrase. The plaintext is NEVER
# committed — only the ciphertext (brief.enc) is, so the brief is hidden
# from anyone without the passphrase.
#
# The passphrase comes from $BRIEF_PASSPHRASE or the .brief-key file
# (gitignored). Every publisher MUST use the SAME passphrase, or the
# browser will fail to decrypt whichever brief was pushed last.
#
# Usage:
#   ./scripts/publish-brief.sh path/to/brief.txt
#   <command that prints the brief> | ./scripts/publish-brief.sh
# ===================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1. Get the plaintext into a local temp file (never committed). Accept a
#    file arg or stdin.
PLAIN="$(mktemp "${TMPDIR:-/tmp}/brief-plain.XXXXXX")"
trap 'rm -f "$PLAIN"' EXIT
if [ "${1:-}" ]; then
  cp "$1" "$PLAIN"
else
  cat > "$PLAIN"
fi
if [ ! -s "$PLAIN" ]; then
  echo "Empty brief — nothing to publish." >&2
  exit 1
fi

# 2. Publish only if the brief TEXT actually changed. We compare a hash of
#    the plaintext (the ciphertext changes every run because of the random
#    salt/iv, so it can't be used to detect real changes). The hash is a
#    one-way digest of anonymised public job listings — safe to commit, and
#    it reveals nothing about the content.
newhash="$(shasum -a 256 "$PLAIN" | awk '{print $1}')"
oldhash="$(cat .brief-hash 2>/dev/null || true)"
if [ -f brief.enc ] && [ "$newhash" = "$oldhash" ]; then
  echo "Brief unchanged — nothing to publish."
  exit 0
fi

# 2b. Link guard. The portal only turns a role into a clickable link when
#     its brief block carries a raw URL line. If the generator drops those
#     URLs (as happened 2026-11-08, when 11 of 15 roles lost their link),
#     refuse to publish a mostly-unclickable brief rather than ship it. A
#     rare genuinely-linkless role is tolerated (BRIEF_MAX_LINKLESS, default
#     1); a systemic drop aborts here, before anything is encrypted or
#     pushed, with the offending roles listed so the generator can fix them.
if ! node scripts/check-brief-urls.mjs "$PLAIN"; then
  echo "Aborting publish — too many roles are missing their posting URL (see above)." >&2
  exit 1
fi

# 3. Encrypt the plaintext to brief.enc (passphrase from $BRIEF_PASSPHRASE
#    or .brief-key), and record the new hash.
node scripts/encrypt-brief.mjs "$PLAIN"
printf '%s\n' "$newhash" > .brief-hash

# 3b. Archive a dated copy so the portal can show past briefs. Today's
#     ciphertext is kept at briefs/<YYYY-MM-DD>.enc, and briefs/index.json
#     lists the available dates for the portal's date picker. Re-copying on
#     a same-day re-publish just overwrites today's archive (correct), and
#     the index is rebuilt from whatever archives exist.
TODAY="$(date +%Y-%m-%d)"
mkdir -p briefs
cp brief.enc "briefs/$TODAY.enc"
node scripts/update-brief-index.mjs

git add brief.enc .brief-hash briefs/
if git diff --cached --quiet; then
  echo "Nothing staged to publish."
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
[ "$pushed" = 1 ] || { echo "Could not push brief.enc after 3 attempts." >&2; exit 1; }
echo "Published. Live at https://triage.roiesh.com/ within a minute."

# 4. Native macOS notification (best-effort) so you know it's ready even if
#    the browser is closed. Silently skipped on non-macOS / no osascript.
if command -v osascript >/dev/null 2>&1; then
  osascript -e 'display notification "Today’s job brief is ready." with title "Job triage" sound name "Glass"' >/dev/null 2>&1 || true
fi
