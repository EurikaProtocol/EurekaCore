# EurekaCore architecture

**As audited:** `main` at `d87dfe022bf39b20041154b2bf1674a9321cf7d6` (2026-11-04).

## Runtime shape

```text
Browser
  ├─ Vite-built React/TypeScript SPA (`index.html`, `src/`)
  ├─ compatibility HTML/static content (`eureka-legacy.html`, `public/`)
  └─ HTTPS → Cloudflare Worker (`cloudflare/worker.js`)
                 ├─ `/api/*` → `src/server/api.ts`
                 └─ other paths → static assets binding `ASSETS` (`dist/`)
```

The production artifact is built by Vite; Cloudflare serves `dist/` through the Worker. `wrangler.toml` makes `/api/*` worker-first and configures the SPA fallback. The API returns JSON rather than falling through to static assets.

## Responsibilities

| Boundary | Location | Responsibility and current limits |
|---|---|---|
| Frontend | `src/App.tsx`, `src/pages/`, `src/components/`, `src/hooks/` | Route composition, page UI, wallet interaction, and local/browser state. React routes include wallet, data assets, projects, token/product surfaces, approvals, and control center. |
| Compatibility frontend | `eureka-legacy.html`, root legacy scripts/styles, `public/pages/` and `public/assets/` | Separately built legacy landing and static pages. Keep distinct from React imports unless a tested migration replaces them. |
| Shared business logic | `src/core/` | Validation, permission ceilings, approval/workflow/task state machines, audit records, proof and asset logic. |
| Chain integrations | `src/sdk/`, `src/solana/`, `src/lib/`, wallet hooks | EVM/Solana wallet and transaction boundaries. The browser uses public configuration only; it does not hold server secrets. |
| API and authorization | `cloudflare/worker.js`, `src/server/api.ts`, `src/server/auth.ts` | Worker-first API dispatch, Cloudflare Access JWT signature/issuer/audience/time checks, server allowlist role assignment, request validation, same-origin write checks, and per-isolate write throttling. |
| Persistence | `src/server/d1.ts`, `src/server/schema.ts`, `migrations/` | D1 adapters and schema checks for tasks, approvals, workflows, and audit entries. The production config currently has no `DB` binding, so durable API operations are unavailable. |
| External services | `src/server/github.ts`, `src/server/tinanai-provider.ts`, `src/server/sandbox.ts`, `src/server/executors.ts` | Optional server-side GitHub, TINAN AI, and sandbox capabilities. Missing config disables capabilities rather than substituting production mocks. |
| Deployment | `wrangler.toml`, `.github/workflows/cloudflare-deploy.yml`, npm scripts | One authoritative Wrangler config; CI verifies PRs and deploys from `main` only after verification. |

## API lifecycle and access

Requests under `/api/` are handled before static assets. Authentication is verified from `Cf-Access-Jwt-Assertion`; identity is not accepted from request bodies or ordinary identity headers. `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, and `EUREKA_APPROVERS` grant roles server-side. Writes additionally require an exact same-origin `Origin` and are throttled in each isolate. Missing Access configuration fails closed; missing D1 returns 503 for persistent operations.

The API currently includes session and product reads, integration/schema reporting, workflow and approval reads, audit reads, and operator/approver workflow writes. The exact live availability depends on unconfigured/unknown Cloudflare bindings and secrets.

## Persistence and migrations

`0001_core_state.sql` creates task and approval-nonce tables; `0002_workflows_audit.sql` creates workflow and audit-log tables. They use `CREATE ... IF NOT EXISTS`, are ordered, and are exercised against local D1 in tests. No production database ID is present. Applying migrations remotely requires an existing approved database and owner review; this repository audit did not execute remote commands.

## Important product boundaries

- Data-asset records are browser-local; a wallet signature records authorization of a statement and is not independent proof of an external action or legal ownership.
- Some project, marketplace, energy, and approval surfaces are explicitly demos/previews or do not execute external actions.
- Product and integration status shown by the UI must not be interpreted as a live external service unless the server probe actually verifies it.

## Consolidation guidance

Keep UI, API/auth, persistence, integrations, and business logic within the existing boundaries. The current build contains both React and compatibility static surfaces; consolidate them only after tracing links, build outputs, and runtime behavior. No framework replacement or dependency addition is justified by this audit.
