# EurekaCore Production Launch Plan

Target: Worker **`eurekacore-v3`** serving **`www.tinaneureka.com`**, configured only by `wrangler.toml`. Owner decision: the domain currently has no functioning Worker (blank site); no legacy Worker is preserved. This document is a plan. Nothing was deployed, no domain attached, and DNS, Access, D1 and secrets were not touched.

## 1. Verification results (repo, read-only)

| Check | Result |
|---|---|
| PR ancestry | #28 (`fix/redirect-loop-main`) → base `main`; #29 (`fix/cloudflare-worker-config`) → base #28; #30 (`chore/single-wrangler-config`) → base #29. `main` ⊂ #28 ⊂ #29 ⊂ #30 confirmed with `git merge-base --is-ancestor`. All three are open drafts. |
| Single config | Only `wrangler.toml` exists (plus `wrangler.test.toml`, a local-only test config with a placeholder D1 id, never deployed). `wrangler.jsonc` is deleted in #30 and a test fails if it returns. |
| Worker config | `name = "eurekacore-v3"`, `main = "./cloudflare/worker.js"`, `[assets] directory "./dist"`, `binding "ASSETS"`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*"]`, `workers_dev = false`. |
| Custom domain | `routes = [{ pattern = "www.tinaneureka.com", custom_domain = true }]`. Wrangler would create the domain binding and DNS record on deploy. |
| `npm run deploy` | `wrangler deploy --config wrangler.toml`; `deploy:check` is the same with `--dry-run`. CI uses `npm run deploy`. |
| Assets-only risk | None in the repo: no second config exists, so even a bare `wrangler deploy` resolves to `wrangler.toml`. The dry run emits `worker.js` and `env.ASSETS`, never `no-op-worker.js` (tested). |
| `_redirects` | None in `public/` or `dist/`; no file in `dist` has a `/* /index.html` rule (tested). |
| `/api/*` | `cloudflare/worker.js` calls `handleApi` before `env.ASSETS.fetch`, and `run_worker_first` sends `/api/*` to the Worker first. A Miniflare test shows `/api/*` gets a 401 JSON error from the Worker, never `index.html`. |
| Phase 2 intact | `git diff origin/main...#30` touches no file under `src/`, `cloudflare/`, `migrations/` or the sandbox/GitHub/approval code. Changed files: docs, tests, `package.json`/lock, `wrangler.toml`, `public/_redirects` (deleted), `wrangler.jsonc` (deleted). |

### Root domain `tinaneureka.com`
The repo only configures `www`. `index.html` canonical/OG URLs and `js/config.js` use `www.tinaneureka.com`, so **the apex should 301 to `https://www.tinaneureka.com`**. Nothing in the repo does this and it must not be a `_redirects` rule. Recommended (dashboard, not done): a Cloudflare Redirect Rule (Rules → Redirect Rules) for `tinaneureka.com/*` → `https://www.tinaneureka.com/${1}` (301), with a proxied (orange-cloud) apex DNS record. Do not use a Worker route on the apex unless you want a second binding.

### Dependency audit (separate from launch; nothing suppressed)
`node scripts/audit-check.mjs` fails with 16 high-severity packages reported as NEW. The baseline in `security/audit-baseline.json` is stale (it lists the old Tailwind/Solana/React Native chain, none of which is reported now), and the failure is identical on `main`. Current packages and fixes:
- Shipped to browsers (frontend): `@walletconnect/ethereum-provider` (direct), `@reown/appkit*`, `zod`, `abitype`, `@coinbase/cdp-sdk`, `follow-redirects`. Fix is a semver-major upgrade of the WalletConnect provider and needs a wallet regression check by the owner.
- Dev/test tooling only: `miniflare` (direct devDependency), `sharp`, `undici` (via miniflare), `vite` (launch-editor advisory, Windows dev server).
Recommendation: a dedicated PR to upgrade WalletConnect and Miniflare/Vite, then refresh the baseline. Do not add the new packages to the baseline without sign-off. **Effect:** while the audit step fails, GitHub Actions never reaches the deploy step, so the Actions path cannot launch the site. Launch by the dashboard Git integration or a manual `npm run deploy` (below), or after the audit PR.

## 2. Validation performed (Node 22.23.4 / npm 10.9.9, `node:22` container, clean copy)
- `npm ci`: exit 0.
- `npm run verify` (clean `dist`, build, routing 7/7, unit and integration tests, then dry run): exit 0. On the host earlier: 105 pass, 0 fail, 1 skipped (opt-in live GitHub test).
- `wrangler deploy --dry-run --config wrangler.toml`: Worker `eurekacore-v3`, `worker.js` + `env.ASSETS`, 72 assets, 108.80 KiB. 0 `_redirects` in `dist`.
- Not verified: anything live (Cloudflare account state, domain attachment, Access, remote D1, live TinanAi/GitHub/sandbox).

