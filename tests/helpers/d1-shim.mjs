import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * D1-shaped wrapper over node:sqlite so the real SQL and migration run in tests.
 * This is NOT Cloudflare D1: it proves SQL semantics (constraints, conditional updates), not D1 behaviour or latency.
 */
export function openD1Shim(file = ':memory:', { failWrites = false } = {}) {
  const db = new DatabaseSync(file);
  const dir = new URL('../../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const stmt = (sql, values = []) => ({
    bind: (...v) => stmt(sql, v),
    async run() {
      if (failWrites) throw new Error('D1 unavailable');
      const r = db.prepare(sql).run(...values);
      return { meta: { changes: Number(r.changes) } };
    },
    async first() { return db.prepare(sql).get(...values) ?? null; },
    async all() { return { results: db.prepare(sql).all(...values) }; },
  });
  return { prepare: (sql) => stmt(sql), close: () => db.close(), raw: db };
}
