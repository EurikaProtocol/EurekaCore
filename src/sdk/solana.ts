import type { Connection } from '@solana/web3.js';
import { getSolBalance, getSplTokenBalance } from '../solana/token';

export type SolanaWalletSnapshot = {
  solBalance: string;
  tokenBalance: string;
  tokenDecimals: number | null;
};

export async function readSolanaWalletSnapshot(
  connection: Connection,
  ownerAddress: string,
  mintAddress: string | null
): Promise<SolanaWalletSnapshot> {
  const solBalance = await getSolBalance(connection, ownerAddress);

  if (!mintAddress) {
    return {
      solBalance: solBalance.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      tokenBalance: 'Mint not configured',
      tokenDecimals: null,
    };
  }

  const tokenBalance = await getSplTokenBalance(connection, ownerAddress, mintAddress);
  return {
    solBalance: solBalance.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    tokenBalance: tokenBalance.formattedAmount,
    tokenDecimals: tokenBalance.decimals,
  };
}
