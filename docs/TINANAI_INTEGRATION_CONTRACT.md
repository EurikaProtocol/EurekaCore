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

# Builder contract v1.0 (project generation)

## The mismatch this fixes
`TinanAiProvider` calls `POST /api/agent/tasks`. TINAN AI agent tasks return a **plan, a summary and registered tool results**, not source files. The old `generation` stage of `pr-delivery-v1` asked that agent for JSON files and parsed them out of the summary (`parseGeneratedFiles`), so it could not reliably produce files and could accept arbitrary text. Fix: the agent provider stays a planning provider; the legacy generation executor was removed; `pr-delivery-v1` blocks at `generation` with an explicit message; source files come only from a separate `ProjectBuilderProvider` (`src/core/builder.ts`) that talks to TINAN AI's project routes. Plan summaries cannot pass as file proposals (regression tests in `tests/builder.test.mjs`).

## What TINAN AI actually exposes (verified from `EurikaProtocol/TinanAi` source)
| Route | Behaviour relevant here |
|---|---|
| `POST /api/projects` `{requirements}` | Creates a project task (planning runs in-process after the response). `projectId` and `confirmOverwrite` are never sent. Requirements <= 8000 chars in TINAN AI (EurekaCore sends <= 4000) |
| `GET /api/projects/tasks/:id` | Task record: `ownerId`, `status` (planning, awaiting_approval, generating, committing, completed, failed, cancelled), `plan {summary, technology, features, steps}`, `projectId`, `errors` |
| `POST /api/projects/tasks/:id/approval` `{approved}` | Starts generation. The body carries **no plan digest** (change required below) |
| `POST /api/projects/tasks/:id/cancel` | Cancels the task |
| `GET /api/projects/:id` | `{project}` with `files: string[]` (**paths only, no contents**) |
| `GET /api/projects/:id/files?path=` | Content of one file |
| `GET /api/projects/:id/export` | Zip (not used) |

TINAN AI limits: 24 files, 256 KiB total. Non-GET requests need `Origin` equal to TINAN AI's origin. Auth is single-owner HTTP Basic; its proxy derives `ownerId = sha256(username)`.

## Contract steps and where they are implemented
| # | Step | Implementation | Status |
|---|---|---|---|
| 1 | Submit project requirements | `builder-submit` -> `submitRequirements` | implemented, contract-tested |
| 2 | Retrieve generated plan | `builder-plan` -> `getTask` (polls; idempotent on retry) | implemented, contract-tested |
| 3 | Exact plan digest | `planDigest` = SHA-256 over canonical JSON of the plan, computed by EurekaCore | implemented, unit-tested |
| 4 | Explicit approval in EurekaCore | `plan-approval` gate: digest-bound, verified Access identity, audited | implemented, tested |
| 5 | Forward approval | `forwardApproval` after the gate and after re-checking the plan digest (before and after) | implemented, contract-tested |
| 6 | Generate only after approval | `builder-generation` has `needsApproval: plan-approval`; TINAN AI is never told to generate earlier | implemented, tested |
| 7 | Retrieve files (bounded, authenticated) | `listFiles` (paths) then `readFile` per file; response-size caps; server-side Basic auth | implemented, contract-tested |
| 8 | Validate count, size, paths, ownership | `validateBuilderPaths`, `buildManifest`, `ownerId` check on every task/project response | implemented, tested |
| 9 | Transfer to a protected `eureka/*` branch | `files-approval` gate, then `branch` + `commit`; `commit` re-reads each file from the Builder and compares it to the approved SHA-256 before writing | implemented, tested |
| 10 | Read back and compare | `commit` verifier reads every file from GitHub and compares SHA-256 and size | implemented, tested |

Validation rules: 1-24 files; every path safe (no traversal, absolute, backslash, hidden/workflow files, `//`); no duplicate paths (case-insensitive); <= 128 KiB per file; <= 256 KiB total; no NUL bytes. Stage outputs hold only a manifest (path, bytes, SHA-256) with the plan digest and manifest digest, never file contents. Files are committed under `generated/<workflow-id>/`.

Errors are typed (`BuilderError`: `AUTH`, `RATE_LIMITED`, `NOT_FOUND`, `UNAVAILABLE`, `CONFLICT`, `MALFORMED`, `NETWORK`, `HTTP`, `INVALID_INPUT`, `OWNERSHIP_MISMATCH`, `ABORTED`). There is no mock or simulated fallback.

## Fail-closed configuration
`builder-delivery-v1` handlers are registered only when `TINANAI_BUILDER_ENABLED=true` **and** the TINAN AI credentials are present. Without a Builder none of `builder-submit`, `builder-plan`, `builder-generation` or `commit` exist; the workflow blocks with a message naming the missing configuration; no file, commit or PR is created. `commit` also needs GitHub; `testing` needs a sandbox. Without a sandbox the workflow stops at `testing` and never reports that tests passed.

## Identity and data isolation
- All credentials (`TINANAI_*`, `GITHUB_TOKEN`, `SANDBOX_TOKEN`) are Worker secrets; nothing is exposed to browser code.
- Users authenticate to EurekaCore with Cloudflare Access (viewer/operator/approver). EurekaCore calls TINAN AI with **one** service credential, so every EurekaCore user maps to **one** TINAN AI owner (`sha256(TINANAI_USERNAME)`).
- Isolation is therefore enforced by EurekaCore, not TINAN AI: a workflow only uses the task and project ids stored in its own stage outputs (never user-supplied ids), the adapter rejects any task or project whose `ownerId` differs from the service owner, and returned ids must match requested ids.
- `TINANAI_BUILDER_ENABLED=true` is the explicit attestation that the deployment is single-tenant. **Multi-user access is not enabled** and must not be until TINAN AI supports per-user ownership (blocked / planned, below).

## Remaining blockers
- Nothing is live-verified: no run against a real TINAN AI, GitHub, D1 or sandbox service.
- TINAN AI's execution/sandbox checks stay disabled; `TINAN_SANDBOX_VERIFIED` must not be set to enable them.
- The files gate shows only the manifest, not contents.
- Builder projects without `node:test` files cannot pass the sandbox testing stage.

## Separate TINAN AI changes required (specified here, NOT implemented in this repository)
1. **Approval bound to a plan digest:** `POST /api/projects/tasks/:id/approval` accepts `{approved:true, planDigest}` and answers 409 if the stored plan's digest (SHA-256 over canonical JSON of `{summary, technology, features, steps}`) differs; a plan is immutable once `awaiting_approval`.
2. **Internal file-export endpoint:** e.g. `GET /api/internal/projects/:id/manifest` (service auth, owner-checked) returning `{projectId, ownerId, planDigest, files:[{path, bytes, sha256}]}`, hard-capped at 24 files / 256 KiB, plus a bounded bulk read, so EurekaCore can verify hashes without N round trips.
3. **Delegated per-user ownership:** a signed, short-lived delegation (e.g. an EurekaCore-signed token carrying the verified user) mapped to distinct owner ids, with no shared owner credential for end users.
4. **Verified sandbox** in TINAN AI before any in-product execution is considered; until then project execution stays disabled.
5. Task state lives in TINAN AI process memory, so a restart can lose a task (EurekaCore reports `NOT_FOUND`, never fakes).
