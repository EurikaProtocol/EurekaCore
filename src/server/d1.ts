import type { ReplayGuard } from '../core/approval';
import type { TaskStatus } from '../core/agent';
import type { TaskRecord, TaskStore } from '../core/task';

/** The subset of the Cloudflare D1 API used here (structurally compatible with `D1Database`). */
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
}
export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

function changes(result: { meta?: { changes?: number } }): number {
  const n = result.meta?.changes;
  if (typeof n !== 'number') throw new Error('D1 did not report the number of changed rows; refusing to continue.');
  return n;
}

/** Durable task store. Every state change is a single conditional UPDATE, so concurrent writers cannot both win. */
export class D1TaskStore implements TaskStore {
  readonly durable = true;
  constructor(private readonly db: D1DatabaseLike) {}

  async get(id: string): Promise<TaskRecord | null> {
    const row = await this.db.prepare('SELECT record_json FROM agent_tasks WHERE id = ?').bind(id).first<{ record_json: string }>();
    return row ? (JSON.parse(row.record_json) as TaskRecord) : null;
  }

  async create(record: TaskRecord): Promise<boolean> {
    const r = await this.db
      .prepare('INSERT INTO agent_tasks (id, status, record_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(record.request.id, record.status, JSON.stringify(record), record.updatedAt)
      .run();
    return changes(r) === 1;
  }

  async update(record: TaskRecord, expected: TaskStatus): Promise<boolean> {
    const r = await this.db
      .prepare('UPDATE agent_tasks SET status = ?, record_json = ?, updated_at = ? WHERE id = ? AND status = ?')
      .bind(record.status, JSON.stringify(record), record.updatedAt, record.request.id, expected)
      .run();
    return changes(r) === 1;
  }

  async list(): Promise<TaskRecord[]> {
    const r = await this.db.prepare('SELECT record_json FROM agent_tasks ORDER BY updated_at DESC LIMIT 500').all<{ record_json: string }>();
    return (r.results ?? []).map((row) => JSON.parse(row.record_json) as TaskRecord);
  }
}

/** Durable single-use approval nonces. The primary key makes `consume` atomic: exactly one concurrent caller gets `true`. */
export class D1ReplayGuard implements ReplayGuard {
  readonly durable = true;
  constructor(private readonly db: D1DatabaseLike, private readonly clock: () => string = () => new Date().toISOString()) {}

  async consume(nonce: string, expiresAt: string): Promise<boolean> {
    const r = await this.db
      .prepare('INSERT INTO approval_nonces (nonce, expires_at, consumed_at) VALUES (?, ?, ?) ON CONFLICT(nonce) DO NOTHING')
      .bind(nonce, expiresAt, this.clock())
      .run();
    return changes(r) === 1;
  }

  /** Removes records whose approval can no longer pass the expiry check. Safe to call periodically. */
  async purgeExpired(olderThan: string = this.clock()): Promise<number> {
    return changes(await this.db.prepare('DELETE FROM approval_nonces WHERE expires_at < ?').bind(olderThan).run());
  }
}
