import assert from 'node:assert/strict';
import test from 'node:test';
import { scanDiff, scanPaths } from '../scripts/secret-scan.mjs';

test('env, key and tool-state files are blocked; .env.example is allowed', () => {
  const bad = scanPaths(['.env', 'app/.env.local', 'keys/server.pem', '.dev.vars', '.vercel/project.json', '.env.example', 'src/a.ts']);
  assert.deepEqual(bad.map((b) => b.file), ['.env', 'app/.env.local', 'keys/server.pem', '.dev.vars', '.vercel/project.json']);
});

test('secret-looking added lines are blocked, removed lines and placeholders are not', () => {
  const tok = 'ghp_' + 'A1b2'.repeat(10);
  const diff = ['+++ b/src/x.ts', `+const t = "${tok}";`, '+-----BEGIN ' + 'PRIVATE KEY-----', `-const old = "${tok}";`, '+const ok = process.env.VERCEL_TOKEN;', '+PASSWORD=changeme'].join('\n');
  const f = scanDiff(diff);
  assert.equal(f.length, 2);
  assert.ok(f.every((x) => x.file === 'src/x.ts'));
  assert.ok(!JSON.stringify(f).includes(tok), 'findings never echo the secret');
});
