# Production Smoke Test: `https://www.tinaneureka.com`

**Status: NOT RUN.** The Worker has not been deployed. The "Result" column must be filled in by whoever runs it after an approved deployment. Do not record a result that was not observed.

All commands are read-only (`GET`/`HEAD`). Replace nothing else; no credentials are needed for the unauthenticated checks.

| # | Request | Expected | Result |
|---|---|---|---|
| 1 | `curl -sI https://www.tinaneureka.com/` | 200, `content-type: text/html`, security headers present | |
| 2 | `curl -sI https://www.tinaneureka.com/ai` | 200 HTML (SPA shell) | |
| 3 | `.../projects`, `.../tokens`, `.../contracts` | 200 HTML each (SPA routes) | |
| 4 | `.../control-center` | 200 HTML shell. If Access covers it, an Access login redirect instead (record which). No private data in the HTML | |
| 5 | `.../pages/ecosystem.html`, `.../pages/token.html`, `.../whitepaper/`, `.../eureka-legacy.html` | 200 | |
| 6 | `.../some/unknown/route` | 200 SPA shell (not a redirect, no loop: `curl -sIL --max-redirs 3`) | |
| 7 | `curl -si https://www.tinaneureka.com/api/health` (and `/api/anything`) | Never HTML. `content-type: application/json`; 401/403 if unauthenticated, 503 `not configured` if Access/D1/secrets are missing, 404 JSON for unknown API path. If Access fronts `/api/*`, an Access redirect/403 is also acceptable and must be recorded as such | |
| 8 | `curl -si -X POST https://www.tinaneureka.com/api/<any>` with no auth and with a spoofed identity header (`-H 'X-User: owner'`) | 401/403 JSON; the spoofed header is ignored | |
| 9 | `curl -s https://www.tinaneureka.com/ \| grep -ci 'token\|password\|secret'` on the served JS bundle | No server secret values (the page may contain public words such as "token") | |
| 10 | `curl -sI http://www.tinaneureka.com/` | redirects to HTTPS | |
| 11 | `curl -sI https://tinaneureka.com/` (only after step 8 of the checklist) | `301` → `https://www.tinaneureka.com/` | |

Authenticated checks (owner, in a browser with Access login), once D1 and Access are configured:
- `/control-center` lists registered products, task states, integration health and pending approvals from `/api/*` data.
- A viewer identity cannot approve; only an `EUREKA_APPROVERS` identity can approve a gate, and an approval cannot be replayed (nonce).
- Cancelling a workflow works and is audited.

Expected degraded state when D1/Access are not yet configured: public pages 200; `/api/*` 503 JSON; Control Center shows an error state, not data. In that state the application must be reported as **public frontend only**, not fully operational.

Local, pre-deployment equivalents that *have* been run (Miniflare, not production): `tests/routing.test.mjs` shows `/api/*` answered by the Worker as JSON 401 and `/control-center`, `/pages/token.html`, `/whitepaper/`, `/eureka-legacy.html`, `/` served via assets.
