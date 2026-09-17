import EthereumProvider from "@walletconnect/ethereum-provider";
import { BrowserProvider, Contract, ethers, formatUnits, parseUnits } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SUPPORTED_CHAIN_IDS, SUPPORTED_NETWORKS } from "../config/networks";
import { EKA_TOKEN } from "../config/token";
import { truncateMiddle, validateEvmAddress } from "../core/verify";
import { ERC20_ABI } from "../lib/erc20";
import { getEkaContractExplorerUrl, getEkaTransactionExplorerUrl } from "../sdk/evm";

type ProviderType = "metamask" | "walletconnect";

type WalletSnapshot = {
  address: string;
  chainId: number | null;
  network: string;
  nativeSymbol: string;
  nativeBalance: string;
  ekaBalance: string;
  totalSupply: string;
  burnedTokens: string;
  explorerUrl: string | null;
  connected: boolean;
  providerType: ProviderType | null;
};

export type EvmWalletHook = {
  snapshot: WalletSnapshot;
  status: string;
  recentTransactions: { hash: string; createdAt: number }[];
  connectMetaMask: () => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  addEkaToken: () => Promise<void>;
  sendEka: (recipient: string, amount: string) => Promise<void>;
  isEkaNetwork: boolean;
  shortAddress: string;
  lastTransactionUrl: string | null;
};

const INITIAL_SNAPSHOT: WalletSnapshot = {
  address: "",
  chainId: null,
  network: "Disconnected",
  nativeSymbol: "ETH",
  nativeBalance: "0",
  ekaBalance: "0",
  totalSupply: "0",
  burnedTokens: "0",
  explorerUrl: getEkaContractExplorerUrl(),
  connected: false,
  providerType: null,
};

const BURN_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
] as const;

function resolveNetwork(chainId: number | null) {
  if (!chainId || !(chainId in SUPPORTED_NETWORKS)) {
    return { name: "Unsupported network", nativeSymbol: "ETH", explorer: EKA_TOKEN.explorerBaseUrl };
  }
  return SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS];
}

