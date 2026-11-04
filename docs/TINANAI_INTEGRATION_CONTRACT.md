# EurekaCore ↔ TinanAi integration contract (v1.0)

**EurekaCore** is the control core: validation, permissions, approvals, status and result handling. **TinanAi** (separate repository/service) is the AI execution agent: reasoning, planning, generation, and authorised tool use. Neither codebase is copied into the other. TinanAi currently has no explicit license, so no code may be reused until the owner confirms rights.

Implementation: `src/core/agent.ts`, `src/core/approval.ts`. Version constant: `AGENT_CONTRACT_VERSION = '1.0'`.

## Request (`AgentTaskRequest`)
`contractVersion`, `id`, `kind` (`analyze` | `plan` | `generate`), `input` (1–8000 chars), `createdAt`, `allowedTools` (identifiers). Built only via `createAgentTask`.

## Result (`AgentResult`)
`completed` (`output.text`, `output.proposedActions[]`, `toolsUsed`) or `failed` (`error.code/message`). `validateAgentResult` is strict: wrong version, wrong task id, malformed or unknown action types, oversized text and any tool outside `allowedTools` are rejected; unknown fields (including any forged "approval") are dropped.

## Implemented vs planned

| Area | Status |
|---|---|
| Task request / result schema, strict validation, timeout (`agent.ts`) | Implemented, tested with a mock |
| Task lifecycle `queued → running → completed/failed/cancelled`, cancellation (incl. late results discarded), `TaskStore` with compare-and-set, `InMemoryTaskStore` (`task.ts`) | Implemented, tested |
| Wallet-signed approvals bound to exact action + parameters, expiry, single-use nonce (`approval.ts`, EVM wallets only) | Implemented, tested with locally generated wallets |
| Durable `TaskStore` and `ReplayGuard` on Cloudflare D1 (`src/server/d1.ts`, `migrations/0001_core_state.sql`) | Implemented; tested against SQLite (`node:sqlite`) with the same SQL, **not against real D1**. Not wired to a deployed Worker (no `database_id`; see `docs/PERSISTENCE.md`) |
| Server-side TinanAi `AgentProvider` (`src/server/tinanai-provider.ts`) | Implemented from TinanAi's source at `c329cafe`; contract-tested with a fake `fetch`. **Unverified against a live TinanAi instance** |
| Review/sign UI (`/approvals`, `src/pages/ApprovalReview.tsx`) | Implemented as a **preview**: signs an approval for a pasted action; nothing is sent or executed |
| Worker route exposing the agent to the app, server-side verification of signed approvals | **Not implemented** (requires an auth model decision) |
| Solana wallet approvals | **Not implemented** (EVM only) |

All tests use the mock provider (`src/testing/mock-agent.ts`). They verify EurekaCore's validation and state handling; they do **not** verify any real TinanAi behaviour.

## TinanAi's interface (verified from source at `c329cafe`, implemented in `src/server/tinanai-provider.ts`)
- `POST /api/agent/tasks` with `{objective}` (≤ 2,000 chars, ≤ 16 KB body) → `202 {provider, simulated, task, persistence}`; `GET /api/agent/tasks/:id`; `POST /api/agent/tasks/:id/cancel`; `/approval` exists but is **never called** by EurekaCore.
- Auth: HTTP Basic (`TINAN_AUTH_USERNAME`/`PASSWORD` on TinanAi); non-GET requests need `Origin`/`Referer` equal to TinanAi's own origin; HTTPS required in production; 503 if auth unconfigured; 429 on rate limit.
- Task statuses: planning, awaiting_approval, executing, completed, failed, cancelled. Tasks live in TinanAi process memory, so a GET may 404 after a restart (reported as `NOT_FOUND`, never faked).
- Mapping: `summary` → `output.text`; `toolResults[].tool` → `toolsUsed` (must be within `allowedTools`, else the whole result is rejected); `plan[]` → `note` actions only (no authority); `awaiting_approval` → failed `TINANAI_APPROVAL_REQUIRED`; TinanAi-side approvals are not EurekaCore authorization. Input over 2,000 chars fails locally.
- EurekaCore env (Worker secrets, never `VITE_*`): `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD`. Failures map to `AUTH`, `RATE_LIMITED`, `NOT_FOUND`, `UNAVAILABLE`, `MALFORMED`, `NETWORK`, `HTTP`; there is no mock fallback.
- TinanAi has no LICENSE file; no code was copied (only the HTTP interface is used).

