# Cloudflare account audit and owner actions (read-only)

**Status: PREPARED — READY FOR OWNER APPROVAL — NOT DEPLOYED.**

## Evidence limits (important)
The agent environment had **no Cloudflare credentials and no outbound network** (DNS and HTTPS lookups return nothing). Therefore the following were **NOT verified** and are not claimed: DNS records, existing custom domains/routes, whether Worker `eurekacore-v3` or `eurekacore` exists or what it serves, SSL/TLS mode, D1 databases and their schemas, Access applications, whether the GitHub secrets exist. Domain used throughout: `tinaneureka.com` / `www.tinaneureka.com` (not `tinaneeka.com`). Below are what the repository proves, and exact read-only commands for the owner to produce the missing facts.

## What GitHub shows (read-only API)
| Item | Finding |
|---|---|
| Environment `Eureka` | exists; deployment branches limited to `main`; **no required reviewers**; used by the workflow (exact name) |
| Environments `Production`, `Preview`, `copilot` | exist, unrelated, unused by the workflow |
| Secrets | not readable by the available token: **unverified** |
| Check `Workers Builds: eurekacore` | failing on `main` and PR branches; Build ID/log only in the Cloudflare dashboard |

## Legacy Cloudflare Git project `eurekacore` vs `eurekacore-v3`
- The Cloudflare Workers Builds integration is connected to this repo for a Worker/project named **`eurekacore`**; the intended Worker `eurekacore-v3` is deployed by GitHub Actions.
- Evidence for the failure cause: it passed while the repo had `wrangler.jsonc` (`name = "eurekacore"`) and started failing once `wrangler.toml` (`name = "eurekacore-v3"`) became the only config (PRs #29/#30 vs #28). Workers Builds requires the config `name` to match the project's Worker; the mismatch is the most likely cause. **The actual build log was not accessible, so this is an inference.**
- Two systems deploying the same repo to two Workers is the real risk. Do **not** rename `eurekacore-v3` to match.
- **Recommended action (needs owner approval, not done):** Cloudflare → Workers & Pages → `eurekacore` → Settings → Builds → *Disconnect* the Git repository (or disable build for all branches). Impact: stops the failing check and any automatic builds; it does **not** delete the `eurekacore` Worker, its versions, routes, domains or bindings. If `eurekacore` currently serves any traffic (unknown), that keeps serving the last deployed version. Do this only after confirming `eurekacore` is not meant to receive deployments.
- Alternative: leave it; the failing check is cosmetic unless made a required check.

## Repository vs account
| Setting | Repository (`wrangler.toml`, verified by tests/dry run) | Account |
|---|---|---|
| Worker name | `eurekacore-v3` | unverified: may not exist |
| Entry | `./cloudflare/worker.js` | n/a |
| Assets | `./dist`, binding `ASSETS`, SPA fallback, `run_worker_first = ["/api/*"]` | n/a |
| Route | `www.tinaneureka.com` custom domain | unverified |
| `workers_dev` | `false` | n/a |
The first `npm run deploy` creates the Worker if absent (see `GITHUB_ACTIONS_DEPLOYMENT.md`). The Worker does not exist until then, unless the owner finds it in the dashboard.

## DNS and domain: owner checks (read-only; change nothing)
Dashboard → `tinaneureka.com` → DNS → Records, and confirm:
1. Zone is on **this** account and active (nameservers).
2. `www`: any existing `A`, `AAAA` or `CNAME` record. **A conflicting record blocks the custom-domain creation**; the owner decides whether to remove it (deploy will not overwrite it).
3. Apex `@`: existing `A`/`AAAA`/`CNAME` (keep untouched; the apex 301 redirect is created later).
4. **Preserve:** `MX`, SPF (`TXT v=spf1`), DKIM (`*._domainkey`), DMARC (`_dmarc`), any Replit verification `TXT`/`CNAME` and unrelated records.
5. Workers & Pages → each Worker → Domains & Routes: is `www.tinaneureka.com` or `tinaneureka.com/*` already attached to any Worker (including `eurekacore`)? A domain attached elsewhere must be detached by the owner first.
6. SSL/TLS → Overview: mode (recommend Full (strict)); Edge Certificates active.
Optional CLI (needs an owner-held token, read-only scope): `curl -s -H "Authorization: Bearer $TOKEN" "https://api.cloudflare.com/client/v4/zones?name=tinaneureka.com"`, then `.../zones/<id>/dns_records` (never paste the token anywhere).

## D1: owner checks
1. `npx wrangler d1 list` (read-only). If a database exists, do **not** create another.
2. For each candidate: `npx wrangler d1 execute <db> --remote --command "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index')"`.
3. Safe to apply 0001/0002 when: no tables named `agent_tasks`, `approval_nonces`, `workflows`, `audit_log` exist, or they match `migrations/*.sql` exactly. Both migrations use `CREATE ... IF NOT EXISTS` and never drop or alter, so they cannot destroy data, but they would silently skip a same-named table with a different schema. If one differs, stop and report.
4. Then (after approval) a PR adds `[[d1_databases]] binding = "DB"` with the real `database_id`, and the owner runs `npx wrangler d1 migrations apply DB --remote --config wrangler.toml`. Not done by the agent.
Until then `/api/*` returns a fail-closed 503 (JSON, never HTML), by design.

## Access: owner checks
- Zero Trust → Access → Applications: is there an app covering `www.tinaneureka.com`? Missing items: self-hosted app for `www.tinaneureka.com/api/*` (+ optionally `/control-center`), its AUD tag, team domain.
- Worker variables needed: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, `EUREKA_APPROVERS`. Missing → API returns 401/403/503, never opens up. Public pages stay outside Access.

## Security review
- **Cloudflare token:** scoped to one account + the `tinaneureka.com` zone: Workers Scripts Edit, Account Settings Read, Workers Routes Edit, DNS Edit, Zone Read. No D1/Access/billing. Not tested against a real token.
- **GitHub secrets:** environment secrets on `Eureka` (main-only); the verify job and PRs get none; the workflow never echoes them; the preflight prints names only.
- **Worker secrets:** set separately in Cloudflare; never in the repo or `VITE_*`. The deploy does not touch them.
- **Public API exposure:** every `/api/*` request is authenticated first, fail-closed; writes require same-origin; verified by tests locally, not live.
- **Dependencies:** 14 high findings remain accepted with justification (`DEPENDENCY_AUDIT.md`). Not fixed; not hidden.
