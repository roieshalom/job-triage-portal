# Job Triage Portal

A personal, single-file paste-in view for a daily job-search brief.
No backend, no stored data, no tracking. Open it, paste the morning's
brief, and it renders roles grouped by fit with a direct apply link and
an "Add to Trello" button per role.

## Daily use

1. Open the "Job triage" scheduled task in Claude and copy the full brief
   (the grouped ★ list plus the "Apply today" section).
2. Open this portal (the GitHub Pages URL).
3. Paste, hit **Show board**.

Nothing is saved between sessions. Trello is the source of truth for the
application pipeline; the portal just hands roles off to it.

## Auto-publishing the brief (no paste)

The morning routine can publish the brief so the portal shows it with no
pasting. The brief is **encrypted on your machine** and only the ciphertext
(`brief.enc`) is committed, so it stays private even though the repo/site is
public — a visitor sees gibberish; only your browser, with your passphrase,
decrypts it.

One-time setup:

1. Create a `.brief-key` file at the repo root containing a single line — your
   passphrase. It is gitignored and must **never** be committed. (Or set the
   `BRIEF_PASSPHRASE` env var instead.)
2. First time you open the portal on a device, it prompts for that same
   passphrase and remembers it in the browser. After that, opening the site
   just shows the board.

Each morning, the routine runs:

```
<command that prints the brief> | ./scripts/publish-brief.sh
# or:  ./scripts/publish-brief.sh path/to/brief.txt
```

That encrypts the brief to `brief.enc` (see `scripts/encrypt-brief.mjs`) and
pushes it. The portal fetches and decrypts `brief.enc` on load; the crypto
(AES-256-GCM, key via PBKDF2) is mirrored in the `autoLoad` block in
`index.html`. If nothing is published, or the passphrase is wrong, the portal
silently falls back to the manual paste box.

## Pipeline board (kanban)

A second tab, **Pipeline**, is a lightweight Trello-style board for tracking
applications: name-able lists, cards with a title + notes, per-card **status
updates**, and **documented moves** between lists (each move and update is
timestamped in the card's Activity log).

State is stored in the browser via `localStorage` (key `triage_board_v1`), so
it is **per-device** for now and never leaves your machine. All reads/writes go
through a single `loadBoard()`/`saveBoard()` pair (the "STORAGE LAYER" comment
in the pipeline `<script>`); swapping those two functions for a backend is the
whole job of adding cross-device sync later, with no other code changes.

## The brief format it expects

The portal parses the exact format the scheduled task produces. Each role
is three lines:

```
Company — Role Title            [manager]   ← [manager] flag is optional
Level · Location · short reason it fits
https://direct-apply-url
```

Roles are grouped under star headers:

```
★★★★★ Strong match
★★★★ Worth a look
★★★ Maybe
★★ Probably not
```

If the task's output format changes, the parser in `index.html` needs a
matching tweak (see the big comment block above the `parse()` function).

## Restyling

All visual tokens live in the `:root` block at the top of the `<style>`
section in `index.html`: colours, fonts, radius, spacing, the rating-band
tints. Change those to restyle the whole thing. The intent is to match
roiesh.com.

## Trello handoff

By default the "Add to Trello" button opens Trello's pre-filled add-card
page (you pick the board and list). To make cards land in one specific
list automatically, set `idList` in the `TRELLO_CONFIG` block near the top
of the `<script>` at the bottom of `index.html`. Find the list ID by
opening your board, appending `.json` to the URL, and searching for the
list's `id`.

## Hosting

Served as a static file via GitHub Pages. The entry point is `index.html`.
