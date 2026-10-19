import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet } from 'ethers';
import { loadSource } from './helpers/load-src.mjs';

const sdk = await loadSource('src/sdk/index.ts');
const HASH = '0x' + 'a'.repeat(64);
const ADDR = '0x' + '1'.repeat(40);
const SOL_A = '11111111111111111111111111111111';
const SOL_B = 'So11111111111111111111111111111111111111112';

test('SDK exports the supported public surface', () => {
  for (const name of [
    'CoreError', 'ok', 'fail', 'createEcosystemAssets', 'validateEcosystemAsset', 'createDataProofDraft',
    'validateDataProofRecord', 'advanceDataProof', 'verifyProof', 'validateDeviceMetadata', 'verifyDeviceAttestation',
    'proposeTransaction', 'markSubmitted', 'markConfirmed', 'markFailed', 'EVMAdapter', 'SolanaAdapter',
    'buildSolTransferTransaction', 'proposeSolTransfer', 'readEkaWalletSnapshot', 'readSolanaWalletSnapshot',
  ]) assert.equal(typeof sdk[name], 'function', name);
});

test('assets: ready asset needs valid address for its chain family', () => {
  const [eka, tinan] = sdk.createEcosystemAssets({
    eka: { name: 'Eureka', symbol: 'EKA', chainName: 'Ethereum', contractAddress: ADDR },
    tinanai: { network: 'devnet', mintAddress: null },
  });
  assert.equal(sdk.validateEcosystemAsset(eka).ok, true);
  assert.equal(tinan.status, 'needs-config');
  assert.equal(sdk.validateEcosystemAsset(tinan).ok, true);
  assert.equal(sdk.validateEcosystemAsset({ ...eka, location: 'nope' }).ok, false);
  assert.equal(sdk.validateEcosystemAsset({ ...eka, symbol: ' ' }).ok, false);
  assert.equal(sdk.validateEcosystemAsset({ ...eka, type: 'Bitcoin' }).error.code, 'UNSUPPORTED');
  assert.equal(sdk.validateEcosystemAsset({ ...tinan, status: 'ready', location: SOL_B }).ok, true);
});

test('data proof drafts reject malformed input and start as SUBMITTED', () => {
  assert.throws(() => sdk.createDataProofDraft({ dataHash: '0x12', source: 's', projectId: 'p' }));
  assert.throws(() => sdk.createDataProofDraft({ dataHash: HASH, source: ' ', projectId: 'p' }));
  assert.throws(() => sdk.createDataProofDraft({ dataHash: HASH, source: 's', projectId: 'p', timestamp: 'yesterday' }));
  const d = sdk.createDataProofDraft({ dataHash: HASH, source: ' s ', projectId: 'p' });
  assert.equal(d.verificationStatus, 'SUBMITTED');
  assert.equal(d.blockchainTransaction, null);
  assert.equal(d.source, 's');
  assert.equal(sdk.validateDataProofRecord(d).ok, true);
});

test('data proof status transitions require real evidence', () => {
  const d = sdk.createDataProofDraft({ dataHash: HASH, source: 's', projectId: 'p' });
  assert.equal(sdk.advanceDataProof(d, 'ANCHORED', { transaction: 'x' }).error.code, 'INVALID_TRANSITION');
  const v = sdk.advanceDataProof(d, 'VERIFIED');
  assert.equal(v.value.verificationStatus, 'VERIFIED');
  assert.equal(sdk.advanceDataProof(v.value, 'ANCHORED').ok, false);
  const a = sdk.advanceDataProof(v.value, 'ANCHORED', { transaction: 'sig' });
  assert.equal(a.value.blockchainTransaction, 'sig');
  assert.equal(sdk.advanceDataProof(a.value, 'VERIFIED').error.code, 'INVALID_TRANSITION');
  assert.equal(sdk.validateDataProofRecord({ ...d, blockchainTransaction: 'sig' }).ok, false);
  assert.equal(sdk.validateDataProofRecord({ ...d, verificationStatus: 'ANCHORED' }).ok, false);
  assert.equal(sdk.validateDataProofRecord(null).ok, false);
});

