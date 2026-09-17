export const EUREKACORE_CONFIG = Object.freeze({
  app: {
    name: "EurekaCore",
    aiName: "TINAN AI",
    tagline: "Not Artificial Intelligence. Natural Intelligence.",
    storageNamespace: "eurekacore.v3"
  },
  token: {
    name: "EUREKA",
    symbol: "EURIKA",
    contractAddress: "0x4042973c0863CCA0D73F028cA98465F44F0e6F97",
    decimals: 18,
    totalSupply: null,
    holderCountFallback: "API required",
    explorerBaseUrl: "https://etherscan.io/token/"
  },
  network: {
    defaultChainId: "0x1",
    defaultLabel: "Ethereum Mainnet",
    rpcUrl: "https://cloudflare-eth.com"
  },
  integrations: {
    walletConnect: {
      projectId: "",
      status: "Add a WalletConnect v2 projectId in config.js to enable live pairing."
    },
    coinbaseWallet: {
      appName: "EurekaCore",
      status: "Ready for Coinbase Wallet SDK or mobile deep-link handoff."
    }
  },
  vault: {
    storageKey: "eurekacore.v3.vault",
    iterations: 150000
  },
  ui: {
    historyLimit: 60,
    activityLimit: 20
  }
});
