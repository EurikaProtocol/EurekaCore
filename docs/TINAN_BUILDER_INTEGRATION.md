# TINAN AI Builder — native EUREKA CORE integration

EUREKA CORE hosts the Builder UI, identity, ownership, approval and audit. TINAN AI stays an independent service that plans and generates. The wire format is **Builder Contract v1.1** (`TINANAI_INTEGRATION_CONTRACT.md`); no incompatible change was made, and the existing adapter (`src/server/tinanai-builder.ts`) is preserved and extended only with optional features.

## Architecture

```
Browser ──(Cloudflare Access cookie)──► EUREKA CORE Worker
  React UI  /tinan-ai/builder …           │ verify Access JWT → email + role
  (no secrets, no user ids sent)          │ ownership check (owner_email), audit log (D1)
                                          │ approval gate (approver role + plan digest)
                                          ▼
                              BuilderProjectService ── D1 builder_projects
                                          │
                          TinanAiBuilderProvider (adapter)
                       Basic auth + Origin  [+ signed delegation]
                                          │  Service Binding (if TINANAI_SERVICE)
                                          │  or authenticated HTTPS
                                          ▼
                              TINAN AI (independent service)
                       reasoning · planning · generation · export
```

Cloudflare Access headers and the user's email are never forwarded to TINAN AI.

## Responsibilities

| EUREKA CORE | TINAN AI |
|---|---|
| Identity, authorization, ownership, approval, audit, UI, verification of results | Reasoning, planning, code generation, files, testing, repair, export |

## Flow and verification

1. `POST /api/builder/projects` (operator) submits requirements; the task is created on TINAN AI.
2. Plan is fetched; EUREKA CORE computes its SHA-256 digest.
3. `POST …/approve` (approver, project owner) with `planDigest`. It must equal the stored digest and a freshly re-fetched plan digest. The approval is recorded, then forwarded; a TINAN 409 discards it.
4. If TINAN AI starts generating without a recorded approval, the task is cancelled and marked failed.
5. On `completed`, the manifest is fetched and verified: contract version, manifest digest, plan digest equals approved digest, file set, per-file SHA-256 and size. Only then is the project `completed`.
6. File view and ZIP export re-fetch and re-verify every file (502 `FILE_HASH_MISMATCH` on change).

Build/test execution is reported as **not run** (the TINAN sandbox is disabled). Success is never claimed from AI summaries; there is no mock fallback.

## API (new, all under `/api/builder`, authenticated)

| Method | Path | Role |
|---|---|---|
| GET | `/status`, `/history`, `/projects`, `/projects/:id`, `/projects/:id/history`, `/projects/:id/file?path=`, `/projects/:id/export` | viewer (owner only) |
| POST | `/projects` | operator |
| POST | `/projects/:id/approve` | approver + owner |
| POST | `/projects/:id/cancel`, `/retry` | operator + owner |

Foreign and missing projects both return 404. Limits: 50 projects/owner, name ≤ 80, requirements ≤ 4000, body ≤ 16 KB, 3 attempts per project. GET calls to TINAN AI retry up to 2 times with backoff; writes are never retried.

Statuses: Queued, Planning, Awaiting approval, Generating, Validating, Completed, Failed, Cancelled. Integration states: Connected, Authentication failed, TINAN AI unavailable, Not configured.

## Frontend routes

`/tinan-ai/builder`, `/tinan-ai/projects`, `/tinan-ai/projects/:id`, `/tinan-ai/tasks`, `/tinan-ai/history`, `/tinan-ai/integrations`. The marketing page `/tinan-ai` is unchanged.

## Configuration

| Name | Kind | Purpose |
|---|---|---|
| `TINANAI_BUILDER_ENABLED` | var | `true` enables the native Builder |
| `TINANAI_BASE_URL` | var | TINAN AI origin |
| `TINANAI_USERNAME`, `TINANAI_PASSWORD` | **secrets** | server-to-server Basic auth |
| `TINANAI_DELEGATION_SECRET` | **secret, optional** | per-user signed delegation (TINAN AI needs `TINAN_MULTI_USER_ENABLED=true` and the same secret) |
| `TINANAI_SERVICE` | optional Service Binding | private Worker-to-Worker transport |
| Existing Access / role allowlist vars | | unchanged |

Without the delegation secret, all users share one TINAN AI owner and EUREKA CORE alone enforces isolation via `owner_email`. With it, TINAN AI also isolates per user.

**Service Binding:** use it only if both Workers are in the same Cloudflare account; add `[[services]] binding = "TINANAI_SERVICE"` to `wrangler.toml` then. Otherwise HTTPS is used. No binding was added in this change.

## Deployment

1. Apply `migrations/0003_builder_projects.sql` to a preview D1 first (not applied by this change).
2. Set secrets with `wrangler secret put` (not done by this change).
3. Set `TINANAI_BUILDER_ENABLED=true`, deploy through the normal pipeline after review.
4. Open `/tinan-ai/integrations` and confirm **Connected**.

If the table is missing, the API returns 503 `BUILDER_STORAGE_MISSING`.

## Remaining blockers

- Not verified against a live TINAN AI deployment (tested against a contract-level fake).
- Migration 0003 and secrets must be applied by the owner.
- TINAN AI sandbox is disabled, so build/test results are unavailable.
- Per-user isolation on TINAN AI requires enabling multi-user mode there.
- The write rate limiter is per isolate.
