import { fail, isIsoTimestamp, ok, type Result } from './errors';

export type DataProofStatus = 'SUBMITTED' | 'VERIFIED' | 'ANCHORED';

export type DataProofRecord = {
  id: string;
  dataHash: string;
  timestamp: string;
  source: string;
  projectId: string;
  verificationStatus: DataProofStatus;
  blockchainTransaction: string | null;
};

export type EnergyDataSourceType = 'SMART_METER' | 'INVERTER' | 'SOLAR' | 'BATTERY' | 'GRID' | 'API' | 'IOT';

export type EnergyDataReference = {
  sourceType: EnergyDataSourceType;
  sourceReference: string;
  observedAt: string | null;
  measurement: string | null;
  unit: string | null;
  verificationStatus: DataProofStatus;
};

const DATA_HASH = /^0x[a-fA-F0-9]{64}$/;
const STATUSES: readonly DataProofStatus[] = ['SUBMITTED', 'VERIFIED', 'ANCHORED'];

export function createDataProofDraft(input: {
  dataHash: string;
  source: string;
  projectId: string;
  timestamp?: string;
}): DataProofRecord {
  if (!DATA_HASH.test(input.dataHash)) {
    throw new Error('Provide a valid 32-byte data hash before creating a proof record.');
  }
  if (!input.source.trim() || !input.projectId.trim()) {
    throw new Error('A source and project ID are required for a proof record.');
  }
  if (input.timestamp !== undefined && !isIsoTimestamp(input.timestamp)) {
    throw new Error('Proof timestamp must be an ISO-8601 timestamp.');
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `proof-${Date.now()}`,
    dataHash: input.dataHash,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source: input.source.trim(),
    projectId: input.projectId.trim(),
    verificationStatus: 'SUBMITTED',
    blockchainTransaction: null,
  };
}

/** Structural validation of a stored record. It does not verify the data or any chain state. */
export function validateDataProofRecord(value: unknown): Result<DataProofRecord> {
  const r = value as Partial<DataProofRecord> | null;
  if (!r || typeof r !== 'object') return fail('INVALID_INPUT', 'Proof record must be an object.');
  if (typeof r.id !== 'string' || !r.id) return fail('INVALID_INPUT', 'Proof record id is required.');
  if (typeof r.dataHash !== 'string' || !DATA_HASH.test(r.dataHash)) return fail('INVALID_INPUT', 'Proof record data hash is invalid.');
  if (!isIsoTimestamp(r.timestamp)) return fail('INVALID_INPUT', 'Proof record timestamp is invalid.');
  if (typeof r.source !== 'string' || !r.source.trim() || typeof r.projectId !== 'string' || !r.projectId.trim()) {
    return fail('INVALID_INPUT', 'Proof record source and project ID are required.');
  }
  if (!STATUSES.includes(r.verificationStatus as DataProofStatus)) return fail('INVALID_INPUT', 'Proof record status is unsupported.');
  if (r.blockchainTransaction !== null && (typeof r.blockchainTransaction !== 'string' || !r.blockchainTransaction)) {
    return fail('INVALID_INPUT', 'Proof record transaction must be null or a non-empty reference.');
  }
  if (r.verificationStatus === 'ANCHORED' && !r.blockchainTransaction) {
    return fail('INVALID_INPUT', 'An anchored proof must reference a transaction.');
  }
  if (r.verificationStatus !== 'ANCHORED' && r.blockchainTransaction) {
    return fail('INVALID_INPUT', 'Only an anchored proof may reference a transaction.');
  }
  return ok(r as DataProofRecord);
}

/**
 * Allowed status changes. Callers must have real evidence before advancing:
 * VERIFIED requires an independent verification result, ANCHORED a confirmed transaction.
 */
export function advanceDataProof(
  record: DataProofRecord,
  next: 'VERIFIED' | 'ANCHORED',
  evidence?: { transaction?: string }
): Result<DataProofRecord> {
  const valid = validateDataProofRecord(record);
  if (!valid.ok) return valid;
  if (next === 'VERIFIED') {
    if (record.verificationStatus !== 'SUBMITTED') return fail('INVALID_TRANSITION', `Cannot verify a ${record.verificationStatus} proof.`);
    return ok({ ...record, verificationStatus: 'VERIFIED' });
  }
  if (record.verificationStatus !== 'VERIFIED') return fail('INVALID_TRANSITION', 'Only a verified proof can be anchored.');
  if (!evidence?.transaction?.trim()) return fail('INVALID_INPUT', 'A confirmed transaction reference is required to anchor a proof.');
  return ok({ ...record, verificationStatus: 'ANCHORED', blockchainTransaction: evidence.transaction.trim() });
}
