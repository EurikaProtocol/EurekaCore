import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export type SolanaTokenBalance = {
  amount: number;
  formattedAmount: string;
  decimals: number;
};

export async function getSolBalance(connection: Connection, ownerAddress: string) {
  const lamports = await connection.getBalance(new PublicKey(ownerAddress));
  return Number((lamports / LAMPORTS_PER_SOL).toFixed(6));
}

export async function getSplTokenBalance(
  connection: Connection,
  ownerAddress: string,
  mintAddress: string
): Promise<SolanaTokenBalance> {
  const accounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(ownerAddress), {
    mint: new PublicKey(mintAddress),
  });

  let amount = 0;
  let decimals = 0;

  for (const account of accounts.value) {
    const parsed = account.account.data.parsed.info.tokenAmount;
    amount += Number(parsed.uiAmountString || 0);
    decimals = parsed.decimals;
  }

  return {
    amount,
    formattedAmount: amount.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    decimals,
  };
}
