# Deployment readiness report (PR #33 + #34)

Status: **PREPARED — NOT DEPLOYED**. Nothing here was run against Cloudflare production.

## PR relationship and CI
- #34 is a draft with base `feature/github-actions-cloudflare-deploy` (#33), which targets `main`. Keep it that way until both are ready.
- The workflow triggers `pull_request` only for base `main`, so #34 (stacked) shows **no GitHub checks**. It is not a failure. Checks run once #34 is retargeted to `main` after #33 merges (or on #33 itself). Local equivalent below.

## Verified (node:22 / npm 10, local)
- `npm ci`, `npm run verify`: exit 0; 113 pass, 5 skipped (4 Docker-sandbox tests, 1 opt-in live GitHub), 0 fail.
- `node scripts/audit-check.mjs`: 26 advisories (14 high, 12 moderate, 0 critical); 14 high accepted, **0 new**.
- Dry run `wrangler deploy --dry-run --config wrangler.toml`: Worker `eurekacore-v3`, `env.ASSETS`, 72 assets.
- `schema.ts` queries (`pragma_table_info`, `pragma_index_list`) ran on the workerd D1 simulator (Miniflare) and return name/type/notnull/pk/index names as expected. This is the simulator, **not remote D1**; D1 documents these PRAGMAs as supported but remote use is unverified.
- Schema check is read-only (SELECT on pragma functions only); tests in `tests/schema.test.mjs` cover missing table, different same-named table, missing index, relaxed NOT NULL, unexpected column. Limitation: it does not compare the `CHECK` constraint on `agent_tasks.status` or index columns/uniqueness.
- Access JWT (RS256 pinned, JWKS+rotation, iss, aud, exp, nbf), roles from server allowlists, nonce replay guard, audit hash chain: covered by existing tests (`worker.integration`, `persistence`, `core`).

## Rate limiter review
- Memory: in-isolate Map keyed by verified email; pruned only when >1000 keys and fully expired entries exist, so growth is bounded by distinct Access-authenticated users within a minute window.
- Isolation: keyed by verified identity from the JWT, never headers; one user cannot exhaust another's budget.
- Limitation: per-isolate, reset on restart, not shared across isolates/locations, so effective limit is higher than 30/min. Counts happen before role check (denied writes also count). Reads are unlimited. It is a safety net, not a security boundary.
- Edge-wide (owner approval needed; nothing created): Cloudflare dashboard → Security → WAF → Rate limiting rules; expression `starts_with(http.request.uri.path, "/api/") and http.request.method eq "POST"`, characteristic IP (or Access identity on plans that allow), e.g. 30 requests / 1 min, action Block 60 s. Alternatively the Workers Rate Limiting binding.

## Persistence inventory
- D1 (when `DB` is bound and migrated): tasks (`agent_tasks`), approval nonces, workflows with stage outputs/approvals, audit log.
- In memory only: JWKS cache, rate-limit counters, `ProductRegistry` (code-defined), integration status (probed live per request).
- Browser: UI state only; no authority or secrets (verify against `src/` before launch if the UI changes).
- **Not durable: idempotency records and integration configuration.** Integration config comes from Worker secrets/vars (correct place for secrets); it needs no table unless non-secret, user-editable settings are added. Workflow create is naturally idempotent by id (duplicate rejected). Other mutating POSTs (advance/retry/cancel) are guarded by version compare-and-set, not request keys.
- Proposed (NOT created): `0003_idempotency_keys.sql`: `idempotency_keys(key TEXT PRIMARY KEY, actor TEXT NOT NULL, route TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)` + index on `expires_at`; reuse with a different hash → 422. Optional `0004_integration_settings.sql` only for non-secret settings. Both must be additive and applied after 0001/0002.

## Migration doc check
`docs/MIGRATIONS_AND_RECOVERY.md` matches `migrations/0001`, `0002` (tables, indexes, `IF NOT EXISTS`) and uses real commands (`wrangler d1 export/migrations list/apply/execute/time-travel`). Commands have not been executed remotely.

## Accepted high findings (14), unchanged
WalletConnect/Reown/abitype/zod/@coinbase/cdp-sdk (browser bundle, no non-breaking fix; npm's suggested fix is a downgrade) and miniflare/sharp/undici (test tooling only). Baseline untouched; see `docs/DEPENDENCY_AUDIT.md`. Not fixed.

## Unverified infrastructure
D1 inventory and `database_id`; remote schema; Access app/AUD/team domain; GitHub `Eureka` environment secrets; Cloudflare token scope; whether `eurekacore-v3` exists; DNS/SSL for tinaneureka.com; legacy `eurekacore` Git integration failure cause (inferred).

## Owner actions
1. Supply D1 inventory/`database_id`; back up; approve remote migrations.
2. Configure Access and the three role variables.
3. Add `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` to `Eureka`.
4. Decide on legacy integration; approve edge rate-limit rule.
5. Approve merge of #33 then #34, then deploy.
