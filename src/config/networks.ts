export type SupportedEvmChain = 1 | 8453 | 42161 | 137 | 56;

export type EvmNetworkConfig = {
  chainId: SupportedEvmChain;
  chainHex: `0x${string}`;
  name: string;
  nativeSymbol: string;
  explorerBaseUrl: string;
};

export const EVM_NETWORKS: Record<SupportedEvmChain, EvmNetworkConfig> = {
  1: {
    chainId: 1,
    chainHex: '0x1',
    name: 'Ethereum Mainnet',
    nativeSymbol: 'ETH',
    explorerBaseUrl: 'https://etherscan.io',
  },
  8453: {
    chainId: 8453,
    chainHex: '0x2105',
    name: 'Base',
    nativeSymbol: 'ETH',
    explorerBaseUrl: 'https://basescan.org',
  },
  42161: {
    chainId: 42161,
    chainHex: '0xa4b1',
    name: 'Arbitrum One',
    nativeSymbol: 'ETH',
    explorerBaseUrl: 'https://arbiscan.io',
  },
  56: {
    chainId: 56,
    chainHex: '0x38',
    name: 'BNB Smart Chain',
    nativeSymbol: 'BNB',
    explorerBaseUrl: 'https://bscscan.com',
  },
  137: {
    chainId: 137,
    chainHex: '0x89',
    name: 'Polygon',
    nativeSymbol: 'POL',
    explorerBaseUrl: 'https://polygonscan.com',
  },
};

export const DEFAULT_EVM_NETWORK = EVM_NETWORKS[1];
export const SUPPORTED_WALLETCONNECT_CHAIN_IDS = [1] as const;
export const TOKENIZATION_NETWORKS = [
  ...Object.values(EVM_NETWORKS),
  {
    name: 'Solana',
    chainId: null,
    nativeSymbol: 'SOL',
    explorerBaseUrl: 'https://solscan.io',
  },
] as const;

export function getEvmNetworkConfig(chainId: number | null | undefined): EvmNetworkConfig {
  if (chainId && chainId in EVM_NETWORKS) {
    return EVM_NETWORKS[chainId as SupportedEvmChain];
  }

  return {
    chainId: 1,
    chainHex: '0x1',
    name: chainId ? `Unsupported network (${chainId})` : 'Disconnected',
    nativeSymbol: 'ETH',
    explorerBaseUrl: DEFAULT_EVM_NETWORK.explorerBaseUrl,
  };
}
