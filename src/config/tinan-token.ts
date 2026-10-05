import { EVM_NETWORKS, type SupportedEvmChain } from './networks';
import { isValidEvmAddress, toTrustedUrl } from '../core/verify';

const PROVIDED_EXISTING_TOKEN_ADDRESS = '0x4042973c0863CCA0D73F028cA98465F44F0e6F97';
const rawAddress = import.meta.env.VITE_TINAN_TOKEN_ADDRESS?.trim() || PROVIDED_EXISTING_TOKEN_ADDRESS;
const parsedChainId = Number(import.meta.env.VITE_TINAN_TOKEN_CHAIN_ID);
const chainId = Number.isSafeInteger(parsedChainId)
  && parsedChainId in EVM_NETWORKS
  ? parsedChainId as SupportedEvmChain
  : null;

export const TINAN_TOKEN = {
  address: isValidEvmAddress(rawAddress) ? rawAddress : null,
  chainId,
  networkName: chainId ? EVM_NETWORKS[chainId].name : null,
  explorerBaseUrl: toTrustedUrl(import.meta.env.VITE_EXPLORER_URL)
    ?? (chainId ? EVM_NETWORKS[chainId].explorerBaseUrl : null),
  rpcUrl: import.meta.env.VITE_RPC_URL?.trim() || null,
  configured: Boolean(isValidEvmAddress(rawAddress) && chainId),
  issues: [
    !isValidEvmAddress(rawAddress) ? 'VITE_TINAN_TOKEN_ADDRESS is not a valid EVM address.' : null,
    !chainId ? 'Set VITE_TINAN_TOKEN_CHAIN_ID to a supported network; no chain is assumed.' : null,
    !import.meta.env.VITE_RPC_URL?.trim() ? 'Set VITE_RPC_URL to enable read-only token queries.' : null,
  ].filter((issue): issue is string => Boolean(issue)),
} as const;