## Authority rules
- AI output is advisory. `proposedActions` carry no authority.
- `note` actions need no approval. `blockchain-transaction`, `contract-deploy`, `fund-transfer`, `permission-change` require a `HumanApproval`: an EIP-191 wallet signature over `buildApprovalMessage` (approver, nonce, validity window, canonical action id/type/description/parameters). Changing any parameter invalidates it; expiry (default 5 min, max 1 h), future-dating and nonce reuse (`ReplayGuard`, required) are rejected. The nonce is consumed only after all other checks pass.
- `authorizeAction` only permits an *attempt*. Signing, submission and confirmation stay separate (`src/core/transaction.ts`). The core does not execute contract deployment at all.
- With no agent configured, `dispatchAgentTask` returns `UNAVAILABLE`; nothing is fabricated.

## Provider boundary
`AgentProvider.execute(request, signal)` is the only seam. `TinanAiProvider` runs server-side only; a test asserts the browser entry points do not import `src/server/*`, and the built `dist` contains no TinanAi credential names. `src/testing/mock-agent.ts` is test-only and not exported by the SDK.

## Still required before the real integration is verified
1. A reachable TinanAi instance (HTTPS) plus its Basic-auth credentials stored as Worker secrets, and a run of the adapter against it (nothing has been run live).
2. Owner confirmation of TinanAi's license.
3. An owner decision on how the app authenticates to an EurekaCore Worker route that calls the adapter, then wiring it (not done; no unauthenticated proxy was added).
4. D1 provisioning (`docs/PERSISTENCE.md`) and server-side verification of signed approvals via `authorizeAction` with `D1ReplayGuard`.

---

# Builder contract v1.1 (project generation)

