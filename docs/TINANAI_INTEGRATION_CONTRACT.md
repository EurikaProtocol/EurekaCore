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
| Durable `TaskStore` (D1/KV/IndexedDB), durable `ReplayGuard` | **Not implemented** (in-memory only; replay protection is lost on restart) |
| Real TinanAi `AgentProvider`, server-side proxy, UI approval flow | **Not implemented** |
| Solana wallet approvals | **Not implemented** |

All tests use the mock provider (`src/testing/mock-agent.ts`). They verify EurekaCore's validation and state handling; they do **not** verify any real TinanAi behaviour.

## TinanAi's documented interface (README at `c329cafe`, not implemented here)
`POST /api/agent/tasks` (objective ≤ 2,000 chars, returns a task id), `GET /api/agent/tasks/:id`, `/cancel`, `/approval`; Basic Auth via server-side `TINAN_AUTH_*`; provider keys server-side only. This differs from the contract here (EurekaCore `input` allows 8,000 chars, structured `proposedActions`), so a real adapter must map between them, and TinanAi's own approval records must **not** be treated as EurekaCore authorization. TinanAi has no LICENSE file (404 on `main`); no code was copied.

## Authority rules
- AI output is advisory. `proposedActions` carry no authority.
- `note` actions need no approval. `blockchain-transaction`, `contract-deploy`, `fund-transfer`, `permission-change` require a `HumanApproval`: an EIP-191 wallet signature over `buildApprovalMessage` (approver, nonce, validity window, canonical action id/type/description/parameters). Changing any parameter invalidates it; expiry (default 5 min, max 1 h), future-dating and nonce reuse (`ReplayGuard`, required) are rejected. The nonce is consumed only after all other checks pass.
- `authorizeAction` only permits an *attempt*. Signing, submission and confirmation stay separate (`src/core/transaction.ts`). The core does not execute contract deployment at all.
- With no agent configured, `dispatchAgentTask` returns `UNAVAILABLE`; nothing is fabricated.

## Provider boundary
`AgentProvider.execute(request)` is the only seam. A real TinanAi client must run **server-side** (provider keys never in the browser bundle), authenticate, validate origin, and call a TinanAi API over a same-origin proxy. None of that exists yet.
`src/testing/mock-agent.ts` is a test-only mock and is not exported by the SDK.

## Still required before real integration
Owner license confirmation for TinanAi; an adapter mapping this contract to TinanAi's endpoints; server-side proxy Worker and secrets in Cloudflare; D1/R2 provisioning in TinanAi; the UI approval flow (`prepareApprovalRequest` → wallet `personal_sign` → `authorizeAction`); durable task store and replay guard.
