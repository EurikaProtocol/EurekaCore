import { isValidSolanaAddress } from '../core/verify';
import { resolveMetadataUri } from '../solana/metadata';
import { resolvePumpfunUrl } from '../solana/pumpfun';
import { getSolanaRpcUrl, normalizeSolanaNetwork } from '../solana/constants';

const network = normalizeSolanaNetwork(import.meta.env.VITE_SOLANA_NETWORK);
const rpcUrl = getSolanaRpcUrl(network, import.meta.env.VITE_SOLANA_RPC_URL);
const rawMint = import.meta.env.VITE_TINANAI_SOLANA_MINT?.trim();
const mintAddress = rawMint && isValidSolanaAddress(rawMint) ? rawMint : null;
const pumpfunUrl = resolvePumpfunUrl(import.meta.env.VITE_PUMPFUN_TOKEN_URL);
const metadataUri = resolveMetadataUri(import.meta.env.VITE_TINANAI_METADATA_URI);

export const TINANAI_SOLANA = {
  network,
  rpcUrl,
  mintAddress,
  mintConfigured: Boolean(mintAddress),
  pumpfunUrl,
  metadataUri,
  explorerBaseUrl: 'https://solscan.io',
  issues: [
    !import.meta.env.VITE_SOLANA_NETWORK ? 'VITE_SOLANA_NETWORK is not set.' : null,
    !import.meta.env.VITE_SOLANA_RPC_URL ? 'VITE_SOLANA_RPC_URL is not set.' : null,
    rawMint && !mintAddress ? 'VITE_TINANAI_SOLANA_MINT is invalid.' : null,
    import.meta.env.VITE_PUMPFUN_TOKEN_URL && !pumpfunUrl ? 'VITE_PUMPFUN_TOKEN_URL is untrusted or invalid.' : null,
    import.meta.env.VITE_TINANAI_METADATA_URI && !metadataUri ? 'VITE_TINANAI_METADATA_URI is untrusted or invalid.' : null,
  ].filter(Boolean) as string[],
} as const;
