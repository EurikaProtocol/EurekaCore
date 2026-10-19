#!/usr/bin/env node
// Runs `npm audit --json` and fails on any high/critical advisory that is not in security/audit-baseline.json.
// Known advisories are always printed, never hidden. Network access to the npm registry is required.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function evaluateAudit(report, baseline) {
  const accepted = new Set(baseline.accepted ?? []);
  const vulns = report.vulnerabilities ?? {};
  const serious = Object.entries(vulns).filter(([, v]) => ['high', 'critical'].includes(v.severity)).map(([name]) => name).sort();
  return { serious, known: serious.filter((n) => accepted.has(n)), unknown: serious.filter((n) => !accepted.has(n)), stale: [...accepted].filter((n) => !serious.includes(n)).sort() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let report;
  try { report = JSON.parse(run.stdout); } catch { console.error('npm audit did not return JSON (registry unreachable?). Failing closed.'); process.exit(2); }
  if (report.error) { console.error(`npm audit error: ${report.error.summary ?? report.error.code}. Failing closed.`); process.exit(2); }
  const baseline = JSON.parse(readFileSync(new URL('../security/audit-baseline.json', import.meta.url), 'utf8'));
  const r = evaluateAudit(report, baseline);
  console.log(`Total advisories by severity: ${JSON.stringify(report.metadata?.vulnerabilities ?? {})}`);
  console.log(`High/critical packages: ${r.serious.length} (accepted baseline: ${r.known.length}, NEW: ${r.unknown.length})`);
  if (r.known.length) console.log(`Accepted (unresolved) high/critical: ${r.known.join(', ')}`);
  if (r.stale.length) console.log(`Baseline entries no longer reported (remove them): ${r.stale.join(', ')}`);
  if (r.unknown.length) { console.error(`FAIL: new high/critical advisories: ${r.unknown.join(', ')}`); process.exit(1); }
}