export function useEvmWallet(): EvmWalletHook {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(INITIAL_SNAPSHOT);
  const [browserProvider, setBrowserProvider] = useState<BrowserProvider | null>(null);
  const [wcProvider, setWcProvider] = useState<EthereumProvider | null>(null);
  const [status, setStatus] = useState("EKA wallet disconnected.");
  const [recentTransactions, setRecentTransactions] = useState<{ hash: string; createdAt: number }[]>([]);

  const refresh = useCallback(async () => {
    if (!browserProvider || !snapshot.address) return;
    const network = await browserProvider.getNetwork();
    const chainId = Number(network.chainId);
    const parsedNetwork = resolveNetwork(chainId);
    const nativeRaw = await browserProvider.getBalance(snapshot.address);

    if (chainId !== EKA_TOKEN.chainId) {
      setSnapshot((prev) => ({
        ...prev,
        chainId,
        network: parsedNetwork.name,
        nativeSymbol: parsedNetwork.nativeSymbol,
        nativeBalance: Number(formatUnits(nativeRaw, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 }),
        ekaBalance: "Requires Ethereum Mainnet",
        totalSupply: "Requires Ethereum Mainnet",
        burnedTokens: "Requires Ethereum Mainnet",
        explorerUrl: getEkaContractExplorerUrl(),
      }));
      setStatus(`Connected on ${parsedNetwork.name}. Switch to ${EKA_TOKEN.networkLabel} for EKA actions.`);
      return;
    }

    const signer = await browserProvider.getSigner();
    const contract = new Contract(EKA_TOKEN.contractAddress, ERC20_ABI, signer);
    const [tokenRaw, supplyRaw, burnedZero, burnedDead] = await Promise.all([
      contract.balanceOf(snapshot.address),
      contract.totalSupply(),
      contract.balanceOf(BURN_ADDRESSES[0]),
      contract.balanceOf(BURN_ADDRESSES[1]),
    ]);

    setSnapshot((prev) => ({
      ...prev,
      chainId,
      network: parsedNetwork.name,
      nativeSymbol: parsedNetwork.nativeSymbol,
      nativeBalance: Number(formatUnits(nativeRaw, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 }),
      ekaBalance: Number(formatUnits(tokenRaw, EKA_TOKEN.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 }),
      totalSupply: Number(formatUnits(supplyRaw, EKA_TOKEN.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      burnedTokens: Number(formatUnits(burnedZero + burnedDead, EKA_TOKEN.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      explorerUrl: getEkaContractExplorerUrl(),
    }));
    setStatus("EKA wallet ready.");
  }, [browserProvider, snapshot.address]);

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("MetaMask is not available in this browser.");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setBrowserProvider(provider);
      setSnapshot((prev) => ({ ...prev, address, connected: true, providerType: "metamask" }));
      setStatus("MetaMask connected. Waiting for wallet-approved refresh.");
    } catch (error) {
      setStatus(`MetaMask connection failed: ${(error as Error).message}`);
    }
  }, []);

  const connectWalletConnect = useCallback(async () => {
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
      setStatus("Set VITE_WALLETCONNECT_PROJECT_ID to enable WalletConnect.");
      return;
    }
    try {
      const provider = await EthereumProvider.init({
        projectId,
        chains: [SUPPORTED_CHAIN_IDS[0]],
        optionalChains: SUPPORTED_CHAIN_IDS,
        showQrModal: true,
      });
      await provider.enable();
      const walletProvider = new BrowserProvider(provider as never);
      const signer = await walletProvider.getSigner();
      const address = await signer.getAddress();
      setWcProvider(provider);
      setBrowserProvider(walletProvider);
      setSnapshot((prev) => ({ ...prev, address, connected: true, providerType: "walletconnect" }));
      setStatus("WalletConnect connected. Waiting for wallet-approved refresh.");
    } catch (error) {
      setStatus(`WalletConnect failed: ${(error as Error).message}`);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (wcProvider) {
      await wcProvider.disconnect();
      setWcProvider(null);
    }
    setBrowserProvider(null);
    setSnapshot(INITIAL_SNAPSHOT);
    setRecentTransactions([]);
    setStatus("EKA wallet disconnected.");
  }, [wcProvider]);

  const addEkaToken = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("MetaMask is required to watch the EKA contract.");
      return;
    }
    if (snapshot.chainId !== EKA_TOKEN.chainId) {
      setStatus(`Switch MetaMask to ${EKA_TOKEN.networkLabel} before adding EKA.`);
      return;
    }
    const added = await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: EKA_TOKEN.contractAddress,
          symbol: EKA_TOKEN.symbol,
          decimals: EKA_TOKEN.decimals,
        },
      },
    });
    setStatus(added ? "EKA added in MetaMask." : "MetaMask watch asset request was canceled.");
  }, [snapshot.chainId]);

  const sendEka = useCallback(async (recipient: string, amount: string) => {
    if (!browserProvider || !snapshot.connected) {
      setStatus("Connect an EVM wallet before sending EKA.");
      return;
    }
    if (snapshot.chainId !== EKA_TOKEN.chainId) {
      setStatus(`Switch to ${EKA_TOKEN.networkLabel} before sending EKA.`);
      return;
    }
    if (!validateEvmAddress(recipient)) {
      setStatus("Recipient address is invalid.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setStatus("Amount must be greater than zero.");
      return;
    }
    try {
      const signer = await browserProvider.getSigner();
      const contract = new Contract(EKA_TOKEN.contractAddress, ERC20_ABI, signer);
      setStatus("Awaiting explicit wallet approval for the EKA transfer.");
      const tx = await contract.transfer(recipient, parseUnits(amount, EKA_TOKEN.decimals));
      setStatus("Transfer submitted. Waiting for confirmation.");
      await tx.wait();
      setRecentTransactions((prev) => [{ hash: tx.hash, createdAt: Date.now() }, ...prev].slice(0, 5));
      await refresh();
      setStatus("EKA transfer confirmed.");
    } catch (error) {
      setStatus(`Transfer failed: ${(error as Error).message}`);
    }
  }, [browserProvider, refresh, snapshot.chainId, snapshot.connected]);

  useEffect(() => {
    if (!snapshot.connected || !snapshot.address || !browserProvider) return;
    refresh().catch((error) => setStatus(`Wallet refresh failed: ${(error as Error).message}`));
  }, [browserProvider, refresh, snapshot.address, snapshot.connected]);

  useEffect(() => {
    if (!window.ethereum?.on || !window.ethereum?.removeListener) return;
    const handleAccountsChanged = (accounts: string[]) => {
      const [nextAddress] = accounts;
      if (!nextAddress) {
        disconnect().catch(() => undefined);
        return;
      }
      setSnapshot((prev) => ({ ...prev, address: nextAddress, connected: true }));
    };
    const handleChainChanged = () => {
      refresh().catch(() => undefined);
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [disconnect, refresh]);

  const isEkaNetwork = snapshot.chainId === EKA_TOKEN.chainId;
  const shortAddress = useMemo(() => truncateMiddle(snapshot.address, 6, 4), [snapshot.address]);
  const lastTransactionUrl = recentTransactions[0] ? getEkaTransactionExplorerUrl(recentTransactions[0].hash) : null;

  return {
    snapshot,
    status,
    recentTransactions,
    connectMetaMask,
    connectWalletConnect,
    disconnect,
    refresh,
    addEkaToken,
    sendEka,
    isEkaNetwork,
    shortAddress,
    lastTransactionUrl,
  };
}
