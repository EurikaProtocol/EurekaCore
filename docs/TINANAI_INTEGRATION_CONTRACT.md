# EurekaCore ↔ TinanAi integration contract (v1.0)

**EurekaCore** is the control core: validation, permissions, approvals, status and result handling. **TinanAi** (separate repository/service) is the AI execution agent: reasoning, planning, generation, and authorised tool use. Neither codebase is copied into the other. TinanAi currently has no explicit license, so no code may be reused until the owner confirms rights.

Implementation: `src/core/agent.ts`, `src/core/approval.ts`. Version constant: `AGENT_CONTRACT_VERSION = '1.0'`.

## Request (`AgentTaskRequest`)
`contractVersion`, `id`, `kind` (`analyze` | `plan` | `generate`), `input` (1–8000 chars), `createdAt`, `allowedTools` (identifiers). Built only via `createAgentTask`.

## Result (`AgentResult`)
`completed` (`output.text`, `output.proposedActions[]`, `toolsUsed`) or `failed` (`error.code/message`). `validateAgentResult` is strict: wrong version, wrong task id, malformed or unknown action types, oversized text and any tool outside `allowedTools` are rejected; unknown fields (including any forged "approval") are dropped.

## Authority rules
- AI output is advisory. `proposedActions` carry no authority.
- `note` actions need no approval. `blockchain-transaction`, `contract-deploy`, `fund-transfer`, `permission-change` require a `HumanApproval` for that exact action id, created by the app after an explicit wallet confirmation, and unexpired (default 5 min, max 1 h).
- `authorizeAction` only permits an *attempt*. Signing, submission and confirmation stay separate (`src/core/transaction.ts`). The core does not execute contract deployment at all.
- With no agent configured, `dispatchAgentTask` returns `UNAVAILABLE`; nothing is fabricated.

## Provider boundary
`AgentProvider.execute(request)` is the only seam. A real TinanAi client must run **server-side** (provider keys never in the browser bundle), authenticate, validate origin, and call a TinanAi API over a same-origin proxy. None of that exists yet.
`src/testing/mock-agent.ts` is a test-only mock and is not exported by the SDK.

## Still required before real integration
Owner license confirmation for TinanAi; TinanAi HTTP API spec (endpoints, auth, rate limits, cancel); server-side proxy Worker and secrets in Cloudflare; D1/R2 provisioning in TinanAi; the UI approval flow that calls `createHumanApproval` after wallet confirmation; task persistence and cancellation (`TaskStatus` is defined but not yet stored).
