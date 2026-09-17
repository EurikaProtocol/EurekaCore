import { safeUrl, validateSolanaAddress } from "../core/verify";
import { SOLANA_CLUSTER_URLS, SOLANA_NETWORKS, type SolanaNetwork } from "../solana/constants";

const METADATA_HOSTS = ["arweave.net", "ipfs.io", "gateway.pinata.cloud", "nftstorage.link"] as const;
const envNetwork = import.meta.env.VITE_SOLANA_NETWORK;
const network = (SOLANA_NETWORKS as readonly string[]).includes(envNetwork) ? (envNetwork as SolanaNetwork) : "mainnet-beta";
const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL?.trim() || SOLANA_CLUSTER_URLS[network];
const mintAddress = import.meta.env.VITE_TINANAI_SOLANA_MINT?.trim() || null;
const metadataUri = import.meta.env.VITE_TINANAI_METADATA_URI?.trim() || null;
const pumpfunTokenUrl = import.meta.env.VITE_PUMPFUN_TOKEN_URL?.trim() || null;
const validatedMetadataUri = safeUrl(metadataUri, [...METADATA_HOSTS]);
const validatedPumpfunUrl = safeUrl(pumpfunTokenUrl, ["pump.fun"]);

export const TINANAI_SOLANA_CONFIG = {
  network,
  rpcUrl,
  mintAddress: validateSolanaAddress(mintAddress) ? mintAddress : null,
  metadataUri: validatedMetadataUri,
  pumpfunTokenUrl: validatedPumpfunUrl,
  isMintConfigured: validateSolanaAddress(mintAddress),
  usesDefaultRpc: !import.meta.env.VITE_SOLANA_RPC_URL,
  warnings: [
    !import.meta.env.VITE_SOLANA_RPC_URL ? "Set VITE_SOLANA_RPC_URL for the production Solana endpoint." : null,
    !validateSolanaAddress(mintAddress) ? "Set VITE_TINANAI_SOLANA_MINT with the official Solana mint before production." : null,
    !pumpfunTokenUrl ? "Set VITE_PUMPFUN_TOKEN_URL when the Pump.fun launch page is official." : null,
    pumpfunTokenUrl && !validatedPumpfunUrl ? "VITE_PUMPFUN_TOKEN_URL must point to an official https://pump.fun page." : null,
    !metadataUri ? "Set VITE_TINANAI_METADATA_URI with the official token metadata URI." : null,
    metadataUri && !validatedMetadataUri ? "VITE_TINANAI_METADATA_URI must use a trusted HTTPS metadata host." : null,
  ].filter(Boolean) as string[],
};
