import { PublicKey, type Connection } from "@solana/web3.js";
import { validateSolanaAddress } from "../core/verify";

export async function getSolanaTokenBalance(connection: Connection, ownerAddress: string, mintAddress: string | null) {
  if (!validateSolanaAddress(ownerAddress) || !validateSolanaAddress(mintAddress)) return null;
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(mintAddress);
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  return accounts.value.reduce((total, accountInfo) => {
    const amount = accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
    return total + (typeof amount === "number" ? amount : 0);
  }, 0);
}
