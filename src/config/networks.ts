export type SupportedChain = 1 | 56 | 42161;

export type EvmNetworkConfig = {
  chainId: SupportedChain;
  name: string;
  nativeSymbol: string;
  explorer: string;
};

export const SUPPORTED_NETWORKS: Record<SupportedChain, EvmNetworkConfig> = {
  1: { chainId: 1, name: "Ethereum", nativeSymbol: "ETH", explorer: "https://etherscan.io" },
  56: { chainId: 56, name: "BNB Smart Chain", nativeSymbol: "BNB", explorer: "https://bscscan.com" },
  42161: { chainId: 42161, name: "Arbitrum", nativeSymbol: "ETH", explorer: "https://arbiscan.io" },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(SUPPORTED_NETWORKS).map(Number) as SupportedChain[];
export const TRUSTED_EVM_EXPLORER_HOSTS = ["etherscan.io", "bscscan.com", "arbiscan.io"] as const;
