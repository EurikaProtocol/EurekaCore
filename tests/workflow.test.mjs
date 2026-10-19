import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('deploy workflow checks Cloudflare credentials before deploying', () => {
  const y = readFileSync('.github/workflows/npm-publish.yml', 'utf8');
  const check = y.indexOf('Check Cloudflare credentials');
  const deploy = y.indexOf('Deploy to Cloudflare Workers');
  assert.ok(check > 0 && check < deploy);
  assert.match(y, /CLOUDFLARE_API_TOKEN/);
});
