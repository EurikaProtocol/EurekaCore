/// <reference types="vite/client" />

interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
    on?: (eventName: string, listener: (...args: any[]) => void) => void;
    removeListener?: (eventName: string, listener: (...args: any[]) => void) => void;
    isMetaMask?: boolean;
  };
}
