#!/usr/bin/env node
// ===================================================================
// check-brief-urls.mjs — guard against briefs that are missing links
// -------------------------------------------------------------------
// The portal turns each role's title into a link ONLY when the brief
// text carries a raw URL line for that role (see the parser in
// index.html). When the generator drops those URL lines, the roles
// render as dead plain text. This happened on 2026-11-08: the top two
// tiers had links, but every role in "Maybe" and "Probably not" lost
// its URL, so most of the board was unclickable.
//
// This script parses the brief the SAME way the portal does and reports
// every role that has no URL line. It exits non-zero when too many roles
// are missing a link, so publish-brief.sh can refuse to publish a broken
// brief. The generator's own prompt allows the RARE genuinely-linkless
// role (e.g. a recruiter post with no landing page), so a small tolerance
// is permitted; a systemic drop (today: 11 of 15) is blocked.
//
// Usage:
//   node scripts/check-brief-urls.mjs path/to/brief.txt
//   node scripts/check-brief-urls.mjs < brief.txt
//
// Tolerance: at most $BRIEF_MAX_LINKLESS roles (default 1) may lack a URL.
// ===================================================================

import { readFileSync } from "node:fs";

function readInput() {
  const arg = process.argv[2];
  try {
    return arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8");
  } catch (e) {
    console.error("check-brief-urls: could not read the brief: " + e.message);
    process.exit(2);
  }
}

// Mirror the portal's own URL test: a raw, full-line http(s) URL.
function isUrl(line) { return /^https?:\/\/\S+$/i.test(line.trim()); }

// A role block's first line is "Company — Role Title" (always has an
// em/en dash). Group headers carry stars; the summary starts "Apply
// today"; a "Nothing strong today." fallback has no dash. We only police
// actual role blocks.
function isHeaderLine(line) { return /[★☆]/.test(line); }
function isApplyLine(line)  { return /^\**\s*apply today\b/i.test(line.trim()); }
function looksLikeRole(line) {
  return /[—–]/.test(line) && !isHeaderLine(line) && !isApplyLine(line);
}

const text = readInput();
const blocks = text.split(/\r?\n\s*\r?\n/);

let roleCount = 0;
const linkless = [];

for (const block of blocks) {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) continue;
  const first = lines[0];
  if (isHeaderLine(first) || isApplyLine(first)) continue;
  if (!looksLikeRole(first)) continue;   // not a role block (e.g. a note)

  roleCount++;
  if (!lines.some(isUrl)) linkless.push(first);
}

const tolerance = Math.max(0, parseInt(process.env.BRIEF_MAX_LINKLESS ?? "1", 10) || 0);

if (roleCount === 0) {
  // No parseable roles — don't block on an empty/odd brief; publish-brief.sh
  // has its own empty-brief check. Just note it and pass.
  console.error("check-brief-urls: no role blocks detected — skipping link check.");
  process.exit(0);
}

if (linkless.length) {
  console.error(
    "check-brief-urls: " + linkless.length + " of " + roleCount +
    " roles are missing a URL line (tolerance " + tolerance + "):"
  );
  for (const title of linkless) console.error("  • " + title);
}

if (linkless.length > tolerance) {
  console.error(
    "check-brief-urls: too many roles without links — refusing to publish. " +
    "Give every role its specific posting URL on its own line, then retry. " +
    "(Override once with BRIEF_MAX_LINKLESS=<n> if these are genuinely linkless.)"
  );
  process.exit(1);
}

console.error("check-brief-urls: OK — " + roleCount + " roles, " + linkless.length + " linkless (within tolerance).");
process.exit(0);
