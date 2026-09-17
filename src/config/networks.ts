export type SupportedEvmChain = 1 | 56 | 137 | 42161;

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
  42161: {
    chainId: 42161,
    chainHex: '0xa4b1',
    name: 'Arbitrum One',
    nativeSymbol: 'ETH',
    explorerBaseUrl: 'https://arbiscan.io',
  },
};

export const DEFAULT_EVM_NETWORK = EVM_NETWORKS[1];
export const SUPPORTED_WALLETCONNECT_CHAIN_IDS = [1] as const;

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
