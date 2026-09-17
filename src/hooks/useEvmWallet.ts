import EthereumProvider from '@walletconnect/ethereum-provider';
import { BrowserProvider } from 'ethers';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_EVM_NETWORK, SUPPORTED_WALLETCONNECT_CHAIN_IDS } from '../config/networks';
import { EKA_TOKEN } from '../config/token';
import { requestEthereumMainnet, requestWatchEkaAsset, readEkaWalletSnapshot, sendEkaTransfer } from '../sdk/evm';

type ProviderType = 'metamask' | 'walletconnect';

export type RecentTransaction = {
  hash: string;
  createdAt: number;
};

export type EvmWalletState = {
  address: string;
  providerType: ProviderType | null;
  chainId: number | null;
  network: string;
  nativeSymbol: string;
  nativeBalance: string;
  ekaBalance: string;
  totalSupply: string;
  burnedTokens: string;
  explorerBaseUrl: string;
  ekaReady: boolean;
  networkWarning: string | null;
  connected: boolean;
};

export type EvmWalletController = {
  state: EvmWalletState;
  status: string;
  busy: boolean;
  recentTransactions: RecentTransaction[];
  lastTxHash: string;
  connectInjected: () => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  addToken: () => Promise<void>;
  switchToEthereumMainnet: () => Promise<void>;
  sendTransfer: (to: string, amount: string) => Promise<void>;
};

const INITIAL_STATE: EvmWalletState = {
  address: '',
  providerType: null,
  chainId: null,
  network: 'Disconnected',
  nativeSymbol: DEFAULT_EVM_NETWORK.nativeSymbol,
  nativeBalance: '0',
  ekaBalance: '0',
  totalSupply: '0',
  burnedTokens: '0',
  explorerBaseUrl: EKA_TOKEN.explorerBaseUrl,
  ekaReady: false,
  networkWarning: null,
  connected: false,
};

