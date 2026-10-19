# Durable task and approval storage

## What exists
- `migrations/0001_core_state.sql`: tables `agent_tasks` (task record, status, JSON request/result) and `approval_nonces` (nonce primary key, expiry).
- `src/server/d1.ts`: `D1TaskStore` (updates are one conditional `UPDATE ... WHERE status = ?`, so a cancel and a completion race to exactly one winner) and `D1ReplayGuard` (`INSERT ... ON CONFLICT DO NOTHING`, accepted only if `meta.changes === 1`, so concurrent requests with one nonce yield one success). Storage errors make `authorizeAction` return `UNAVAILABLE` (fail closed). Both report `durable = true`.
- `InMemoryTaskStore` / `InMemoryReplayGuard` report `durable = false`, are for deterministic tests only, and lose all state on restart.

## What is verified
Tests (`tests/persistence.test.mjs`) run the real SQL against SQLite via `node:sqlite`: restart persistence (file reopened), duplicate submit, parallel nonce consumption, cancel-vs-complete, expiry/purge, and storage failure. SQLite is **not** Cloudflare D1. Real D1 concurrency and latency are **unverified**; the design relies only on single-statement atomicity, which D1 provides per statement.

## What is NOT done (owner steps)
Nothing is bound in `wrangler.toml` and no Worker route uses these classes, because a D1 binding needs a real `database_id` that must not be invented. To enable:
1. `wrangler d1 create <name>` and add the `[[d1_databases]]` binding (e.g. `DB`) with the real ID to `wrangler.toml`.
2. `wrangler d1 migrations apply <name>` using `migrations/`.
3. Set `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD` as Worker secrets.
4. Decide and implement authentication for any Worker route that exposes the agent, then wire `TaskManager(new D1TaskStore(env.DB))` and `new D1ReplayGuard(env.DB)`. Periodically call `purgeExpired`.

Until then no durable replay protection is active in any deployment.
