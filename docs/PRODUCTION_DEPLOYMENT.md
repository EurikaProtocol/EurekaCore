# Production deployment and operator steps

**Target:** Worker `eurekacore-v3`, `https://www.tinaneureka.com`. **No deployment or account mutation was initiated by this audit.**

## Repository deployment configuration

- `.github/workflows/cloudflare-deploy.yml` runs `npm ci`, `npm run verify`, and the dependency audit on pull requests to `main`.
- Only a push to `main` or manual dispatch on `main` reaches the deploy job, after verification. The job uses GitHub Environment `Eureka` and secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- `wrangler.toml` is the sole production Worker configuration: `name = "eurekacore-v3"`, entry `cloudflare/worker.js`, `ASSETS` from `dist/`, SPA fallback, worker-first `/api/*`, and custom domain `www.tinaneureka.com`.
- The deploy credential preflight checks presence only. It does not validate Cloudflare token identity or permissions.

## Deployment evidence

- Run [41892935402](https://github.com/EurikaProtocol/EurekaCore/actions/runs/41892935402) on `main` SHA `d87dfe022bf39b20041154b2bf1674a9321cf7d6` completed its deployment job successfully at 19:03 UTC on 2026-11-04.
- Later run [41893541626](https://github.com/EurikaProtocol/EurekaCore/actions/runs/41893541626) verified and built the same SHA, passed the presence-only credential check, then failed at `wrangler deploy` with `Authentication error [code: 10000]` and `Invalid access token [code: 9109]`.
- These runs do not establish that a token replaced after the failed run works. No later deployment run was available during this audit. A new run was not triggered because it would perform a production deployment.

## Required owner actions

1. In GitHub → Settings → Environments → `Eureka`, confirm the environment is restricted to `main`, and update the token/account secrets through the trusted GitHub interface. Never paste or print their values. Use a Cloudflare token limited to the required account/Worker operations; verify account and Worker permissions with the account owner.
2. Confirm any legacy Cloudflare Git build integration and existing Worker/domain ownership in the Cloudflare dashboard. Do not disconnect the legacy integration until the new Worker is successfully deployed, tested, and confirmed operational.
3. Before any production run, review the exact commit and approve the deploy. A successful `npm run deploy` is not a substitute for application smoke tests.
4. Configure and verify Cloudflare Access for `www.tinaneureka.com/api/*` (and `/control-center` only if that page itself must be private). Obtain the actual team domain and application AUD from Cloudflare; do not guess them. Set the Worker variables `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and the server-side role allowlists.
5. Discover existing D1 databases read-only with `npx wrangler d1 list`. Do not create a replacement. If a candidate exists, inspect its table schema before proposing a binding or migration.
6. Configure a reviewed D1 binding named `DB` using the existing database's actual ID. The ID and remote migration state are not available in this repository. Only after explicit database approval, apply the existing migrations with `npx wrangler d1 migrations apply DB --remote --config wrangler.toml`.
7. Verify the Worker custom domain, DNS, TLS/SSL, and routing in Cloudflare. Do not overwrite or delete DNS records as part of this procedure.
8. Run the read-only checks in `PRODUCTION_SMOKE_TEST.md`; record actual results for the homepage, SPA routes, legacy pages, HTTPS redirects, security headers, and protected JSON API.

## Database notes

The required application binding name is `DB`. The Worker config presently has no D1 database name or ID, and the API reports persistence unavailable rather than using an in-memory production fallback. The migrations are `0001_core_state.sql` followed by `0002_workflows_audit.sql`; both use `IF NOT EXISTS`. That is idempotent for a fresh schema but does not repair a same-named table with an incompatible schema. Inspect first, preserve data, and stop on schema mismatch.

## Domain verification limitation

The available browser environment returned `ERR_NAME_NOT_RESOLVED` for `www.tinaneureka.com`. DNS records, certificate state, custom-domain attachment, redirects, and live application/API responses are therefore unverified. No DNS or Cloudflare setting was modified.