## 3. Launch steps (owner, in order)

**A. Merge (owner approval).** Merge #28 → `main`; retarget/merge #29, then #30 (or squash into one PR). Merging to `main` triggers Actions (build + tests; the audit step fails until section 1 is addressed, so the deploy step is skipped) and, if connected, a Cloudflare Git build.

**B. Cloudflare account/Worker.**
1. Workers & Pages → confirm no Worker named `eurekacore-v3` exists, or that you accept updating it. Check that `www.tinaneureka.com` is not attached to anything else (Worker → Settings → Domains & Routes; Websites → DNS). Remove any stale CNAME/A record for `www` first: Wrangler needs to create it and fails on a conflicting record.
2. Create the Worker by the first deploy (below), or Create application → Connect to Git.

**C. Build and deploy settings** (Git integration, Worker `eurekacore-v3`; the project name must equal the config `name`):
- Root directory: `/`; Production branch: `main`; non-production branch builds: preview only.
- Build command: `npm run build` (build variables: public `VITE_*` values only; they are compiled into the bundle).
- Deploy command: `npm run deploy` (= `wrangler deploy --config wrangler.toml`). Do not use a bare `wrangler deploy` or `versions upload`.
- Node 22 (`NODE_VERSION=22`).
- Alternative without Git integration: from a trusted machine, `npx wrangler login`, then `npm ci && npm run build && npm run deploy`. For GitHub Actions deploys add repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit; DNS Edit + Zone Read for the zone) and `CLOUDFLARE_ACCOUNT_ID`.

**D. Custom domain.** The first successful `npm run deploy` creates the `www.tinaneureka.com` custom domain from `wrangler.toml`. Confirm under Worker → Settings → Domains & Routes that it is Active with a certificate. Then add the apex redirect rule from section 1.

**E. D1 (needed for `/api/*`; the site itself works without it).**
1. `npx wrangler d1 create eurekacore` (name is your choice).
2. Owner adds `[[d1_databases]] binding = "DB"` with the real `database_id` and `migrations_dir = "migrations"` to `wrangler.toml` (small PR; the id must not be invented).
3. `npx wrangler d1 migrations apply DB --remote --config wrangler.toml` to apply `0001_core_state.sql` and `0002_workflows_audit.sql`.
Until then every `/api/*` request returns a fail-closed 503 (never `index.html`).

**F. Cloudflare Access (identity for `/api/*` and `/control-center` data).** Create a self-hosted Access application for `www.tinaneureka.com/api/*` (and optionally the `/control-center` path) with an allow policy for your identities. Leave the public pages outside Access. Copy the Application Audience (AUD) tag and the team domain. The Worker verifies the Access JWT itself and fails closed if either is missing.

**G. Worker variables and secrets** (names only; set with `wrangler secret put <NAME> --config wrangler.toml` or the dashboard):
- Required for API: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, `EUREKA_APPROVERS` (identity lists; at least one approver).
- Optional by feature: `GITHUB_TOKEN`, `GITHUB_ALLOWED_REPOS`; `SANDBOX_URL`, `SANDBOX_TOKEN` (requires you to host `scripts/sandbox-service.mjs` on Docker infrastructure: the Worker never runs generated code); `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD`.
- Treat the token variables as secrets, never `VITE_`.

**H. Smoke test after deploy (read-only).** `curl -I https://www.tinaneureka.com/` → 200 HTML; `/control-center` and `/pages/ecosystem.html` and `/eureka-legacy.html` → 200; an unknown path → 200 SPA shell; `curl -i https://www.tinaneureka.com/api/anything` → JSON 401/403/503, never HTML; no redirect loop.

**I. Rollback.** Worker → Deployments → roll back to the previous version, or detach the custom domain. Revert on `main` and redeploy.

## 4. Open risks
- Account state and domain ownership are unverified from the repo; step B must be checked by the owner.
- A leftover legacy Worker or DNS record on `www` can block the custom-domain creation.
- A failing audit gate blocks the Actions deploy path, not the dashboard path. Do not bypass it permanently.
- `compatibility_date = "2026-09-17"` must be supported by the Workers runtime at deploy time (the dry run does not check this).
- `/api/*` is inert until steps E to G are done; `/control-center` shows API errors rather than data until then.
