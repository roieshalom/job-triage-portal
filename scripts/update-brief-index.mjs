#!/usr/bin/env node
// ===================================================================
// update-brief-index.mjs — rebuild briefs/index.json from the archive
// -------------------------------------------------------------------
// The portal shows past briefs by fetching briefs/<YYYY-MM-DD>.enc. This
// script lists every dated archive in briefs/ and writes the sorted list
// of dates (oldest first) to briefs/index.json, which the date-picker in
// index.html reads to know which briefs exist. Safe to commit — it holds
// only dates, never brief content.
//
// Usage: node scripts/update-brief-index.mjs
// ===================================================================

import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "briefs");

mkdirSync(DIR, { recursive: true });

const dates = readdirSync(DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.enc$/.test(f))
  .map((f) => f.slice(0, 10))
  .sort();

writeFileSync(join(DIR, "index.json"), JSON.stringify(dates) + "\n");
console.error("Wrote briefs/index.json (" + dates.length + " briefs).");
