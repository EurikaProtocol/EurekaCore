import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudit } from '../scripts/audit-check.mjs';

test('audit evaluation flags only high/critical packages missing from the baseline', () => {
  const report = { vulnerabilities: { a: { severity: 'high' }, b: { severity: 'critical' }, c: { severity: 'moderate' }, d: { severity: 'high' } } };
  const r = evaluateAudit(report, { accepted: ['a', 'gone'] });
  assert.deepEqual(r.unknown, ['b', 'd']);
  assert.deepEqual(r.known, ['a']);
  assert.deepEqual(r.stale, ['gone']);
  assert.deepEqual(evaluateAudit({}, { accepted: [] }).unknown, []);
});
