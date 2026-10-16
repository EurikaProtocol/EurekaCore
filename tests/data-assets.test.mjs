import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Wallet } from 'ethers';
import {
  MAX_DATA_ASSET_BYTES,
  isDataAssetRecord,
  isDataProofRecord,
  normalizeDataAssetRecord,
  normalizeDataProofRecord,
  prepareTokenization,
  sha256,
  sha256Text,
  validateDataAsset,
  verifySignedAction,
} from '../src/core/data-assets.ts';

const HASH = 'a'.repeat(64);
const createdAt = '2026-01-01T00:00:00.000Z';

function asset(overrides = {}) {
  return {
    id: 'asset-1',
    owner: null,
    type: 'document',
    name: 'Evidence',
    description: '',
    size: 1,
    mimeType: 'application/pdf',
    hash: HASH,
    timestamp: createdAt,
    metadata: { originalFileName: 'evidence.pdf' },
    storageReference: null,
    proofId: 'proof-1',
    tokenId: null,
    network: null,
    transactionHash: null,
    verificationStatus: 'hash-recorded',
    createdAt,
    ...overrides,
  };
}

test('SHA-256 helpers produce deterministic lowercase digests', async () => {
  const expected = createHash('sha256').update('eureka').digest('hex');
  assert.equal(await sha256Text('eureka'), expected);
  assert.equal(await sha256(new TextEncoder().encode('eureka')), expected);
});

test('data asset validation accepts supported files within bounds', () => {
  const file = { name: 'readme.pdf', type: 'application/pdf', size: MAX_DATA_ASSET_BYTES };
  assert.equal(validateDataAsset(file, 'Readme', ''), 'document');
  assert.throws(
    () => validateDataAsset({ ...file, size: MAX_DATA_ASSET_BYTES + 1 }, 'Readme', ''),
    /25 MB or smaller/,
  );
  assert.throws(
    () => validateDataAsset({ ...file, name: 'unknown.bin' }, 'Readme', ''),
    /supported image, document/,
  );
});

test('record validators reject malformed and semantically inconsistent data', () => {
  assert.equal(isDataAssetRecord(asset()), true);
  assert.equal(isDataAssetRecord(asset({ hash: 'not-a-hash' })), false);
  assert.equal(isDataAssetRecord(asset({ size: MAX_DATA_ASSET_BYTES + 1 })), false);
  assert.equal(normalizeDataAssetRecord(asset({ owner: '0x1234' })).owner, null);

  assert.equal(isDataProofRecord({
    id: 'proof-1',
    type: 'data',
    assetId: 'asset-1',
    hash: HASH,
    timestamp: createdAt,
    owner: null,
    signature: null,
    metadata: {},
    status: 'integrity-verified',
  }), true);
  assert.equal(isDataProofRecord({
    id: 'proof-2',
    type: 'action',
    assetId: 'asset-1',
    hash: HASH,
    timestamp: createdAt,
    owner: null,
    signature: null,
    metadata: {},
    status: 'signature-verified',
  }), false);

  assert.equal(normalizeDataProofRecord({
    id: 'legacy-proof',
    type: 'knowledge',
    assetId: 'asset-1',
    hash: HASH,
    timestamp: createdAt,
    owner: '0x1234',
    signature: null,
    metadata: {},
    status: 'recorded',
  }).owner, null);
});

test('signed action verification binds message hash, signer, type, and status', async () => {
  const wallet = Wallet.createRandom();
  const message = `EUREKA PROOF OF ACTION\nStatement authorization only\nOwner: ${wallet.address}\nAsset ID: asset-1\nAsset SHA-256: ${HASH}\nAction: reviewed`;
  const signature = await wallet.signMessage(message);
  const proof = {
    id: 'proof-action',
    type: 'action',
    assetId: 'asset-1',
    hash: await sha256Text(message),
    timestamp: createdAt,
    owner: wallet.address,
    signature,
    metadata: { message },
    status: 'signature-verified',
  };

  assert.equal(await verifySignedAction(proof), true);
  assert.equal(await verifySignedAction({ ...proof, hash: HASH }), false);
  assert.equal(await verifySignedAction({ ...proof, owner: Wallet.createRandom().address }), false);
  assert.equal(await verifySignedAction({ ...proof, type: 'data' }), false);
  assert.equal(await verifySignedAction({ ...proof, status: 'recorded' }), false);
  assert.equal(await verifySignedAction({ ...proof, metadata: { message: `${message}\ntampered` } }), false);
  assert.equal(await verifySignedAction({ ...proof, metadata: { message: message.replace(wallet.address, Wallet.createRandom().address) } }), false);
});

test('tokenization preparation is metadata-only and does not attribute an owner', () => {
  const prepared = prepareTokenization(asset(), []);
  assert.equal(prepared.status, 'metadata-prepared');
  assert.equal(prepared.metadata.owner, null);
  assert.equal(prepared.tokenId, null);
  assert.equal(prepared.transactionHash, null);
});
