# Automatic save + GitHub + Vercel Preview

Flow: **change code → `npm run save` (secret scan, checks, commit, push to an `eureka/*` branch) → GitHub → `Preview` workflow → Vercel preview of that exact commit → live checks → status with SHA + URL.**

Existing systems are reused, not duplicated: `cloudflare-deploy.yml` (PRs to `main` verify only; `main` deploys the Cloudflare Worker) and `vercel.json` (Vite build, `dist`, SPA rewrite) are unchanged. `preview.yml` only runs on `eureka/**` branches.

## 1. Save (`npm run save -- "type: message"`)
`scripts/save-work.mjs`:
- Refuses to run unless the current branch is `eureka/*` (never `main`; no force push, no merge).
- Stages changes, then runs `scripts/secret-scan.mjs` on the staged files and added lines: blocks `.env*` (except `.env.example`), `*.pem/*.key`, `.dev.vars`, `.vercel/`, private-key blocks, GitHub/AWS/Slack/`sk-` tokens, `*TOKEN=`/`PASSWORD=` style assignments, seed phrases. Findings list file and reason only, never the value. Nothing is committed on a finding.
- Runs `npm run verify` (build + routing + unit/integration tests + `wrangler deploy --dry-run`; this already covers `npm test` and `npm run build`) and `scripts/audit-check.mjs`. If either fails, nothing is committed and the work must not be reported ready. `--skip-checks` exists for docs-only changes and is recorded as `pushed-checks-skipped`.
- Commits (message you pass, or a derived `chore: update <dirs> (N files)`) with the Copilot co-author trailer, pushes with upstream, and writes `.agent-reports/last-save.json` (branch, SHA, check results; git-ignored).
- Changes persist across agent sessions because they are on GitHub; start a session with `git fetch && git switch eureka/<branch>`.

## 2. Preview (`.github/workflows/preview.yml`)
On every push to `eureka/**`: `npm ci` → `npm run verify` → audit → `vercel build` for the preview environment → writes `build-info.json` (`sha`, `branch`, `target: preview`) → `vercel deploy --prebuilt` (**no `--prod`**) with commit metadata → `scripts/preview-check.mjs` (HTTP 200, app shell, served SHA equals pushed SHA, target is preview) → Playwright desktop (1366×768) and mobile (390×844) check (no page errors, no horizontal overflow, content rendered; screenshots uploaded as an artifact) → commit status `vercel-preview` whose link is the Preview URL, plus a job summary with SHA, branch, URL. Newer pushes cancel older preview runs of the same branch.

Production and preview stay separate: production is only the Cloudflare job on `main`; previews are only `vercel deploy` without `--prod`, and `build-info.json` states `target: preview`.

## 3. Required permissions (not configured by this change)
Repository secrets (Settings → Secrets and variables → Actions), set by the owner:
| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel token limited to the team/project |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` (optional) | Needed only if Vercel Deployment Protection blocks automated access to previews |
GitHub: the workflow uses the built-in `GITHUB_TOKEN` (`contents: read`, `statuses: write`). Without the Vercel secrets the `vercel preview` job fails with a message naming the missing secrets; the quality gate still runs. Alternative: install the Vercel GitHub App on the repo, which creates previews itself (then drop the `preview` job, keep `quality`).

## Status
| Item | State |
|---|---|
| Secret scan | implemented, unit-tested |
| Save script guards (branch, scan, checks, report) | implemented; branch guard and commit/push exercised once locally |
| `preview.yml`, `preview-check.mjs` | implemented, **not run**: needs Vercel secrets and a push to trigger; **not live-verified** |
| Mobile/desktop check | implemented in the workflow, not run |
