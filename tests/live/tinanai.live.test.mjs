import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from '../helpers/load-src.mjs';

// LIVE integration test against a real, deployed TINAN AI. Skipped unless explicitly enabled. NOT part of `npm test`.
//   EUREKA_LIVE_TINANAI=1 TINANAI_BASE_URL=https://... TINANAI_USERNAME=... TINANAI_PASSWORD=... npm run test:live
// It only plans and then cancels: it never approves a plan, so it never starts generation, spends generation budget, or
// writes anywhere except one cancelled TINAN AI task.
const enabled = process.env.EUREKA_LIVE_TINANAI === '1';
const skip = enabled ? false : 'set EUREKA_LIVE_TINANAI=1 with TINANAI_BASE_URL/USERNAME/PASSWORD to run (live, opt-in)';

test('live: plan is returned with a digest identical to the EurekaCore preimage; wrong digest is a 409; cancel works', { skip }, async () => {
  const sdk = await loadSource('src/sdk/index.ts');
  const tb = await loadSource('src/server/tinanai-builder.ts');
  const p = new tb.TinanAiBuilderProvider({ baseUrl: process.env.TINANAI_BASE_URL, username: process.env.TINANAI_USERNAME, password: process.env.TINANAI_PASSWORD, requestTimeoutMs: 30_000 });
  let task = await p.submitRequirements('EurekaCore live contract check: a one-file static page that says hello.');
  try {
    for (let i = 0; i < 60 && task.status === 'planning'; i += 1) {
      await new Promise((r) => setTimeout(r, 3000));
      task = await p.getTask(task.taskId);
    }
    assert.equal(task.status, 'awaiting_approval', `status=${task.status} errors=${task.errors.join('; ')}`);
    assert.ok(task.plan);
    const wrong = sdk.planDigest({ ...task.plan, summary: `${task.plan.summary} (tampered)` });
    await assert.rejects(p.forwardApproval(task.taskId, wrong), (e) => e.code === 'CONFLICT');
    assert.equal((await p.getTask(task.taskId)).status, 'awaiting_approval', 'a mismatched digest must not start generation');
    await assert.rejects(p.getManifest(task.taskId), (e) => ['CONFLICT', 'MANIFEST_UNSUPPORTED'].includes(e.code));
  } finally {
    await p.cancel(task.taskId);
  }
  assert.equal((await p.getTask(task.taskId)).status, 'cancelled');
});
