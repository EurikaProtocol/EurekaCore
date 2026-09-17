/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_TINANAI_SOLANA_MINT?: string;
  readonly VITE_PUMPFUN_TOKEN_URL?: string;
  readonly VITE_TINANAI_METADATA_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
    on?: (eventName: string, listener: (...args: any[]) => void) => void;
    removeListener?: (eventName: string, listener: (...args: any[]) => void) => void;
    isMetaMask?: boolean;
  };
}
