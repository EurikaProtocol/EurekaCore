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
