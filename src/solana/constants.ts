import { clusterApiUrl } from '@solana/web3.js';

export const SOLANA_NETWORKS = ['mainnet-beta', 'devnet', 'testnet'] as const;
export type SolanaNetworkName = (typeof SOLANA_NETWORKS)[number];

export function normalizeSolanaNetwork(value: string | undefined): SolanaNetworkName {
  if (value && SOLANA_NETWORKS.includes(value as SolanaNetworkName)) {
    return value as SolanaNetworkName;
  }

  return import.meta.env.DEV ? 'devnet' : 'mainnet-beta';
}

export function getSolanaRpcUrl(network: SolanaNetworkName, configuredRpcUrl: string | undefined) {
  return configuredRpcUrl?.trim() || clusterApiUrl(network);
}

export function getSolanaClusterQuery(network: SolanaNetworkName) {
  return network === 'mainnet-beta' ? '' : `?cluster=${network}`;
}
