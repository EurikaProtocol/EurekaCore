import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { safeUrl } from "../core/verify";

export function buildSolanaExplorerUrl(path: "address" | "tx" | "token", value: string) {
  const cluster = TINANAI_SOLANA_CONFIG.network === "mainnet-beta" ? "" : `?cluster=${TINANAI_SOLANA_CONFIG.network}`;
  return safeUrl(`https://solscan.io/${path}/${value}${cluster}`, ["solscan.io"]);
}
