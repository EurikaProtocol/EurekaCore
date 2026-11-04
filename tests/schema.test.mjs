import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers/load-src.mjs';
import { openD1Shim } from './helpers/d1-shim.mjs';

const { verifySchema } = await loadSource('src/server/schema.ts');

test('schema produced by migrations 0001+0002 is compatible', async () => {
  const db = openD1Shim();
  assert.deepEqual(await verifySchema(db), { compatible: true, problems: [] });
  db.close();
});

test('missing table is reported', async () => {
  const db = openD1Shim();
  db.raw.exec('DROP TABLE audit_log');
  const r = await verifySchema(db);
  assert.equal(r.compatible, false);
  assert.match(r.problems.join(), /audit_log is missing/);
});

test('same-named table with a different schema is not silently accepted', async () => {
  const db = openD1Shim();
  db.raw.exec('DROP TABLE workflows; CREATE TABLE workflows (id TEXT, data BLOB);');
  const r = await verifySchema(db);
  assert.equal(r.compatible, false);
  assert.match(r.problems.join(), /workflows\.version is missing/);
  assert.match(r.problems.join(), /workflows\.data is an unexpected column/);
  assert.match(r.problems.join(), /index workflows_status is missing/);
});

test('missing index and relaxed constraint are reported', async () => {
  const db = openD1Shim();
  db.raw.exec('DROP INDEX agent_tasks_status');
  db.raw.exec('DROP TABLE approval_nonces; CREATE TABLE approval_nonces (nonce TEXT PRIMARY KEY, expires_at TEXT, consumed_at TEXT NOT NULL); CREATE INDEX approval_nonces_expiry ON approval_nonces (expires_at);');
  const r = (await verifySchema(db)).problems.join();
  assert.match(r, /index agent_tasks_status is missing/);
  assert.match(r, /approval_nonces\.expires_at must be NOT NULL/);
});
