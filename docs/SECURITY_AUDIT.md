# Security audit

**Scope:** source/configuration review of `main` SHA `d87dfe022bf39b20041154b2bf1674a9321cf7d6`, current Worker/API tests and deploy logs. Cloudflare account settings and live domain behavior were not accessible.

## Controls verified in code

- **Authentication:** `src/server/auth.ts` verifies Access JWT RS256 signatures against the configured team's JWKS, issuer, audience, expiry, and not-before window. A missing team domain/AUD or unavailable JWKS fails closed.
- **Authorization:** roles are derived from server-side email allowlists. Protected operations check viewer/operator/approver roles; approver identity comes from the verified token, not request data.
- **CSRF:** non-GET API requests require an `Origin` exactly matching the request origin.
- **Input size:** JSON bodies are capped at 16 KB. This audit fixed the prior unbounded `request.text()` buffering and character-count check by rejecting oversized declared lengths and counting/canceling streamed bytes. `tests/worker.integration.test.mjs` covers a multibyte UTF-8 body over the byte limit.
- **Rate limiting:** writes are throttled per verified email in each Worker isolate. This is not a global/edge-wide quota; Cloudflare rate-limiting rules remain an operational hardening option.
- **SQL injection:** D1 values use bound parameters; table/column SQL is static. Local D1 tests run both migrations.
- **Error responses:** API responses are JSON and `no-store`; unexpected exceptions return a generic internal error. The Worker adds `nosniff`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy` to asset responses.
- **Production secrets:** browser `VITE_*` settings are documented as public values; server credentials are expected in Worker/GitHub secrets. No actual secret value was included in this report. The edited source and test files passed the repository secret scanner.
- **Fail-closed posture:** missing Access configuration returns 503; missing D1 prevents persistent operations. No protected API was made public.

## Findings and remaining risks

| Finding | Status |
|---|---|
| Request body was fully buffered before its size check and size was measured in JS characters. | **Fixed** in the current task changes; regression test added. |
| The production API has no configured D1 binding in `wrangler.toml`. | **Blocked** on owner-provided existing database ID and explicit migration approval. Protected persistence routes return 503. |
| Actual Access team domain, AUD, role lists, and Cloudflare Access coverage cannot be read from repository configuration. | **Unverified**; set and test with the real Cloudflare account values. |
| Per-isolate rate limiting is not an edge-wide abuse limit. | **Known limitation**; assess Cloudflare rate-limiting rules before broad exposure. |
| Worker code sets several security headers but does not establish CSP or HSTS. | **Unverified/hardening needed**; evaluate CSP against inline legacy scripts and external wallet providers before rollout. Confirm HSTS only with the domain/TLS owner. |
| npm reports 26 advisories (12 moderate, 14 high) in the current install; the high/critical CI gate accepts the package names listed in `security/audit-baseline.json`. | **Unresolved dependency risk**, not a clean audit. The existing audit document records the current triage; upgrade only with compatibility and wallet regression coverage. |
| The advisory lookup flagged the manifest's minimum Vite version `8.3.0` for a `launch-editor` issue. | The lockfile resolves Vite `8.3.5` (`npm ls`), above the advisory's fixed `8.3.3`; `npm audit` does not report Vite. No dependency change was needed. |
| `eureka-legacy.html` and legacy wallet functionality include configurable placeholder values and external CDN imports. | **Production limitation**: placeholders are not credentials, but affected wallet actions are not configured; CDN availability/integrity remains a supply-chain dependency for that legacy surface. Preserve it until product owners decide whether to configure or retire it. |
| Secret scanning and CodeQL do not cover the Cloudflare account, GitHub secret values, DNS, or external provider systems. | **Not verifiable here**; use GitHub/Cloudflare account-side controls and do not disclose secret values. |

## Live security state

The latest observed GitHub deploy run failed with Cloudflare authentication errors `10000` and `9109`, after the workflow's nonempty-secret check passed. The earlier run deployed successfully, but the later result does not verify a subsequently replaced token. The production domain did not resolve in the available browser environment. Cloudflare Access, Worker variables, remote D1, TLS, DNS, and deployed headers remain unverified.
