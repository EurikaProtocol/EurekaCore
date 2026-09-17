import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

export function buildSolTransferTransaction(fromAddress: string, toAddress: string, lamports: number) {
  return new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(fromAddress),
      toPubkey: new PublicKey(toAddress),
      lamports,
    })
  );
}
