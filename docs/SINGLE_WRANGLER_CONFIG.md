# Single Wrangler Configuration

`wrangler.toml` is the only Wrangler deploy configuration. Branch `chore/single-wrangler-config` (stacked on PR #29, which is stacked on PR #28). Nothing was deployed; DNS, Worker names, routes, Access, D1, migrations and secrets are untouched.

## Why wrangler.toml
It already carried everything production needs: `main = "./cloudflare/worker.js"`, the `ASSETS` binding (`./dist`), `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*"]`, the `www.tinaneureka.com` custom domain, and `workers_dev = false`. Every npm script, the CI workflow and the docs already used it. `wrangler.jsonc` was a dashboard-generated, assets-only file. There is no D1 binding in the deploy config (deliberate: the real `database_id` must come from the owner, see `docs/PERSISTENCE.md`); the compatibility date is unchanged.

## What was deleted / changed
- Deleted `wrangler.jsonc` (Worker `eurekacore`).
- Deleted `docs/CLOUDFLARE_WORKER_RECONCILIATION.md` (PR #29): it described the mirrored jsonc, now obsolete.
- Rewrote `tests/wrangler-config.test.mjs` (5 tests, see below).
- Updated references in `README.md`, `wrangler.toml` comment, `docs/CORE_ARCHITECTURE.md`, `docs/REPOSITORY_STATE_AUDIT.md`, `.github/agents/my-agent.agent.md`.
- Kept `wrangler.test.toml`: local-only test config (`eurekacore-test`, placeholder D1 id) used by the D1 migration test harness; it is never deployed.

## Deployment paths (all use `--config wrangler.toml`)
- `npm run deploy` = `wrangler deploy --config wrangler.toml`
- `npm run deploy:check` = `wrangler deploy --dry-run --config wrangler.toml --outdir .wrangler/dry-run`
- GitHub Actions `cloudflare-deploy.yml` (push to `main`, after tests and the audit gate) runs `npm run deploy`.
- Cloudflare dashboard Git integration: **set manually**: build `npm run build`, deploy `npm run deploy`. Deleting the file does not change dashboard settings. With the file gone, even a bare `wrangler deploy` resolves to `wrangler.toml` (full Worker), but see the identity risk below.

## Worker identity risks (unresolved, not verifiable from the repo)
- `wrangler.toml` names the Worker `eurekacore-v3`; the Cloudflare build log named `eurekacore`. Which exists, and which owns `www.tinaneureka.com`, is unknown (no dashboard access).
- **Workers Builds typically requires the configured Worker name to match the `name` in the config.** If the dashboard project is `eurekacore`, builds may now fail or warn on the name mismatch (previously jsonc matched). That is a safe failure, but it needs an owner decision: either rename the dashboard project/Worker target, or approve changing `name` in `wrangler.toml` to the confirmed live name. This PR deliberately does not.
- If both `eurekacore` and `eurekacore-v3` exist, Actions would publish `eurekacore-v3` while `eurekacore` stays stale.
- Actions deploy is currently blocked anyway by the stale `security/audit-baseline.json` (pre-existing).

## Tests (local)
- Node 22.23.4 / npm 10.9.9 (docker `node:22`): `npm ci` exit 0, `npm run build` ok, 0 `_redirects` in `dist`.
- Local host (Node 26 / npm 11): `npm run verify` exit 0: routing 7/7 pass, 105 pass, 0 fail, 1 skipped (opt-in live GitHub test), then dry run reads 72 assets, binding `env.ASSETS`.
- New tests assert: no `wrangler.jsonc`/`wrangler.json`; toml has main, ASSETS, SPA fallback, `run_worker_first`, route; no script or workflow references jsonc or an un-pinned `wrangler deploy`; both `--config wrangler.toml` and bare dry runs yield `worker.js` + `ASSETS`, never `no-op-worker.js`; `handleApi` precedes `ASSETS.fetch`. The existing Miniflare routing test proves `/api/*` is answered by the Worker (401 JSON) and not by `index.html`.
- Not verified: live Cloudflare behaviour, server-side `_redirects` validation, remote D1.

## Remaining dashboard actions
1. Confirm which Worker (`eurekacore` / `eurekacore-v3`) exists and owns `www.tinaneureka.com`.
2. Set build `npm run build` and deploy `npm run deploy`; confirm production/preview branches and clear the build cache.
3. Resolve the Worker-name decision above before merging.
4. Provide the D1 binding, Access (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`) and secrets.
