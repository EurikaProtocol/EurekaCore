# GitHub Actions deployment: Worker `eurekacore-v3`

**Status: PREPARED, NOT DEPLOYED.** Nothing has been deployed or created in Cloudflare. Workflow: `.github/workflows/cloudflare-deploy.yml`. Config: `wrangler.toml` only (Worker `eurekacore-v3`, entry `cloudflare/worker.js`, `ASSETS` binding, SPA fallback, `run_worker_first = ["/api/*"]`, route `www.tinaneureka.com`).

## Pipeline
| Job | Runs on | Does |
|---|---|---|
| `verify` (check name `build`) | PRs to `main`, pushes to `main`, manual runs | `npm ci` (Node 22) → `npm run verify` (clean build, routing regression tests, unit/integration tests, `wrangler deploy --dry-run --config wrangler.toml`) → `node scripts/audit-check.mjs`. **No Cloudflare secrets are available to this job**, so PRs and forks cannot deploy or read them. |
| `deploy` | only `github.ref == refs/heads/main` for `push` or `workflow_dispatch`, after `verify` passes | `npm ci` → credential preflight (prints names only) → `npm run build` → `npm run deploy` (`wrangler deploy --config wrangler.toml`) |

Safeguards: workflow `permissions: contents: read`; `persist-credentials: false`; secrets only referenced by the preflight and deploy steps; `environment: production`; `concurrency: production-deploy-eurekacore-v3` with `cancel-in-progress: false` (a second push waits, and a running deploy is never cancelled); 20-minute timeouts; no `pull_request_target`. Run from a non-`main` branch via "Run workflow" and the `deploy` job is skipped. `tests/workflow.test.mjs` asserts all of this.

## GitHub setup (owner)
1. Repo → Settings → Secrets and variables → Actions → New repository secret (or, preferably, add them as *environment* secrets of `production`):
   - `CLOUDFLARE_API_TOKEN`: the scoped token below.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare dashboard → Workers & Pages → Account ID (a 32-character hex ID; it is an identifier, not a secret, but is stored as a secret here).
2. Settings → Environments → `production` (created automatically on first run): add **Required reviewers** (you) so every production deploy needs a click, and restrict *Deployment branches* to `main`.
3. Settings → Branches/Rulesets: protect `main` and require the `build` check.
Never paste token values into issues, PRs, logs or code. Rotate the token if it is ever exposed.

## Cloudflare API token (least privilege)
Dashboard → My Profile → API Tokens → Create Custom Token. Scope every permission to the single account and the single zone (`tinaneureka.com`); no "All accounts / All zones".
- Account → **Workers Scripts: Edit** (create and upload the Worker and its static assets).
- Zone → **Workers Routes: Edit** and Zone → **DNS: Edit** (a `custom_domain` route creates the DNS record and certificate), Zone → **Zone: Read**.
- Account → **Account Settings: Read** (Wrangler reads account details).
No KV, R2, D1, Access, billing or user permissions are needed for this deployment. These are the permissions Cloudflare documents for Workers custom domains, but they have **not been exercised by this repository**: if the first run reports a permission error, add only the named missing permission. When D1 is added later, applying migrations needs Account → **D1: Edit** (use a separate manual step, not this pipeline).

## How the first deployment creates `eurekacore-v3`
No pre-creation is needed. On the first run of `npm run deploy` Wrangler uploads the script and static assets under the name `eurekacore-v3` from `wrangler.toml`; if no Worker has that name, Cloudflare creates it in the account given by `CLOUDFLARE_ACCOUNT_ID`; if one exists, it is updated and receives a new version. Because `routes` has `{ pattern = "www.tinaneureka.com", custom_domain = true }`, the same deploy attaches the custom domain, creating the DNS record and certificate, **provided** the `tinaneureka.com` zone is on this Cloudflare account and no conflicting `www` DNS record exists (otherwise the deploy fails and changes nothing about the existing record; resolve it manually). `workers_dev = false`, so no `workers.dev` URL is created.

## What the first deployment will not do
- It binds no D1 database (`wrangler.toml` has no `[[d1_databases]]`), applies no migrations, creates no Access application and sets no Worker secrets or variables. Until those exist, `/api/*` answers with a fail-closed 503 JSON error and the site is public-frontend only.
- It does not create the apex redirect.

## Remaining blockers
1. Create and store the two GitHub secrets (and the Cloudflare token) as above.
2. Confirm in Cloudflare that `tinaneureka.com` is on this account and no conflicting `www` record exists.
3. The Cloudflare dashboard Git project `eurekacore` (Workers Builds) is a separate integration. Disconnect or repoint it so only one system deploys; otherwise it keeps failing on the name mismatch.
4. D1: owner supplies the real `database_id` (PR to add the binding), then approves remote migrations 0001 and 0002.
5. Access application, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `EUREKA_*` lists and optional integration secrets (see `PRODUCTION_DEPLOYMENT_CHECKLIST.md`). Runtime variables set in the dashboard are kept across deploys only if `wrangler.toml` does not override them; note `wrangler deploy` can overwrite dashboard-set plain variables that are declared in `wrangler.toml`, and secrets are unaffected.
6. 14 accepted high dependency findings (`docs/DEPENDENCY_AUDIT.md`).
7. Unverified here: Cloudflare account state, token permissions, branch protection, a live deploy.

## Rollback
Cloudflare → Worker `eurekacore-v3` → Deployments → roll back, or revert on `main` and let the pipeline redeploy.
