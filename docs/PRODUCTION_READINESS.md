# Production readiness

**Snapshot:** `main` SHA `d87dfe022bf39b20041154b2bf1674a9321cf7d6`, 2026-11-04. Repository checks and GitHub observations below are evidence; account-side and live-domain state are not inferred.

| Area | Status | Evidence / remaining work |
|---|---|---|
| Repository inventory and architecture | VERIFIED | 247 tracked files inventoried; actual frontend, Worker/API, core, integration, and migration boundaries documented in `REPOSITORY_AUDIT.md` and `ARCHITECTURE.md`. |
| Safe cleanup | VERIFIED | Confirmed oversized API body handling issue fixed. No files or dependencies deleted because no candidate was proven safe to remove without owner review. |
| Local tests and build | VERIFIED | `npm ci`, `npm run verify`, and `npm run build` executed. 114 passed, 5 skipped, 0 failed; see below. |
| Dependency security | BLOCKED | npm reported 26 vulnerabilities: 12 moderate and 14 high. Existing CI audit gate accepts the currently baselined high packages; this is not a vulnerability-free dependency tree. |
| Worker deployment | BLOCKED | Run `41892935402` succeeded, then later run `41893541626` failed with Cloudflare errors 10000/9109. No post-replacement credential run was available; no deployment was triggered. |
| Worker config | VERIFIED | Repository targets `eurekacore-v3` with `ASSETS` from `dist/`, API-first routing, and custom domain `www.tinaneureka.com`. Live account configuration is separate and unverified. |
| D1 | REQUIRES APPROVAL | No `DB` binding/database ID is configured. Existing database inventory and remote migration status are unknown; inspect read-only and obtain approval before binding/applying migrations. |
| Cloudflare Access | REQUIRES APPROVAL | Actual `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, application coverage, and allowlists were not available. Obtain real values from the account owner; do not use guessed values. |
| Domain, DNS, TLS, redirects | BLOCKED | `https://www.tinaneureka.com/` failed with `ERR_NAME_NOT_RESOLVED` in the available browser environment. Live DNS, TLS, Worker route, and application/API behavior are unverified. |
| Git/PR state | VERIFIED | Work began from a branch equal to current `main` SHA. PRs #32–#34 are merged; #10 and #11 are closed unmerged. Branch refs were inspected but not deleted. |
| Production release | NOT DEPLOYED | This audit did not initiate a deployment, apply migrations, change Access, or modify DNS. Follow `PRODUCTION_DEPLOYMENT.md` only after explicit owner approval of production actions. |

## Local validation detail

- `npm ci`: completed (866 packages installed). npm reported 26 advisories (12 moderate, 14 high).
- `npm run verify`: completed, including production build, routing/unit/integration tests, and `wrangler deploy --dry-run --config wrangler.toml`.
- Test summary: 119 total, 114 passed, 5 skipped, 0 failed. Docker-dependent worker integration scenarios are skipped when the `node:22-alpine` Docker image is unavailable.
- `npm run build`: completed. Vite warns that the classic `<script src="script.js">` in `eureka-legacy.html` cannot be bundled without `type="module"`; it remains a static runtime asset.
- The CI `node scripts/audit-check.mjs` is a separate workflow step; its latest observed successful run was in workflow `41892935402`. Its allowlisted advisory baseline is not equivalent to a clean npm audit.

## Release exit criteria

1. Confirm the current `Eureka` environment token/account secrets with the owner and obtain a successful reviewed deploy run; never print values.
2. Confirm the actual Worker and custom-domain configuration without disconnecting the legacy deployment path prematurely.
3. Locate and inspect an existing D1 database read-only, approve its ID/schema, configure `DB`, and approve remote migrations.
4. Configure Cloudflare Access using the actual team domain/AUD and intended role allowlists; test protected routes remain closed when misconfigured.
5. Restore/verify DNS resolution, active TLS, HTTPS/redirect behavior, public frontend routes, and protected API smoke tests from an authorized network.
6. Reassess accepted dependency advisories and legacy CDN/placeholder limitations with regression tests before claiming security readiness.
