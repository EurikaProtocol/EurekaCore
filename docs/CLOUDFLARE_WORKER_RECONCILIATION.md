# Cloudflare Worker Configuration Reconciliation

Branch: `fix/cloudflare-worker-config` (based on `fix/redirect-loop-main`, PR #28, so the `_redirects` fix is included).
Nothing here was deployed. No Worker was renamed. DNS, Access, D1, migrations and secrets are untouched.

## 1. Current configuration map

| | `wrangler.toml` | `wrangler.jsonc` |
|---|---|---|
| Worker name | `eurekacore-v3` | `eurekacore` (matches the Cloudflare build log) |
| `main` | `./cloudflare/worker.js` | was **missing**; now `./cloudflare/worker.js` |
| Assets dir / binding | `./dist` / `ASSETS` | was `./dist/`, no binding; now `./dist` / `ASSETS` |
| SPA fallback | `single-page-application` | same |
| `run_worker_first` | `["/api/*"]` (PR #28) | was missing; now `["/api/*"]` |
| Route | `www.tinaneureka.com` (custom domain) | none (intentionally unchanged) |
| Added by | original deploy setup | commit `537e9946` "Add wrangler.jsonc for Cloudflare Workers deployment" (dashboard-generated) |

Why both exist: `wrangler.jsonc` was added later (likely by the Cloudflare dashboard Git integration for a Worker called `eurekacore`). The repo's scripts and CI were written against `wrangler.toml`.

## 2. Deployment paths

| Path | Config used | Result |
|---|---|---|
| `npm run deploy` / `deploy:check` | `--config wrangler.toml` (pinned, tested) | `eurekacore-v3`, full Worker |
| GitHub Actions `cloudflare-deploy.yml` (push to `main`) | `npm run deploy` after the audit gate | `eurekacore-v3` |
| Cloudflare Workers Builds (Worker `eurekacore`) | **unknown, dashboard-only**; a bare `wrangler deploy` picks `wrangler.jsonc` | `eurekacore` |
| bare `npx wrangler deploy` | `wrangler.jsonc` | `eurekacore` |

## 3. Risks identified

1. **Assets-only Worker (fixed in repo).** Before this change, a bare `wrangler deploy` used `wrangler.jsonc`, which had no `main`. Wrangler generated `no-op-worker.js`, so `/api/*` would not exist and the SPA fallback would answer API paths with `index.html`. Now `wrangler.jsonc` has the same script, binding and `run_worker_first`, so it can no longer produce an assets-only Worker.
2. **Two Workers.** Pushing to `main` can deploy `eurekacore-v3` (Actions) and `eurekacore` (Workers Builds). Which one serves `www.tinaneureka.com` is not verifiable from the repo. Not changed.
3. **Config drift.** Mitigated by `tests/wrangler-config.test.mjs`.
4. The GitHub Actions audit step currently fails on a stale `security/audit-baseline.json` (pre-existing, also on `main`), so the Actions deploy is blocked anyway.
5. `/api/*` returns 503 until Access (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`), the D1 binding `DB` and secrets are configured. Neither config declares a D1 binding. The owner must supply it.

## 4. Recommendation

- `wrangler.toml` stays authoritative (route, custom domain, scripts, CI, docs).
- `wrangler.jsonc` is kept (not deleted) as a faithful mirror without routes, so Cloudflare's Git integration is safe whichever command it runs.
- Owner to decide: either point the dashboard at `npm run deploy`, or retire one of the two Workers. Do not rename until the live Worker is confirmed.

## 5. Files changed

- `wrangler.jsonc`: added `main`, `ASSETS` binding, `run_worker_first`, `workers_dev=false`; name and compatibility date unchanged.
- `tests/wrangler-config.test.mjs` (new, 6 tests): both configs define the script; asset settings agree; names pinned; scripts and CI pin `wrangler.toml`; real `wrangler deploy --dry-run` for explicit and default config resolves `worker.js` plus the `ASSETS` binding, never `no-op-worker.js`; `handleApi` precedes `ASSETS.fetch`.
- `README.md`: removed the stale claim that `public/_redirects` preserves SPA routes.
- This document.

## 6. Test results (local, Node 22 toolchain as installed)

- `npm run build`: ok. No `_redirects` in `public/` or `dist/`.
- `npm run verify` (build, routing 7/7, unit/integration 106 pass, 1 skipped opt-in live-GitHub test, 0 fail, then `deploy:check`): exit 0.
- `wrangler deploy --dry-run --config wrangler.toml`: reads 72 assets, binding `env.ASSETS`, entry `worker.js`, Worker `eurekacore-v3`.
- Default (no `--config`) dry-run: Worker `eurekacore`, entry `worker.js` (asserted by the new test).
- Not run: a clean `npm ci` under Node 22 on this branch (only `package-lock.json` unchanged from PR #28, which passed it in CI).
- Dry runs do not run Cloudflare's server-side validation or touch the live account.

## 7. Needs Cloudflare dashboard confirmation

- Workers Builds build and deploy commands for `eurekacore`.
- Which Worker (`eurekacore` or `eurekacore-v3`) has the `www.tinaneureka.com` custom domain, and whether `eurekacore-v3` exists.
- Production and preview branch settings, and build cache.
- D1 binding `DB`, Access application and AUD, and secrets on the live Worker.
