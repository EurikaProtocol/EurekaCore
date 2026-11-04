import type { ReplayGuard } from '../core/approval';
import type { TaskStatus } from '../core/agent';
import type { TaskRecord, TaskStore } from '../core/task';
import { buildAuditEntry, type AuditEntry, type AuditInput, type AuditLog } from '../core/audit';
import type { WorkflowRecord, WorkflowStore } from '../core/workflow';

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

/** Durable workflow store. Updates are one conditional UPDATE on `version`, so concurrent writers cannot both win. */
export class D1WorkflowStore implements WorkflowStore {
  readonly durable = true;
  constructor(private readonly db: D1DatabaseLike) {}

  async get(id: string): Promise<WorkflowRecord | null> {
    const row = await this.db.prepare('SELECT record_json FROM workflows WHERE id = ?').bind(id).first<{ record_json: string }>();
    return row ? (JSON.parse(row.record_json) as WorkflowRecord) : null;
  }

  async create(record: WorkflowRecord): Promise<boolean> {
    const r = await this.db
      .prepare('INSERT INTO workflows (id, version, status, record_json, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(record.id, record.version, record.status, JSON.stringify(record), record.updatedAt)
      .run();
    return changes(r) === 1;
  }

  async update(record: WorkflowRecord, expectedVersion: number): Promise<boolean> {
    const r = await this.db
      .prepare('UPDATE workflows SET version = ?, status = ?, record_json = ?, updated_at = ? WHERE id = ? AND version = ?')
      .bind(record.version, record.status, JSON.stringify(record), record.updatedAt, record.id, expectedVersion)
      .run();
    return changes(r) === 1;
  }

  async list(): Promise<WorkflowRecord[]> {
    const r = await this.db.prepare('SELECT record_json FROM workflows ORDER BY updated_at DESC LIMIT 500').all<{ record_json: string }>();
    return (r.results ?? []).map((row) => JSON.parse(row.record_json) as WorkflowRecord);
  }
}

/** Durable audit log. The primary key on `seq` serialises appends; a lost race is retried against the new tail. */
export class D1AuditLog implements AuditLog {
  readonly durable = true;
  constructor(private readonly db: D1DatabaseLike) {}

  async append(input: AuditInput): Promise<AuditEntry> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const row = await this.db.prepare('SELECT entry_json FROM audit_log ORDER BY seq DESC LIMIT 1').first<{ entry_json: string }>();
      const entry = buildAuditEntry(input, row ? (JSON.parse(row.entry_json) as AuditEntry) : null);
      const r = await this.db
        .prepare('INSERT INTO audit_log (seq, subject, entry_json) VALUES (?, ?, ?) ON CONFLICT(seq) DO NOTHING')
        .bind(entry.seq, entry.subject, JSON.stringify(entry))
        .run();
      if (changes(r) === 1) return entry;
    }
    throw new Error('Audit append failed after repeated conflicts.');
  }

  async list(subject?: string): Promise<AuditEntry[]> {
    const r = subject
      ? await this.db.prepare('SELECT entry_json FROM audit_log WHERE subject = ? ORDER BY seq LIMIT 5000').bind(subject).all<{ entry_json: string }>()
      : await this.db.prepare('SELECT entry_json FROM audit_log ORDER BY seq LIMIT 5000').all<{ entry_json: string }>();
    return (r.results ?? []).map((row) => JSON.parse(row.entry_json) as AuditEntry);
  }
}
