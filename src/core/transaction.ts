import { fail, isIsoTimestamp, ok, type Result } from './errors';

export type TransactionState = 'proposed' | 'submitted' | 'confirmed' | 'failed';
export type TransactionFamily = 'EVM' | 'Solana';

export type TransactionRecord = {
  family: TransactionFamily;
  network: string;
  state: TransactionState;
  summary: string;
  proposedAt: string;
  /** Network transaction id/signature; only present once a wallet actually submitted it. */
  reference: string | null;
  /** Failure reason; only present for failed transactions. */
  error: string | null;
};

const TRANSITIONS: Record<TransactionState, readonly TransactionState[]> = {
  proposed: ['submitted', 'failed'],
  submitted: ['confirmed', 'failed'],
  confirmed: [],
  failed: [],
};

export function proposeTransaction(input: { family: TransactionFamily; network: string; summary: string; now?: string }): Result<TransactionRecord> {
  if (input.family !== 'EVM' && input.family !== 'Solana') return fail('UNSUPPORTED', `Unsupported chain family: ${String(input.family)}`);
  if (!input.network.trim() || !input.summary.trim()) return fail('INVALID_INPUT', 'Network and summary are required.');
  if (input.now !== undefined && !isIsoTimestamp(input.now)) return fail('INVALID_INPUT', 'Timestamp must be ISO-8601.');
  return ok({
    family: input.family,
    network: input.network.trim(),
    state: 'proposed',
    summary: input.summary.trim(),
    proposedAt: input.now ?? new Date().toISOString(),
    reference: null,
    error: null,
  });
}

function transition(record: TransactionRecord, next: TransactionState, patch: Partial<TransactionRecord>): Result<TransactionRecord> {
  if (!TRANSITIONS[record.state].includes(next)) {
    return fail('INVALID_TRANSITION', `Cannot move a ${record.state} transaction to ${next}.`);
  }
  return ok({ ...record, ...patch, state: next });
}

/** Call only after the wallet returned a real transaction id/signature. */
export function markSubmitted(record: TransactionRecord, reference: string): Result<TransactionRecord> {
  if (!reference?.trim()) return fail('INVALID_INPUT', 'A transaction reference is required.');
  return transition(record, 'submitted', { reference: reference.trim() });
}

/** Call only after the network reported confirmation. */
export function markConfirmed(record: TransactionRecord): Result<TransactionRecord> {
  return transition(record, 'confirmed', {});
}

export function markFailed(record: TransactionRecord, reason: string): Result<TransactionRecord> {
  if (!reason?.trim()) return fail('INVALID_INPUT', 'A failure reason is required.');
  return transition(record, 'failed', { error: reason.trim() });
}
