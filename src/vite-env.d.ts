/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_SOLANA_NETWORK?: "mainnet-beta" | "devnet" | "testnet";
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_TINANAI_SOLANA_MINT?: string;
  readonly VITE_PUMPFUN_TOKEN_URL?: string;
  readonly VITE_TINANAI_METADATA_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type EthereumRequestArguments = { method: string; params?: unknown[] | object };

declare global {
  interface Window {
    ethereum?: {
      request: (args: EthereumRequestArguments) => Promise<any>;
      on?: (eventName: string, listener: (...args: any[]) => void) => void;
      removeListener?: (eventName: string, listener: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export {};
