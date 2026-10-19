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
