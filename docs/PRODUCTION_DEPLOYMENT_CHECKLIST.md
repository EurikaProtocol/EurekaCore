> Deployment path: **GitHub Actions** (environment `Eureka`, `npm run deploy`). See `GITHUB_ACTIONS_DEPLOYMENT.md` and `CLOUDFLARE_ACCOUNT_AUDIT.md`. The dashboard Git-build rows below apply only if the owner chooses that path instead; do not run both.

# Production Deployment Checklist: Worker `eurekacore-v3` / `www.tinaneureka.com`

Every box is an owner-approved action. Nothing here was executed by the preparation work. Config source: `wrangler.toml` only. See `EUREKACORE_PRODUCTION_LAUNCH_PLAN.md` for evidence and risks.

## 0. Status (2026-11-04)
- DONE: PRs #31, #30, #29 merged into the stack, then #28 merged into `main` (`4cdeaa60`). `npm ci`, `npm test` and the dependency audit pass on `main` (baseline refreshed to the 14 current findings with written justification in `docs/DEPENDENCY_AUDIT.md`).
- Decision recorded: the production Worker is **`eurekacore-v3`**; the legacy Git-connected `eurekacore` project is not reused.
- Nothing is deployed: the GitHub Actions deploy step stopped at "Check Cloudflare credentials" because `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are not set as repository secrets. The `Workers Builds: eurekacore` check fails, as expected for the name mismatch; it does not deploy.
- OWNER-ONLY, still open: sections 2 to 8 below (no Cloudflare credentials are available to the agent).

## 2. Cloudflare configuration (dashboard values; do not assume they already match)
| Setting | Value |
|---|---|
| Repository | `EurikaProtocol/EurekaCore` |
| Production branch | `main` |
| Worker / project name | `eurekacore-v3` (must equal `name` in `wrangler.toml`) |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` (= `wrangler deploy --config wrangler.toml`) |
| Node | 22 (`NODE_VERSION=22`) |
| Entry point | `cloudflare/worker.js` (from `wrangler.toml`) |
| Assets | binding `ASSETS`, dir `./dist`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*"]` |
| Compatibility date | `2026-09-17` |
| Custom domain | `www.tinaneureka.com`, created by deploy from `routes` |
| Build variables | public `VITE_*` only: `VITE_RPC_URL`, `VITE_EXPLORER_URL`, `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_TINAN_TOKEN_ADDRESS`, `VITE_TINAN_TOKEN_CHAIN_ID`, `VITE_SOLANA_NETWORK`, `VITE_SOLANA_RPC_URL`, `VITE_TINANAI_METADATA_URI`, `VITE_TINANAI_SOLANA_MINT`, `VITE_PUMPFUN_TOKEN_URL` (all optional; values are public) |
- [ ] Do not create a second production Worker. No dashboard deploy command may be a bare `wrangler deploy` or `wrangler versions upload`.

## 3. D1 (required for `/api/*`)
- Binding name `DB` (the Worker reads `env.DB`). Migrations: `migrations/0001_core_state.sql` (tables `agent_tasks`, `approval_nonces`), `migrations/0002_workflows_audit.sql` (tables `workflows`, `audit_log`). Apply in order; both use `CREATE ... IF NOT EXISTS` (re-runnable, never drop or alter).
- `wrangler.toml` has **no** `[[d1_databases]]` block: a real `database_id` is required and must not be invented.
- [ ] Owner checks the account: `npx wrangler d1 list`. **If a database already exists, do not create a replacement.** Inspect read-only first: `npx wrangler d1 execute <name> --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`. If tables named `agent_tasks`, `approval_nonces`, `workflows` or `audit_log` already exist with a different schema, `IF NOT EXISTS` would silently skip them: stop and review.
- [ ] Only if no suitable database exists and the owner approves: `npx wrangler d1 create eurekacore`.
- [ ] PR: add to `wrangler.toml`
  ```toml
  [[d1_databases]]
  binding = "DB"
  database_name = "<name>"
  database_id = "<real id from the owner>"
  migrations_dir = "migrations"
  ```
