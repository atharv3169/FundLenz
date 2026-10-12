import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploy, transientFailure } from './deploy-with-retry.mjs';

test('the observed Cloudflare 504 retries the same artifact and can recover', async () => {
  let calls = 0; const waits = [];
  const code = await deploy((cmd, args) => {
    assert.equal(cmd, 'wrangler');
    assert.deepEqual(args, ['deploy', '--config', 'dist/server/wrangler.json']);
    return ++calls === 1 ? { status: 1, stderr: 'GET /workers/services/fundlenz -> 504 Gateway Timeout' } : { status: 0 };
  }, async ms => waits.push(ms));
  assert.equal(code, 0); assert.equal(calls, 2); assert.deepEqual(waits, [15000]);
});

test('transient failures stop after three total attempts', async () => {
  let calls = 0;
  assert.equal(await deploy(() => { calls++; return { status: 1, stderr: '503 Service Unavailable' }; }, async () => {}), 1);
  assert.equal(calls, 3);
});

test('permissions, quotas, validation failures and killed processes do not retry', async () => {
  for (const result of [{status: 1, stderr: '403 Forbidden'}, {status: 1, stderr: '429 quota exceeded'},
    {status: 1, stderr: 'Invalid binding'}, {status: null, signal: 'SIGTERM', stderr: '504 Gateway Timeout'}]) {
    let calls = 0;
    assert.equal(await deploy(() => { calls++; return result; }, async () => {throw Error('unexpected retry');}), 1);
    assert.equal(calls, 1);
  }
  assert.equal(transientFailure('Invalid value 504'), false);
});
