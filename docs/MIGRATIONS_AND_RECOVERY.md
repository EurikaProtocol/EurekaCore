# D1 migrations, compatibility checks and recovery

## Schema
Migrations `0001_core_state.sql` and `0002_workflows_audit.sql` create `agent_tasks`, `approval_nonces`, `workflows` and `audit_log` (with indexes). All statements are `IF NOT EXISTS` and purely additive: they never drop, rename or rewrite data, so applying them to an existing database cannot destroy rows.

## Compatibility check
`IF NOT EXISTS` would silently skip a same-named table that has a different shape. `src/server/schema.ts` (`verifySchema`) therefore compares the live schema (columns, types, NOT NULL, primary keys, indexes, unexpected columns) with the expected one. `GET /api/integrations` reports `database: unhealthy` with the first problems when it does not match. It is read-only and never repairs. Tests: `tests/schema.test.mjs`.

## Before applying remotely (owner action, needs approval)
1. Take the owner's verified D1 inventory; never create a replacement database if one may hold data.
2. Export a backup: `npx wrangler d1 export <DB_NAME> --remote --output backup.sql`.
3. Review pending: `npx wrangler d1 migrations list DB --remote --config wrangler.toml` (after the real `database_id` is added to `wrangler.toml`).
4. Apply: `npx wrangler d1 migrations apply DB --remote --config wrangler.toml`.
5. Open `/api/integrations` as a Viewer; `database` must be `healthy`.

## Recovery
- Migrations are additive; to roll back the schema on a fresh database drop in reverse order: `audit_log`, `workflows`, `approval_nonces`, `agent_tasks`. Never do this on a database with data without the backup.
- Restore: `npx wrangler d1 execute DB --remote --file backup.sql` into an empty database. D1 Time Travel (`wrangler d1 time-travel restore`) can also restore a point in time.
- Future schema changes must be new numbered migrations, never edits of applied ones.

## Not verified
Nothing here has been run against a remote D1 database. Tests use local D1 (Miniflare) and a SQLite shim.