v1.1 supersedes v1.0. It is implemented on both sides: EurekaCore (this repo, PR #36) and TinanAi (branch `eureka/phase-1-builder-contract`, separate PR). Both documents use the same preimages below. EurekaCore refuses to run against a TINAN AI that lacks v1.1 (no fallback).

## The mismatch this fixes
`TinanAiProvider` calls `POST /api/agent/tasks`. TINAN AI agent tasks return a **plan, a summary and registered tool results**, not source files. The old `generation` stage of `pr-delivery-v1` asked that agent for JSON files and parsed them out of the summary (`parseGeneratedFiles`), so it could not reliably produce files and could accept arbitrary text. Fix: the agent provider stays a planning provider; the legacy generation executor was removed; `pr-delivery-v1` blocks at `generation` with an explicit message; source files come only from a separate `ProjectBuilderProvider` (`src/core/builder.ts`) that talks to TINAN AI's project routes. Plan summaries cannot pass as file proposals (regression tests in `tests/builder.test.mjs`).

## What TINAN AI actually exposes (verified from `EurikaProtocol/TinanAi` source)
| Route | Behaviour relevant here |
|---|---|
| `POST /api/projects` `{requirements}` | Creates a project task (planning runs in-process after the response). `projectId` and `confirmOverwrite` are never sent. Requirements <= 8000 chars in TINAN AI (EurekaCore sends <= 4000) |
| `GET /api/projects/tasks/:id` | Task record: `ownerId`, `status` (planning, awaiting_approval, generating, committing, completed, failed, cancelled), `plan {summary, technology, features, steps}`, `projectId`, `errors` |
| `POST /api/projects/tasks/:id/approval` `{approved, planDigest}` | Starts generation. v1.1: a `planDigest` that differs from the stored plan returns **409 `PLAN_DIGEST_MISMATCH`** and nothing starts. (v1.0 carried no digest.) |
| `GET /api/projects/tasks/:id/manifest` (v1.1) | `{manifest:{contractVersion:'1.1', taskId, projectId, ownerId, planDigest, files:[{path,bytes,sha256}], totalBytes, manifestDigest}}`; completed tasks only (409 otherwise), owner-scoped (404), bounded (422), no contents |
| `POST /api/projects/tasks/:id/cancel` | Cancels the task |
| `GET /api/projects/:id` | `{project}` with `files: string[]` (**paths only, no contents**) |
| `GET /api/projects/:id/files?path=` | `{path, content}` (v1.1 adds `bytes`, `sha256`) |
| `GET /api/projects/:id/export` | Zip (not used) |

TINAN AI limits: 24 files, 256 KiB total (manifest also caps 128 KiB per file). Non-GET requests need `Origin` equal to TINAN AI's origin. Auth is single-owner HTTP Basic; its proxy derives `ownerId = sha256(username)`.

## Digest preimages (identical on both sides)
- `planDigest = sha256(JSON.stringify(['eureka.builder-plan.v1', summary, technology, features, steps]))`, `0x` + lowercase hex.
- `sha256` of a file = SHA-256 of its UTF-8 bytes, `0x` hex. `manifestDigest = sha256(JSON.stringify(['eureka.builder-manifest.v1', planDigest, filesSortedByPath.map(f => [path, bytes, sha256])]))`.
- Cross-implementation agreement is unit-tested in both repositories (TinanAi asserts the EurekaCore preimage literally).

## Contract steps and where they are implemented
| # | Step | Implementation | Status |
|---|---|---|---|
| 1 | Submit project requirements | `builder-submit` -> `submitRequirements` | implemented, contract-tested |
| 2 | Retrieve generated plan | `builder-plan` -> `getTask` (polls; idempotent on retry) | implemented, contract-tested |
| 3 | Exact plan digest | `planDigest` = SHA-256 over canonical JSON of the plan, computed by EurekaCore | implemented, unit-tested |
| 4 | Explicit approval in EurekaCore | `plan-approval` gate: digest-bound, verified Access identity, audited | implemented, tested |
| 5 | Forward approval | `forwardApproval(taskId, planDigest)` after the gate and after re-checking the plan digest (before and after); TINAN AI answers 409 on mismatch | implemented, contract-tested both sides (mock) |
| 6 | Generate only after approval | `builder-generation` has `needsApproval: plan-approval`; TINAN AI is never told to generate earlier | implemented, tested |
| 7 | Retrieve files (bounded, authenticated) | `listFiles` (paths) then `readFile` per file, then `getManifest`; EurekaCore recomputes the manifest digest from the bytes it read and requires it to equal TINAN AI's manifest and plan digest. Missing manifest endpoint = blocked, never a fallback | implemented, contract-tested |
| 8 | Validate count, size, paths, ownership | `validateBuilderPaths`, `buildManifest`, `ownerId` check on every task/project response | implemented, tested |
| 9 | Transfer to a protected `eureka/*` branch | `files-approval` gate, then `branch` + `commit`; `commit` re-reads each file from the Builder and compares it to the approved SHA-256 before writing | implemented, tested |
| 10 | Read back and compare | `commit` verifier reads every file from GitHub and compares SHA-256 and size | implemented, tested |

Validation rules: 1-24 files; every path safe (no traversal, absolute, backslash, hidden/workflow files, `//`); no duplicate paths (case-insensitive); <= 128 KiB per file; <= 256 KiB total; no NUL bytes. Stage outputs hold only a manifest (path, bytes, SHA-256) with the plan digest and manifest digest, never file contents. Files are committed under `generated/<workflow-id>/`.

Errors are typed (`BuilderError`: `AUTH`, `RATE_LIMITED`, `NOT_FOUND`, `UNAVAILABLE`, `CONFLICT`, `MALFORMED`, `NETWORK`, `HTTP`, `INVALID_INPUT`, `OWNERSHIP_MISMATCH`, `ABORTED`). There is no mock or simulated fallback.

## Authentication model
Service-to-service: HTTPS + HTTP Basic (`TINANAI_USERNAME`/`TINANAI_PASSWORD`, Worker secrets) + same-origin `Origin` on non-GET. The credential is never sent to browsers. No new secret is required for single-owner operation.

## Ownership model
| Mode | State |
|---|---|
| **Single-owner (current, the only enabled mode)** | All EurekaCore users share TINAN AI owner `sha256(username)`. EurekaCore isolates users by workflow-scoped ids and rejects any record whose `ownerId` differs. |
| **Delegated multi-user (designed; implemented in TinanAi, disabled by default)** | EurekaCore would send `x-eureka-delegation: v1.<payload>.<hmac>` signed with `TINAN_DELEGATION_SECRET` (payload `{sub, aud:'tinan-ai', iat, exp<=300s}`); TINAN AI derives `ownerId = sha256('tinan-delegated-owner:v1:'+sub)`; the Basic credential stays mandatory. Without `TINAN_MULTI_USER_ENABLED=true` TINAN AI answers 403 `MULTI_USER_DISABLED` to any delegated request. |
| **EurekaCore side of delegation** | **Blocked / planned**: workflows do not persist a verified creator (`createdBy`), which needs a D1 migration; that must be reviewed separately and is not applied here. Until then EurekaCore sends no delegation header and must not be configured for multiple tenants. |
Do not enable multi-user mode until: workflow `createdBy` persisted and checked on every read/advance; EurekaCore signs delegations per verified user; TINAN AI runs with `TINAN_MULTI_USER_ENABLED=true`; and a live cross-user isolation test passes.

## Fail-closed configuration
`builder-delivery-v1` handlers are registered only when `TINANAI_BUILDER_ENABLED=true` **and** the TINAN AI credentials are present. Without a Builder none of `builder-submit`, `builder-plan`, `builder-generation` or `commit` exist; the workflow blocks with a message naming the missing configuration; no file, commit or PR is created. `commit` also needs GitHub; `testing` needs a sandbox. Without a sandbox the workflow stops at `testing` and never reports that tests passed.

## Identity and data isolation
- All credentials (`TINANAI_*`, `GITHUB_TOKEN`, `SANDBOX_TOKEN`) are Worker secrets; nothing is exposed to browser code.
- Users authenticate to EurekaCore with Cloudflare Access (viewer/operator/approver). EurekaCore calls TINAN AI with **one** service credential, so every EurekaCore user maps to **one** TINAN AI owner (`sha256(TINANAI_USERNAME)`).
- Isolation is therefore enforced by EurekaCore, not TINAN AI: a workflow only uses the task and project ids stored in its own stage outputs (never user-supplied ids), the adapter rejects any task or project whose `ownerId` differs from the service owner, and returned ids must match requested ids.
- `TINANAI_BUILDER_ENABLED=true` is the explicit attestation that the deployment is single-tenant. **Multi-user access is not enabled** and must not be until TINAN AI supports per-user ownership (blocked / planned, below).

## Test status
| Layer | Status |
|---|---|
| EurekaCore adapter, executors, gates (fake HTTP modelled on the TinanAi routes, Miniflare worker) | unit/contract-tested (`npm test`) |
| TinanAi digest, approval 409, manifest, owner isolation, cancellation, delegation (in-memory D1/R2) | unit-tested (TinanAi `npm test`) |
| Live EurekaCore -> deployed TINAN AI (`npm run test:live`, needs `EUREKA_LIVE_TINANAI=1` + credentials) | **scaffolded, skipped by default, not run**; it plans, checks that a wrong digest yields 409, then cancels; it never approves generation |
| Live GitHub, Cloudflare D1/R2, remote sandbox | not live-verified |

## Remaining blockers
- Nothing is live-verified: no authorized TINAN AI deployment or credentials were available. TinanAi v1.1 is not deployed; until it is, EurekaCore's Builder workflow stops with `MANIFEST_UNSUPPORTED`/`CONFLICT`.
- Multi-user: EurekaCore `createdBy` persistence (D1 migration) and per-user delegation signing are not implemented.
- TINAN AI's execution/sandbox checks stay disabled; `TINAN_SANDBOX_VERIFIED` must not be set to enable them.
- The files gate shows only the manifest, not contents.
- Builder projects without `node:test` files cannot pass the sandbox testing stage.

## Deployment requirements (owner-performed; nothing is deployed by these PRs)
1. Merge and deploy TinanAi v1.1 to its **preview** Worker first; no D1 migration is needed (digest is stored in the task JSON). Optionally set `TINAN_REQUIRE_PLAN_DIGEST=true`. Leave `TINAN_MULTI_USER_ENABLED` unset.
2. Run `npm run test:live` against preview with the service credentials.
3. Only then set EurekaCore `TINANAI_BUILDER_ENABLED=true`, GitHub allowlist and sandbox settings.

## TinanAi changes
Implemented in the companion TinanAi PR (branch `eureka/phase-1-builder-contract`): plan digest and approval 409; manifest endpoint with per-file SHA-256; `bytes`/`sha256` on file reads; owner validation (existing owner-scoped lookups); delegation primitive, disabled by default. Durable task state and cancellation already existed in TinanAi (D1 `project_tasks`; atomic compare-and-set cancel) and are covered by tests there. Still separate and not done: a verified sandbox in TINAN AI, and enabling multi-user mode.
