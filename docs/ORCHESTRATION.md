# EurekaCore orchestration (Phase 1)

## Modules (`src/core/`)
| Module | Role |
|---|---|
| `permissions.ts` | Six autonomy tiers. Levels 5-6 are never covered by a grant; they need a recorded human approval. |
| `registry.ts` | `ProductRegistry`: validated product records (repo, API URL, auth, max level, health, docs). Seeds TINAN AI, Token Launchpad, Data Layer, Marketplace. |
| `audit.ts` | Append-only, hash-chained audit log; `verifyAuditChain` detects edits and deletions. |
| `workflow.ts` | `WorkflowEngine`: the 14-stage project pipeline, human gates, CAS persistence, retry, lease-based recovery, cancel. |
| `agent-stage.ts` | Adapts an `AgentProvider` (existing contract) to a proposal-only stage; agent gets no tools. |
| `src/server/d1.ts` | `D1WorkflowStore`, `D1AuditLog` (migration `0002_workflows_audit.sql`). |

## Guarantees (tested in `tests/orchestration.test.mjs`)
- A stage completes only when **every** acceptance criterion has exactly one passing result with evidence from the verifier, which is separate from the executor.
- A stage with no configured executor **blocks** the workflow; nothing is simulated or skipped.
- Gates (`plan-approval`, `deployment-approval`) need a named human and the exact review digest (hash of objective + all earlier outputs). Stale digests are refused. The level-5 `deployment` stage cannot run before its gate is approved, whatever level was granted.
- Linking a product caps the requested level at the product's `maxPermissionLevel`.
- Concurrent writers lose via version compare-and-set; a running stage holds a lease, `recover()` only revives stages whose lease expired; late results after cancel are discarded.
- Agent-proposed consequential actions stay text proposals; no approval is ever derived from agent output.

## What works vs. what does not
| Area | Status |
|---|---|
| Registry, tiers, audit chain, workflow engine, D1 stores | Implemented; tested in-memory and against SQLite (not real D1) |
| Planning stages with an `AgentProvider` | Works with any provider; tested only with the mock. Live TinanAi unverified |
| `security-review`, `preview`, `deployment*`, `monitoring` executors | **Not implemented** - the engine blocks at these stages |
| Queues / Durable Objects | Not used; `advance` runs a stage inside the request (25 s limit) |
| Shared AI provider layer (model routing, usage tracking), knowledge base | Not implemented; only the TinanAi provider exists |
| Launchpad / Data Layer / Marketplace integrations | Not implemented; registered as `not-integrated` |
| Solana wallet approvals | Not wired to the Worker API; approvals use Cloudflare Access identity |
| Remote Cloudflare D1, live GitHub, live TinanAi | **Not verified** (no credentials in the build environment) |

## Phase 1 AI Builder integration: approvals, autonomy, status
Status labels: **implemented** (code exists), **unit-tested** (in-memory fakes), **contract-tested** (fake HTTP modelled on TinanAi source; Worker bundle run in Miniflare), **live-verified** (run against a real service), **blocked**, **planned**.

| Area | Status |
|---|---|
| `ProjectBuilderProvider` interface separate from `AgentProvider` (`src/core/builder.ts`) | Implemented, unit-tested |
| TINAN AI Builder adapter (`src/server/tinanai-builder.ts`) | Implemented, contract-tested. **Not live-verified** |
| Builder stage executors, file/path/size/duplicate validation, SHA-256 manifest (`src/server/builder-executors.ts`) | Implemented, unit-tested, contract-tested in the Worker (Miniflare) |
| Fail closed without a Builder / GitHub / sandbox | Implemented, tested: handlers are not registered and the workflow blocks with a configuration message |
| Two human gates, digest-bound, expiring (24 h), single-use, audited | Implemented, tested |
| Committed files read back from GitHub and compared by SHA-256 | Implemented, tested |
| Sandboxed tests of generated code | Implemented (Docker runner); the end-to-end test ran against the real local Docker runner. Execution inside TINAN AI stays disabled (`TINAN_SANDBOX_VERIFIED` is not set and must not be) |
| Multi-user ownership in TINAN AI | **Blocked / planned** (TINAN AI is single-owner Basic Auth) |
| Plan digest enforced by TINAN AI; internal file-export endpoint with hashes | **Planned** (separate TINAN AI change; see `TINANAI_INTEGRATION_CONTRACT.md`) |
| Live run against a real TINAN AI, GitHub or D1 | **Not verified** |

