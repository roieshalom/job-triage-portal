# Prompt to paste into Claude Code

Copy everything in the fenced block below and give it to Claude Code, run
from inside this folder.

```
Create a new PRIVATE GitHub repository named "job-triage-portal" and push
this folder to it. Then enable GitHub Pages so index.html is served.

Steps:
1. Verify gh CLI is authenticated (gh auth status). If not, tell me how to
   authenticate and stop.
2. Initialise git here if it isn't already, commit all files with the
   message "Initial commit: job triage portal".
3. Create the private repo with: gh repo create job-triage-portal --private --source=. --remote=origin --push
4. Enable GitHub Pages serving from the main branch root. If gh can't do it
   directly, give me the exact click-path in Settings > Pages.
5. Print the final Pages URL (https://<username>.github.io/job-triage-portal/).

Do not add any analytics, build tooling, or dependencies. This is a single
static HTML file plus a README. Keep it that way.
```

## If you don't have Claude Code or gh set up

You can do it by hand in a few minutes:

1. On github.com, create a new private repo called `job-triage-portal`
   (don't initialise it with a README, you already have one).
2. In this folder:
   ```
   git init
   git add .
   git commit -m "Initial commit: job triage portal"
   git branch -M main
   git remote add origin https://github.com/<username>/job-triage-portal.git
   git push -u origin main
   ```
3. On github.com: repo Settings > Pages > Source: "Deploy from a branch" >
   Branch: main / root > Save.
4. Wait a minute; your URL appears at the top of that Pages settings page:
   `https://<username>.github.io/job-triage-portal/`
5. Bookmark it.
