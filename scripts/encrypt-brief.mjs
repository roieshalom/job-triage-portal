#!/usr/bin/env node
// ===================================================================
// encrypt-brief.mjs — turn a plaintext brief into brief.enc
// -------------------------------------------------------------------
// Encrypts with AES-256-GCM; the key is derived from a passphrase via
// PBKDF2-SHA256. The SAME scheme is implemented in the browser (see the
// autoLoad block in index.html), so what this writes, the page decrypts.
//
// The passphrase and the plaintext are NEVER written to git — only the
// ciphertext (brief.enc) is. Passphrase source, in order:
//   1. $BRIEF_PASSPHRASE
//   2. the .brief-key file at the repo root (gitignored)
//
// Usage:
//   node scripts/encrypt-brief.mjs  < brief.txt        # from stdin
//   node scripts/encrypt-brief.mjs  path/to/brief.txt  # from a file
// ===================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ITER = 250000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

function getPassphrase() {
  if (process.env.BRIEF_PASSPHRASE && process.env.BRIEF_PASSPHRASE.trim()) {
    return process.env.BRIEF_PASSPHRASE.trim();
  }
  try {
    return readFileSync(join(ROOT, ".brief-key"), "utf8").trim();
  } catch {
    console.error(
      "No passphrase found. Set $BRIEF_PASSPHRASE, or create a .brief-key " +
      "file (one line) at the repo root."
    );
    process.exit(1);
  }
}

function readPlaintext() {
  const arg = process.argv[2];
  try {
    return arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8");
  } catch (e) {
    console.error("Could not read the brief: " + e.message);
    process.exit(1);
  }
}

const pass = getPassphrase();
const plaintext = readPlaintext();
if (!plaintext.trim()) {
  console.error("Empty brief — nothing to encrypt.");
  process.exit(1);
}

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey(
  "raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]
);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
  baseKey,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"]
);
const ct = new Uint8Array(
  await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext))
);

const payload = {
  v: 1,
  kdf: "PBKDF2",
  iter: ITER,
  salt: b64(salt),
  iv: b64(iv),
  ct: b64(ct),
};
writeFileSync(join(ROOT, "brief.enc"), JSON.stringify(payload));
console.error("Wrote brief.enc (" + ct.length + " bytes ciphertext).");
