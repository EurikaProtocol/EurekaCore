export const SOLANA_NETWORKS = ["mainnet-beta", "devnet", "testnet"] as const;
export type SolanaNetwork = (typeof SOLANA_NETWORKS)[number];

export const SOLANA_CLUSTER_URLS: Record<SolanaNetwork, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

export const TRUSTED_SOLANA_HOSTS = ["solscan.io", "explorer.solana.com", "pump.fun", "phantom.app"] as const;
