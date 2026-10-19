import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { fail, ok, type Result } from '../core/errors';
import { proposeTransaction, type TransactionRecord } from '../core/transaction';

export function buildSolTransferTransaction(fromAddress: string, toAddress: string, lamports: number) {
  if (!Number.isSafeInteger(lamports) || lamports <= 0) {
    throw new Error('Lamports must be a positive integer.');
  }
  // PublicKey throws on malformed addresses.
  return new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(fromAddress),
      toPubkey: new PublicKey(toAddress),
      lamports,
    })
  );
}

/**
 * Builds an unsigned SOL transfer and a "proposed" record. Signing and submission stay with the
 * connected wallet; this adapter never signs, sends, or reports confirmation.
 */
export function proposeSolTransfer(
  network: string,
  fromAddress: string,
  toAddress: string,
  lamports: number
): Result<{ transaction: Transaction; record: TransactionRecord }> {
  let transaction: Transaction;
  try {
    transaction = buildSolTransferTransaction(fromAddress, toAddress, lamports);
  } catch (error) {
    return fail('INVALID_INPUT', error instanceof Error ? error.message : 'Invalid SOL transfer.');
  }
  const record = proposeTransaction({ family: 'Solana', network, summary: `Transfer ${lamports} lamports` });
  return record.ok ? ok({ transaction, record: record.value }) : record;
}
