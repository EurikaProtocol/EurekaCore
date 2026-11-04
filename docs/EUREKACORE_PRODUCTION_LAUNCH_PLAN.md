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

### PR readiness and CI (checked 2026-11-04)
| PR | Base | State | Checks |
|---|---|---|---|
| #28 | `main` | open draft, mergeable | GitHub `build`: **fail** at the dependency-audit step only (`npm ci` and `npm test` pass); `Workers Builds: eurekacore`: pass |
| #29 | #28's branch | open draft, mergeable, clean | `Workers Builds: eurekacore`: pass (no GitHub Actions run: the workflow only triggers on PRs to `main`) |
| #30 | #29's branch | open draft, mergeable | `Workers Builds: eurekacore`: **fail** (log not readable from here) |
| #31 | #30's branch | open draft | dependency fix, see below |

- Branch protection and required reviews could not be read (the token gets HTTP 403 on the protection API): **unverified**. Check Settings → Branches/Rulesets.
- **Worker identity finding:** the Workers Builds integration is a Worker project named `eurekacore` in the account (its build links point at `.../services/view/eurekacore/...`). A project called `eurekacore` therefore exists, contrary to the assumption of no legacy Worker. The #30 failure is consistent with the expected name mismatch (`wrangler.toml` says `eurekacore-v3`), but the build log is dashboard-only, so the cause is unconfirmed. Do not merge #30 until the owner has read that log or decided how `eurekacore` and `eurekacore-v3` relate (see section 3B).
- Merging to `main` can trigger (a) GitHub Actions: tests, audit gate (currently failing), then deploy `npm run deploy` only if the audit passes and `CLOUDFLARE_*` secrets exist; (b) the Cloudflare `eurekacore` Git build: whatever its dashboard deploy command is.

### Dependency audit (separate from launch; nothing suppressed, baseline NOT refreshed)
`node scripts/audit-check.mjs` reports 16 high packages as new because `security/audit-baseline.json` still lists the old Tailwind/Solana/React Native chain. Same on `main`. Draft PR #31 applies the non-breaking `npm audit fix` (vite, follow-redirects: 16 → 14 high); `npm ci` and `npm run verify` pass in Node 22 / npm 10. Every remaining finding:

| Package | Direct? | Exposure | Advisory | Fix / risk |
|---|---|---|---|---|
| `@walletconnect/ethereum-provider` | direct (`^2.25.0`) | **production bundle** (wallet connect) | flagged via the Reown AppKit chain (`range >=2.20.0`) | `npm audit` only proposes **2.19.4 (a downgrade)**, which is not a real fix. Needs an upstream release. |
| `@reown/appkit`, `-controllers`, `-pay`, `-scaffold-ui`, `-ui`, `-utils`, `-wallet` | transitive | production bundle | all inherited from `zod` (below) | resolved only by an upstream bump of the Reown packages |
| `zod` | transitive | production bundle | GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized constrained collections (`<4.6.6`) | needs Reown/cdp-sdk to depend on zod ≥ 4.6.6. Mitigating: zod validates app-side inputs, not Worker input |
| `abitype`, `@coinbase/cdp-sdk` | transitive | production bundle | via `zod` | same |
| `miniflare` | direct devDependency | **tests only**, not shipped | via `sharp`, `undici` | `^4.20260730.0`; audit proposes an old 2025 version (downgrade). Upgrade when Miniflare ships undici ≥ 7.30.1 |
| `sharp` | transitive (miniflare) | tests only | GHSA-rgj7-g3m4-5g8c (libheif), GHSA-wq5f-xc86-pv6w (librsvg), image decoding | not used by the Worker or the build |
| `undici` | transitive (miniflare) | tests only | ~25 advisories (GHSA-8xcm-r25x-g524 and others: desync, DoS, cookie disclosure), fixed in 7.30.1 | only the local test harness uses it; the production Worker runs on workerd, not this undici |
| `vite`, `follow-redirects` | direct / transitive | build tooling / production-bundle transitive | launch-editor, dev-server file exposure; follow-redirects credential stripping | **fixed by PR #31** |

Risk judgement: the production frontend still ships WalletConnect/Reown. The zod DoS and similar advisories are client-side and need a wallet-stack upgrade that has to be tested by the owner. They should not be hidden. Options: (1) launch with these documented findings after the owner accepts them explicitly and updates the baseline to the *current* 14 names in a reviewed PR; (2) wait for upstream fixes. This plan does not change the baseline. Until one of those happens, the GitHub Actions deploy path stays blocked by design; use the dashboard Git build or `npm run deploy` by the owner.

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
