# EurekaCore repository audit

**Snapshot:** `main` at `d87dfe022bf39b20041154b2bf1674a9321cf7d6` (2026-11-04). The task checkout is the same commit on `copilot/master-repository-cleanup`. This is a source and configuration audit; it is not a live Cloudflare account audit.

## Architecture today

- **Frontend:** Vite builds a React 19/TypeScript application from `index.html`; `src/App.tsx` defines the React Router routes and `src/pages/` and `src/components/` implement them.
- **Legacy web surface:** Vite also builds `eureka-legacy.html`. Static content under `public/` is copied into `dist/`; the legacy entry and static HTML pages remain part of the deployed surface.
- **Worker/API:** `cloudflare/worker.js` sends `/api/*` to `src/server/api.ts` before falling back to the `ASSETS` binding. `src/server/` owns Cloudflare Access JWT verification, role checks, D1 adapters, provider clients, and API orchestration.
- **Domain logic:** `src/core/` contains shared business rules and workflow/task state machines; `src/sdk/`, `src/solana/`, `src/lib/`, and `src/services/` contain blockchain and product integrations.
- **Persistence:** D1 adapters and migrations exist, but `wrangler.toml` deliberately has no D1 binding or production database ID. The API therefore fails closed with 503 for persistent operations.
- **Deployment:** `.github/workflows/cloudflare-deploy.yml` verifies changes and deploys `eurekacore-v3` from `main`; `wrangler.toml` is the authoritative Worker configuration.

## Inventory

The `main` tree contains **247 tracked files**: 89 under `src/`, 50 under `public/`, 20 under `docs/`, 18 under `tests/`, 2 D1 migrations, 2 `.github/` files, and the remaining root, contract, script, and configuration files. `.github/agents/` was not inspected. The repository also contains a Solidity contract set, a legacy static site, generated/backup-looking material, npm configuration and lockfile, and deployment/test configurations.

Key areas inspected include `src/`, `public/`, `pages/`, `components/`, `js/`, `scripts/`, `migrations/`, `cloudflare/`, `.github/workflows/`, `tests/`, `docs/`, `package.json`, `package-lock.json`, `.env.example`, and the Wrangler/Vite/TypeScript configuration.

## Findings

| Area | Finding |
|---|---|
| Duplicate and legacy material | Root and `public/` contain overlapping legacy assets; `index (5).html` is an unreferenced 452 KB backup-like page and `EurekaTinanCore.git (1).zip` is a 13 MB repository archive. Existing audit notes describe both as retained backups. They were not deleted because historical intent and unique content are not established. |
| Legacy entry points | `eureka-legacy.html`, its wallet module, root `script.js`/`styles.css`, and public static pages are part of the build or linked compatibility surface. Their behavior should not be removed as apparent duplication. The build emits a warning because the classic `script.js` cannot be bundled; it remains a runtime public asset. |
| Dependencies | `npm ci` installs the committed lockfile. No dependency was proven unused, so none was removed. npm reported 26 advisories (12 moderate, 14 high); the CI audit gate passes because the high/critical package names are accepted in `security/audit-baseline.json`, not because all advisories are fixed. See `DEPENDENCY_AUDIT.md`. |
| API input handling | JSON writes previously buffered an unbounded request before checking the size and measured characters rather than bytes. The current task branch now rejects declared and streamed bodies over 16 KB and has a multibyte regression test. |
| Authentication | API calls require a valid Cloudflare Access JWT; roles are assigned from server-side email allowlists. Missing Access configuration is closed with 503. Writes require same-origin `Origin`; writes are rate-limited per Worker isolate. |
| Production persistence | No `DB` binding or database ID is configured. Local D1 integration tests apply both migrations, but the live database, migration status, and binding are unverified. |
| Product completeness | The repository explicitly marks some marketplace, project, energy-data, and signing experiences as local/demo or preview functionality. These are not evidence of shared production services. |
| Documentation | Several pre-existing audit documents describe earlier snapshots. `REPOSITORY_INVENTORY.md` is dated 2026-10-16 and `REPOSITORY_STATE_AUDIT.md` has an older base reference; treat their historical claims as such. `DEPENDENCY_AUDIT.md` labels its launch triage as superseding its earlier table. |
| Branches and PRs | GitHub reports PRs #32, #33, and #34 merged; #32 is not open. PRs #10 and #11 are closed without merge. Many historical branch refs remain, so none were deleted without verifying their unique commits and ownership. |

## Cleanup decisions

- No files or dependencies were deleted or moved: unreferenced does not by itself prove safe disposal, and backup/history intent is documented.
- No production configuration, migration, secret, domain, DNS, database, or legacy integration was changed.
- A confirmed unbounded-body-read issue was fixed in the protected API, with a regression test.
- See [`CLEANUP_CHANGELOG.md`](CLEANUP_CHANGELOG.md) for the itemized change record.

## Verification and release blockers

- The local verification command completed: 114 tests passed, 5 skipped, 0 failed; the Wrangler dry run and production build completed. The skipped tests and the legacy-script build warning are documented in `PRODUCTION_READINESS.md`.
- GitHub Actions run `41892935402` deployed the same `main` SHA successfully at 19:03 UTC on 2026-11-04. The later dispatch run `41893541626` failed in the deploy step with Cloudflare errors 10000 and 9109. The credential-presence preflight passed, so it did not establish that the token was valid or sufficiently permissioned. No new production deployment was initiated for this audit.
- `www.tinaneureka.com` did not resolve in the available browser environment. DNS, certificate, route, live frontend, and API behavior are therefore unverified.
- D1 binding/database discovery and migration application, Access team domain/AUD/role configuration, successful post-token-replacement deployment, and live domain smoke tests remain production blockers. No database or DNS changes were made.

For exact operator steps and the current release checklist, see [`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md) and [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md).
