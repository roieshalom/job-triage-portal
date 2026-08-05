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
