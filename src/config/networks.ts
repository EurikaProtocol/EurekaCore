export type SupportedChain = 1 | 56 | 42161;

export const SUPPORTED_NETWORKS: Record<
  SupportedChain,
  { name: string; nativeSymbol: string; explorer: string }
> = {
  1: { name: "Ethereum", nativeSymbol: "ETH", explorer: "https://etherscan.io" },
  56: { name: "BNB Smart Chain", nativeSymbol: "BNB", explorer: "https://bscscan.com" },
  42161: { name: "Arbitrum", nativeSymbol: "ETH", explorer: "https://arbiscan.io" },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(SUPPORTED_NETWORKS).map(Number);
