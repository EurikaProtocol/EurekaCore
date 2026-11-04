import type { D1DatabaseLike } from './d1';

/** Exact columns and indexes that migrations 0001 and 0002 must have produced. Anything else is an incompatible schema. */
export const EXPECTED_SCHEMA: Record<string, { columns: Record<string, { type: string; notnull: boolean; pk: boolean }>; indexes: string[] }> = {
  agent_tasks: {
    columns: { id: { type: 'TEXT', notnull: false, pk: true }, status: { type: 'TEXT', notnull: true, pk: false }, record_json: { type: 'TEXT', notnull: true, pk: false }, updated_at: { type: 'TEXT', notnull: true, pk: false } },
    indexes: ['agent_tasks_status'],
  },
  approval_nonces: {
    columns: { nonce: { type: 'TEXT', notnull: false, pk: true }, expires_at: { type: 'TEXT', notnull: true, pk: false }, consumed_at: { type: 'TEXT', notnull: true, pk: false } },
    indexes: ['approval_nonces_expiry'],
  },
  workflows: {
    columns: {
      id: { type: 'TEXT', notnull: false, pk: true }, version: { type: 'INTEGER', notnull: true, pk: false }, status: { type: 'TEXT', notnull: true, pk: false },
      record_json: { type: 'TEXT', notnull: true, pk: false }, updated_at: { type: 'TEXT', notnull: true, pk: false },
    },
    indexes: ['workflows_status'],
  },
  audit_log: {
    columns: { seq: { type: 'INTEGER', notnull: false, pk: true }, subject: { type: 'TEXT', notnull: true, pk: false }, entry_json: { type: 'TEXT', notnull: true, pk: false } },
    indexes: ['audit_log_subject'],
  },
};

export type SchemaReport = { compatible: boolean; problems: string[] };

/** Read-only check. A missing table, column mismatch or missing index is reported, never repaired or ignored. */
export async function verifySchema(db: D1DatabaseLike): Promise<SchemaReport> {
  const problems: string[] = [];
  for (const [table, spec] of Object.entries(EXPECTED_SCHEMA)) {
    const cols = (await db.prepare(`SELECT name, type, "notnull" AS nn, pk FROM pragma_table_info('${table}')`).all<{ name: string; type: string; nn: number; pk: number }>()).results ?? [];
    if (cols.length === 0) { problems.push(`table ${table} is missing`); continue; }
    const byName = new Map(cols.map((c) => [c.name, c]));
    for (const [name, want] of Object.entries(spec.columns)) {
      const got = byName.get(name);
      if (!got) { problems.push(`${table}.${name} is missing`); continue; }
      if (got.type.toUpperCase() !== want.type) problems.push(`${table}.${name} has type ${got.type}, expected ${want.type}`);
      if (want.notnull && !got.nn) problems.push(`${table}.${name} must be NOT NULL`);
      if (want.pk !== (got.pk > 0)) problems.push(`${table}.${name} primary-key mismatch`);
    }
    for (const name of byName.keys()) if (!(name in spec.columns)) problems.push(`${table}.${name} is an unexpected column`);
    const idx = (await db.prepare(`SELECT name FROM pragma_index_list('${table}')`).all<{ name: string }>()).results ?? [];
    for (const want of spec.indexes) if (!idx.some((i) => i.name === want)) problems.push(`index ${want} is missing`);
  }
  return { compatible: problems.length === 0, problems };
}
