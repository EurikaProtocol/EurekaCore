import test from 'node:test';
import assert from 'node:assert/strict';
import { missingDeployEnv } from '../scripts/check-deploy-env.mjs';

test('reports all missing credentials', () => {
  assert.deepEqual(missingDeployEnv({}), ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']);
});
test('treats blank values as missing', () => {
  assert.deepEqual(missingDeployEnv({ CLOUDFLARE_API_TOKEN: ' ', CLOUDFLARE_ACCOUNT_ID: 'x' }), ['CLOUDFLARE_API_TOKEN']);
});
test('passes when set', () => {
  assert.deepEqual(missingDeployEnv({ CLOUDFLARE_API_TOKEN: 'a', CLOUDFLARE_ACCOUNT_ID: 'b' }), []);
});

import { readFileSync } from 'node:fs';
test('deploy scripts pin the authoritative wrangler config', () => {
  const s = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).scripts;
  assert.match(s.deploy, /--config wrangler\.toml/);
  assert.match(s['deploy:check'], /--dry-run --config wrangler\.toml/);
});
