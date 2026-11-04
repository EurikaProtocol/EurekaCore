import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wf = readFileSync(new URL('../.github/workflows/cloudflare-deploy.yml', import.meta.url), 'utf8');
const deploy = wf.slice(wf.indexOf('\n  deploy:'));
const verify = wf.slice(wf.indexOf('\n  verify:'), wf.indexOf('\n  deploy:'));

test('deployment only runs on main and only for push/manual runs', () => {
  assert.match(deploy, /if: github\.ref == 'refs\/heads\/main' && \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\)/);
  assert.match(wf, /push:\s*\n\s*branches: \[main\]/);
  assert.ok(!/pull_request_target/.test(wf));
});

test('production deploys are serialised and never cancelled mid-flight', () => {
  assert.match(deploy, /concurrency:\s*\n\s*group: production-deploy-eurekacore-v3\s*\n\s*cancel-in-progress: false/);
  assert.match(deploy, /^    environment: Eureka$/m); // exact, case-sensitive name of the owner-created GitHub Environment
  assert.ok(!/environment:\s*[Pp]roduction/.test(wf), 'must not target the unrelated Production environment');
});

test('verification (build, tests, dry run, audit) gates the deploy and holds no Cloudflare secrets', () => {
  assert.match(deploy, /needs: verify/);
  assert.match(verify, /npm run verify/);
  assert.match(verify, /audit-check\.mjs/);
  assert.ok(!/secrets\./.test(verify));
});

test('credentials only come from the two GitHub secrets, only in credential/deploy steps', () => {
  assert.deepEqual([...new Set(wf.match(/secrets\.[A-Z_]+/g))].sort(), ['secrets.CLOUDFLARE_ACCOUNT_ID', 'secrets.CLOUDFLARE_API_TOKEN']);
  assert.ok(!/(CLOUDFLARE_API_TOKEN|ACCOUNT_ID):\s*[^$\s]/.test(wf), 'no hardcoded credential values');
  assert.ok(!/(echo|printenv|env\b\s*$)/m.test(wf), 'no step prints the environment');
});

test('deploy builds the commit and uses the pinned wrangler.toml scripts', () => {
  assert.ok(deploy.indexOf('run: npm run build') < deploy.indexOf('run: npm run deploy'));
  assert.ok(deploy.indexOf('check-deploy-env') < deploy.indexOf('run: npm run build'));
  assert.ok(!/wrangler (deploy|versions)/.test(wf), 'workflow must go through npm run deploy (--config wrangler.toml)');
  assert.match(wf, /^permissions:\s*\n\s*contents: read/m);
});

test('manual runs are safe: workflow_dispatch has no inputs and deploys only main', () => {
  assert.match(wf, /workflow_dispatch:\s*\n/);
  assert.ok(!/workflow_dispatch:\s*\n\s+inputs:/.test(wf), 'no user-controlled inputs');
  assert.ok(!/\$\{\{\s*(github\.event\.(inputs|head_commit|pull_request)|github\.head_ref)/.test(wf), 'no untrusted expression interpolation');
});

test('docs name the same environment as the workflow', () => {
  const doc = readFileSync(new URL('../docs/GITHUB_ACTIONS_DEPLOYMENT.md', import.meta.url), 'utf8');
  assert.match(doc, /`Eureka`/);
  assert.ok(!/environment: `?production/i.test(doc));
});