- [ ] With approval: `npx wrangler d1 migrations apply DB --remote --config wrangler.toml` (lists pending migrations and asks for confirmation).
- Without D1, `/api/*` answers a fail-closed 503 JSON; the public site still works. Do not call the application fully operational in that state.

## 4. Cloudflare Access
- [ ] Zero Trust → Access → Applications → self-hosted application covering `www.tinaneureka.com/api/*` (and `/control-center`, if the page itself should be private). Leave `/`, `/pages/*`, `/whitepaper/*` and the SPA public routes outside Access.
- [ ] Note the team domain (`<team>.cloudflareaccess.com`) and the application **AUD** tag.
- [ ] Set Worker variables `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`. The Worker verifies the Access JWT itself; Access in front of it is defence in depth, not a replacement.
- [ ] Role lists: `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, `EUREKA_APPROVERS` (lists of Access emails that map to roles in `src/server/auth.ts`; an identity in none of them gets 403; confirm the separator format there). At least one approver is needed to approve gates.
- Caution: an Access policy on `/api/*` returns Access's own login redirect (HTML) to unauthenticated browsers *before* the Worker. That is expected, and is not an `index.html` fall-through.

## 5. Secrets and variables (names only; set via dashboard or `wrangler secret put <NAME> --config wrangler.toml`; never in the repo)
Referenced by the current Worker code:
- Auth: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, `EUREKA_APPROVERS`.
- GitHub (optional): `GITHUB_TOKEN` (fine-grained, least privilege: contents + pull requests on the allowed repos, no merge), `GITHUB_ALLOWED_REPOS`.
- Sandbox (optional): `SANDBOX_URL`, `SANDBOX_TOKEN` (needs the Docker runner `scripts/sandbox-service.mjs` hosted separately).
- TinanAI (optional): `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD`.
- GitHub Actions secrets (only if the Actions deploy is used): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
No other secret names are read by the Worker.

## 6. Pre-deploy gates (re-run on the merged `main`, Node 22 / npm 10)
- [ ] `npm ci` · `npm run build` · `npm test` · `npm run verify` · `npx wrangler deploy --dry-run --config wrangler.toml` (expect Worker `eurekacore-v3`, `worker.js`, `env.ASSETS`).
- [ ] `find public dist -name _redirects` prints nothing.
- A dry run is not proof of a live deployment.

## 7. Deploy (needs your explicit "deploy" approval)
- [ ] Owner runs `npm run deploy` (or lets the approved Git build run it). Expect the custom domain `www.tinaneureka.com` to be created. A conflicting existing `www` DNS record makes it fail: do not delete it automatically; the owner decides.
- [ ] Verify Worker status (Workers & Pages → `eurekacore-v3` → Deployments), the Domains & Routes tab (Active), and SSL/TLS (Edge Certificates active; mode Full (strict) recommended).
- [ ] Run `PRODUCTION_SMOKE_TEST.md`.

## 8. After the site is verified
- [ ] Apex redirect (only then): Rules → Redirect Rules: if hostname equals `tinaneureka.com` → dynamic redirect `concat("https://www.tinaneureka.com", http.request.uri.path)` with query preserved, status **301**. The apex needs a proxied DNS record (`A 192.0.2.1` or an existing proxied record). Do not overwrite existing records.
- [ ] Re-run the smoke test for `https://tinaneureka.com/`.

## 9. Rollback
Worker → Deployments → roll back to the previous version; or detach the custom domain; or revert on `main`.

## Hardening addendum
- Run the schema check (`/api/integrations` → `database: healthy`) after applying migrations; see `MIGRATIONS_AND_RECOVERY.md`.
- Write requests are limited to 30 per minute per verified identity per Worker isolate (best effort, returns 429). Add a Cloudflare rate-limiting rule on `/api/*` for edge-wide enforcement.
- Workflow creation is idempotent by id (duplicate ids are rejected); approvals are single-use via the durable nonce guard; every state change is written to the hash-chained audit log.