Approval rules: the digest (`reviewDigest`) covers the workflow id, objective and every earlier stage output (the Builder plan and its digest at the plan gate; the file manifest at the files gate), so changing the objective, plan or any proposed file invalidates an earlier approval. The approver is always the verified Access email (approver role required); the approval is recorded as `stage.approved` with the digest, consumed by the stage transition (single use) and expires after 24 h (`APPROVAL_TTL_MS`; an expired gate is re-opened for a fresh review). `needsApproval` is enforced at every level: `builder-generation` cannot run before `plan-approval`, and `branch`/`commit` cannot run before `files-approval`. TINAN AI's own approval flag is only the trigger EurekaCore forwards after its own approval; agent output cannot approve itself, and a Builder task that advances without EurekaCore's approval is rejected.

Autonomy levels are unchanged (READ, PROPOSE, DEVELOPMENT, STAGING, PRODUCTION, FINANCIAL_BLOCKCHAIN). Every Builder stage is level 3 or lower; levels 5-6 always need explicit human approval and are never autonomous. GitHub limits are unchanged: allowlisted repositories, `eureka/*` branches, draft PRs, no merge, force push, branch deletion or production deployment.

Sandbox boundary: the Worker never runs generated code. Testing uses only the remote isolated sandbox (no network, read-only filesystem, CPU/RAM limits, timeout, cancellation). Without a verified sandbox the workflow blocks at `testing`: the committed branch is a reviewable proposal, no test result is claimed and no pull request is opened. The sandbox runs only `node --test`; Builder projects without `node:test` files fail the testing stage rather than being reported as passing.

Known limit: the files gate shows the manifest (path, size, SHA-256), not file contents; review contents on the development branch or in the Builder before approving.

## Phase 2: authenticated execution engine
- **API** (`src/server/api.ts`, routed first by `cloudflare/worker.js`): `/api/session|products|integrations|workflows|approvals|audit` and `POST /api/workflows[/:id/advance|cancel|retry|recover|approve|reject]`.
- **Identity** (`src/server/auth.ts`): Cloudflare Access JWT verified server-side (RS256, JWKS, iss, aud, exp). Roles come from `EUREKA_VIEWERS/OPERATORS/APPROVERS`. Unconfigured -> 503 (closed). Approver identity is always the verified email; body identity is ignored. POSTs require same-origin `Origin`.
- **GitHub** (`src/server/github.ts`): allowlisted repos; writes only to non-default `eureka/*` branches; draft PRs only; no merge/delete/force methods.
- **Sandbox** (`src/server/sandbox.ts`, `src/sandbox/docker-runner.ts`, `scripts/sandbox-service.mjs`): the Worker never runs generated code; it calls a remote runner (Docker: no network, read-only, caps dropped, pids/memory/cpu limits, timeout kill). Only `node --test` is allowed.
- **Workflow `builder-delivery-v1`** (the only pipeline that can generate source files): builder-submit -> builder-plan -> **plan-approval (human)** -> builder-generation -> **files-approval (human)** -> branch -> commit -> testing -> draft pull request. See `TINANAI_INTEGRATION_CONTRACT.md` for the Builder contract and security model.
- **Workflow `pr-delivery-v1`** (legacy, planning only): requirements -> architecture -> plan-approval -> branch -> generation -> testing -> draft pull request. It has **no generation executor**: TINAN AI agent tasks return a plan and summary, never files, and a summary is never parsed as source code. The workflow blocks at `generation` with a message pointing to `builder-delivery-v1`; no branch, commit or PR is created. The old `parseGeneratedFiles` path was removed.
- Every stage has a verifier that re-checks the real result (Builder plan digest, file manifest, GitHub read-back by SHA-256, test exit code + a non-zero pass count, PR draft/open state). Missing configuration blocks the stage (`builderUnavailable` in `src/server/api.ts`); nothing is simulated.
- **Control Center** reads only these authenticated routes and shows 401/403/503 honestly.

## Environment variable names
Names only: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, `EUREKA_APPROVERS`, `GITHUB_TOKEN`, `GITHUB_ALLOWED_REPOS`, `SANDBOX_URL`, `SANDBOX_TOKEN`, `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD`, `TINANAI_BUILDER_ENABLED` (must be exactly `true`; default off). D1 needs a `DB` binding with a real `database_id` (owner step, see `PERSISTENCE.md`); apply migrations `0001` and `0002`.

## Roadmap
1. **Phase 2 follow-ups:** live verification of D1/GitHub/TinanAi, security-review executor, Queues/DO for long stages, CI status inspection.
2. **Phase 3:** Launchpad / Data Layer / Marketplace contracts (see `ECOSYSTEM_INTEGRATIONS.md`).
3. **Phase 4:** deployment coordination, monitoring, knowledge retrieval.