test('verifyProof: data hash match, mismatch, signature, unsupported', async () => {
  const bytes = new TextEncoder().encode('hello');
  const hash = await sdk.sha256(bytes);
  const base = { id: 'p1', assetId: 'a1', hash, timestamp: '2026-01-01T00:00:00.000Z', owner: null, signature: null, metadata: {}, status: 'recorded' };
  const good = await sdk.verifyProof({ ...base, type: 'data' }, bytes);
  assert.equal(good.value.checked, 'sha256-match');
  assert.equal((await sdk.verifyProof({ ...base, type: 'data' }, new TextEncoder().encode('other'))).ok, false);
  assert.equal((await sdk.verifyProof({ ...base, type: 'data' })).error.code, 'INVALID_INPUT');
  assert.equal((await sdk.verifyProof({ ...base, type: 'knowledge' })).error.code, 'UNSUPPORTED');
  assert.equal((await sdk.verifyProof({ ...base, type: 'action' })).ok, false);

  const wallet = Wallet.createRandom();
  const message = ['EUREKA PROOF OF ACTION', 'Time: t', `Owner: ${wallet.address}`, 'Asset ID: a1', `Asset SHA-256: ${'b'.repeat(64)}`, 'Action: did a thing'].join('\n');
  const signature = await wallet.signMessage(message);
  const action = { ...base, type: 'action', hash: await sdk.sha256Text(message), owner: wallet.address, signature, metadata: { message }, status: 'signature-verified' };
  assert.equal((await sdk.verifyProof(action)).value.checked, 'wallet-signature');
  assert.equal((await sdk.verifyProof({ ...action, owner: Wallet.createRandom().address })).ok, false);
});

test('device metadata validation and attestation never self-succeeds', async () => {
  const device = { id: 'meter-1', kind: 'smart-meter', manufacturer: null, model: 'X', registeredAt: '2026-01-01T00:00:00Z' };
  assert.equal(sdk.validateDeviceMetadata(device).ok, true);
  assert.equal(sdk.validateDeviceMetadata({ ...device, id: 'bad id!' }).ok, false);
  assert.equal(sdk.validateDeviceMetadata({ ...device, kind: 'toaster' }).error.code, 'UNSUPPORTED');
  assert.equal(sdk.validateDeviceMetadata({ ...device, model: '' }).ok, false);
  assert.equal(sdk.validateDeviceMetadata({ ...device, registeredAt: 'x' }).ok, false);
  assert.equal(sdk.validateDeviceMetadata(undefined).ok, false);
  const none = await sdk.verifyDeviceAttestation(device, new Uint8Array());
  assert.equal(none.error.code, 'UNAVAILABLE');
  const provider = { verify: async (d) => sdk.ok({ deviceId: d.id, attestedAt: '2026-01-02T00:00:00Z' }) };
  assert.equal((await sdk.verifyDeviceAttestation(device, new Uint8Array(), provider)).value.deviceId, 'meter-1');
  assert.equal((await sdk.verifyDeviceAttestation({ ...device, id: '' }, new Uint8Array(), provider)).ok, false);
});

test('transaction lifecycle enforces proposed -> submitted -> confirmed/failed', () => {
  const p = sdk.proposeTransaction({ family: 'EVM', network: 'Ethereum', summary: 'send' }).value;
  assert.equal(p.state, 'proposed');
  assert.equal(p.reference, null);
  assert.equal(sdk.markConfirmed(p).error.code, 'INVALID_TRANSITION');
  assert.equal(sdk.markSubmitted(p, ' ').ok, false);
  const s = sdk.markSubmitted(p, '0xabc').value;
  assert.equal(s.state, 'submitted');
  assert.equal(sdk.markSubmitted(s, '0xdef').ok, false);
  assert.equal(sdk.markConfirmed(s).value.state, 'confirmed');
  const f = sdk.markFailed(s, 'reverted').value;
  assert.equal(f.error, 'reverted');
  assert.equal(sdk.markConfirmed(f).ok, false);
  assert.equal(sdk.markFailed(p, '').ok, false);
  assert.equal(sdk.proposeTransaction({ family: 'Bitcoin', network: 'x', summary: 'y' }).error.code, 'UNSUPPORTED');
  assert.equal(sdk.proposeTransaction({ family: 'EVM', network: '', summary: 'y' }).ok, false);
  assert.equal(p.state, 'proposed');
});

test('Solana adapter builds only unsigned, valid transfers', () => {
  assert.throws(() => sdk.buildSolTransferTransaction(SOL_A, SOL_B, 0));
  assert.throws(() => sdk.buildSolTransferTransaction(SOL_A, SOL_B, 1.5));
  assert.throws(() => sdk.buildSolTransferTransaction('bad', SOL_B, 1));
  assert.equal(sdk.proposeSolTransfer('devnet', 'bad', SOL_B, 1).error.code, 'INVALID_INPUT');
  const r = sdk.proposeSolTransfer('devnet', SOL_A, SOL_B, 5).value;
  assert.equal(r.record.state, 'proposed');
  assert.equal(r.transaction.signatures.length, 0);
});

test('network adapters reject unsupported networks and invalid addresses', () => {
  assert.throws(() => new sdk.EVMAdapter(999999), (e) => e.code === 'UNSUPPORTED');
  const evm = new sdk.EVMAdapter(1);
  assert.equal(evm.getAddressExplorerUrl('nope'), null);
  assert.match(evm.getAddressExplorerUrl(ADDR), /^https:\/\/etherscan\.io\/address\//);
  const sol = new sdk.SolanaAdapter('devnet');
  assert.equal(sol.getAddressExplorerUrl('nope'), null);
  assert.match(sol.getAddressExplorerUrl(SOL_A), /solscan\.io/);
});