export function useEvmWallet(): EvmWalletController {
  const [state, setState] = useState<EvmWalletState>(INITIAL_STATE);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [walletConnectProvider, setWalletConnectProvider] = useState<EthereumProvider | null>(null);
  const [status, setStatus] = useState('Wallet disconnected.');
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);

  const syncWallet = useCallback(async (nextProvider: BrowserProvider, address: string, providerType: ProviderType | null) => {
    const snapshot = await readEkaWalletSnapshot(nextProvider, address);
    setState({
      ...snapshot,
      address,
      providerType,
      connected: true,
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!provider || !state.address || !state.providerType) return;
    try {
      await syncWallet(provider, state.address, state.providerType);
    } catch (error) {
      setStatus(`Wallet refresh failed: ${(error as Error).message}`);
    }
  }, [provider, state.address, state.providerType, syncWallet]);

  const connectInjected = useCallback(async () => {
    if (!window.ethereum) {
      setStatus('MetaMask is not available. Install it before using EKA wallet actions.');
      return;
    }

    setBusy(true);
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts[0];
      if (!address) {
        throw new Error('No wallet address returned by MetaMask.');
      }

      const nextProvider = new BrowserProvider(window.ethereum);
      setProvider(nextProvider);
      await syncWallet(nextProvider, address, 'metamask');
      setStatus('MetaMask connected. Review network status before using EKA actions.');
    } catch (error) {
      setStatus(`MetaMask connection failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [syncWallet]);

  const connectWalletConnect = useCallback(async () => {
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
    if (!projectId) {
      setStatus('Add VITE_WALLETCONNECT_PROJECT_ID to enable WalletConnect.');
      return;
    }

    setBusy(true);
    try {
      const nextWalletConnectProvider = await EthereumProvider.init({
        projectId,
        chains: [SUPPORTED_WALLETCONNECT_CHAIN_IDS[0]],
        optionalChains: [...SUPPORTED_WALLETCONNECT_CHAIN_IDS],
        showQrModal: true,
      });

      await nextWalletConnectProvider.enable();
      const nextProvider = new BrowserProvider(nextWalletConnectProvider as never);
      const signer = await nextProvider.getSigner();
      const address = await signer.getAddress();

      setWalletConnectProvider(nextWalletConnectProvider);
      setProvider(nextProvider);
      await syncWallet(nextProvider, address, 'walletconnect');
      setStatus('WalletConnect connected. EKA token actions remain limited to Ethereum Mainnet.');
    } catch (error) {
      setStatus(`WalletConnect failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [syncWallet]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      if (walletConnectProvider) {
        await walletConnectProvider.disconnect();
        setWalletConnectProvider(null);
      }
    } finally {
      setProvider(null);
      setState(INITIAL_STATE);
      setLastTxHash('');
      setRecentTransactions([]);
      setStatus('Wallet disconnected.');
      setBusy(false);
    }
  }, [walletConnectProvider]);

  const addToken = useCallback(async () => {
    if (!window.ethereum) {
      setStatus('MetaMask is required to add EKA to a wallet watchlist.');
      return;
    }

    try {
      const added = await requestWatchEkaAsset(window.ethereum);
      setStatus(added ? 'EKA was offered to MetaMask.' : 'MetaMask token watch request was cancelled.');
    } catch (error) {
      setStatus(`Token watch request failed: ${(error as Error).message}`);
    }
  }, []);

  const switchToEthereumMainnet = useCallback(async () => {
    if (!window.ethereum) {
      setStatus('MetaMask is required for an in-app network switch request.');
      return;
    }

    setBusy(true);
    try {
      await requestEthereumMainnet(window.ethereum);
      setStatus('Ethereum Mainnet switch requested. Confirm the wallet prompt if it appears.');
      if (provider && state.address && state.providerType) {
        await syncWallet(provider, state.address, state.providerType);
      }
    } catch (error) {
      setStatus(`Network switch failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [provider, state.address, state.providerType, syncWallet]);

  const sendTransfer = useCallback(
    async (to: string, amount: string) => {
      if (!provider || !state.address || !state.connected) {
        setStatus('Connect an EVM wallet before sending EKA.');
        return;
      }

      if (!state.ekaReady) {
        setStatus(state.networkWarning ?? `Switch to ${EKA_TOKEN.chainName} before sending EKA.`);
        return;
      }

      setBusy(true);
      try {
        const tx = await sendEkaTransfer(provider, to, amount);
        setStatus('Transaction submitted. Confirming on-chain...');
        await tx.wait();
        setLastTxHash(tx.hash);
        setRecentTransactions((current) => [{ hash: tx.hash, createdAt: Date.now() }, ...current].slice(0, 5));
        await syncWallet(provider, state.address, state.providerType);
        setStatus('EKA transfer confirmed.');
      } catch (error) {
        setStatus(`Transfer failed: ${(error as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [provider, state.address, state.connected, state.ekaReady, state.networkWarning, state.providerType, syncWallet]
  );

  useEffect(() => {
    if (!provider || !state.address || !state.providerType) return;
    const interval = window.setInterval(() => {
      syncWallet(provider, state.address, state.providerType).catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [provider, state.address, state.providerType, syncWallet]);

  useEffect(() => {
    if (!window.ethereum?.on || !window.ethereum?.removeListener) return;

    const handleChainChanged = () => {
      if (provider && state.address && state.providerType) {
        syncWallet(provider, state.address, state.providerType).catch(() => undefined);
      }
    };

    const handleAccountsChanged = (accounts: string[]) => {
      const address = accounts[0];
      if (!address) {
        disconnect().catch(() => undefined);
        return;
      }

      if (provider && state.providerType) {
        syncWallet(provider, address, state.providerType).catch(() => undefined);
      }
    };

    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, [disconnect, provider, state.address, state.providerType, syncWallet]);

  return useMemo(
    () => ({
      state,
      status,
      busy,
      recentTransactions,
      lastTxHash,
      connectInjected,
      connectWalletConnect,
      disconnect,
      refresh,
      addToken,
      switchToEthereumMainnet,
      sendTransfer,
    }),
    [
      addToken,
      busy,
      connectInjected,
      connectWalletConnect,
      disconnect,
      lastTxHash,
      recentTransactions,
      refresh,
      sendTransfer,
      state,
      status,
      switchToEthereumMainnet,
    ]
  );
}
