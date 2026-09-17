import { Connection } from "@solana/web3.js";
import { TINANAI_SOLANA_CONFIG } from "../config/tinanai-solana";
import { safeUrl } from "../core/verify";

export function createSolanaEndpoint() {
  return safeUrl(TINANAI_SOLANA_CONFIG.rpcUrl, ["api.mainnet-beta.solana.com", "api.devnet.solana.com", "api.testnet.solana.com"]) ?? TINANAI_SOLANA_CONFIG.rpcUrl;
}

export function createSolanaConnection() {
  return new Connection(createSolanaEndpoint(), "confirmed");
}
