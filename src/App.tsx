import { BrowserProvider, Contract, ethers, formatUnits, parseUnits } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { EUREKA_TOKEN } from "./config/token";
import { SUPPORTED_CHAIN_IDS, SUPPORTED_NETWORKS } from "./config/networks";
import { ERC20_ABI } from "./lib/erc20";

type ProviderType = "metamask" | "walletconnect";

type WalletState = {
  address: string;
  providerType: ProviderType | null;
  chainId: number | null;
  network: string;
  nativeSymbol: string;
  nativeBalance: string;
  tokenBalance: string;
  totalSupply: string;
  burnedTokens: string;
  connected: boolean;
};

type RecentTransaction = {
  hash: string;
  createdAt: number;
};

const INITIAL_STATE: WalletState = {
  address: "",
  providerType: null,
  chainId: null,
  network: "Disconnected",
  nativeSymbol: "ETH",
  nativeBalance: "0",
  tokenBalance: "0",
  totalSupply: "0",
  burnedTokens: "0",
  connected: false,
};

const BURN_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
] as const;

function shorten(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—";
}

function parseChain(chainId: number | null) {
  if (!chainId || !(chainId in SUPPORTED_NETWORKS)) {
    return { name: "Unsupported network", nativeSymbol: "ETH", explorer: "https://etherscan.io" };
  }
  return SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS];
}

export default function App() {
  const [wallet, setWallet] = useState<WalletState>(INITIAL_STATE);
  const [browserProvider, setBrowserProvider] = useState<BrowserProvider | null>(null);
  const [wcProvider, setWcProvider] = useState<EthereumProvider | null>(null);
  const [status, setStatus] = useState("Wallet disconnected");
  const [txHash, setTxHash] = useState("");
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  const refreshBalances = useCallback(async (provider: BrowserProvider, address: string) => {
    const signer = await provider.getSigner();
    const contract = new Contract(EUREKA_TOKEN.contractAddress, ERC20_ABI, signer);
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const parsedNetwork = parseChain(chainId);

    const [nativeRaw, tokenRaw, supplyRaw, burnedRawA, burnedRawB] = await Promise.all([
      provider.getBalance(address),
      contract.balanceOf(address),
      contract.totalSupply(),
      contract.balanceOf(BURN_ADDRESSES[0]),
      contract.balanceOf(BURN_ADDRESSES[1]),
    ]);

    setWallet((prev) => ({
      ...prev,
      chainId,
      network: parsedNetwork.name,
      nativeSymbol: parsedNetwork.nativeSymbol,
      nativeBalance: Number(formatUnits(nativeRaw, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 }),
      tokenBalance: Number(formatUnits(tokenRaw, EUREKA_TOKEN.decimals)).toLocaleString(undefined, {
        maximumFractionDigits: 6,
      }),
      totalSupply: Number(formatUnits(supplyRaw, EUREKA_TOKEN.decimals)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      burnedTokens: Number(formatUnits(burnedRawA + burnedRawB, EUREKA_TOKEN.decimals)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
    }));
  }, []);

  const connectInjected = useCallback(async () => {
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
      setWallet((prev) => ({ ...prev, connected: true, address, providerType: "metamask" }));
      await refreshBalances(provider, address);
      setStatus("Wallet connected with MetaMask.");
    } catch (error) {
      setStatus(`MetaMask connection failed: ${(error as Error).message}`);
    }
  }, [refreshBalances]);

  const connectWalletConnect = useCallback(async () => {
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
      setStatus("Add VITE_WALLETCONNECT_PROJECT_ID to use WalletConnect.");
      return;
    }

    try {
      const provider = await EthereumProvider.init({
        projectId,
        chains: SUPPORTED_CHAIN_IDS,
        showQrModal: true,
      });

      await provider.enable();
      const wcBrowserProvider = new BrowserProvider(provider as any);
      const signer = await wcBrowserProvider.getSigner();
      const address = await signer.getAddress();

      setWcProvider(provider);
      setBrowserProvider(wcBrowserProvider);
      setWallet((prev) => ({ ...prev, connected: true, address, providerType: "walletconnect" }));
      await refreshBalances(wcBrowserProvider, address);
      setStatus("Wallet connected with WalletConnect.");
    } catch (error) {
      setStatus(`WalletConnect failed: ${(error as Error).message}`);
    }
  }, [refreshBalances]);

  const disconnect = useCallback(async () => {
    if (wcProvider) {
      await wcProvider.disconnect();
      setWcProvider(null);
    }
    setBrowserProvider(null);
    setWallet(INITIAL_STATE);
    setTxHash("");
    setRecentTransactions([]);
    setStatus("Wallet disconnected.");
  }, [wcProvider]);

  const addToken = useCallback(async () => {
    if (!window.ethereum) {
      setStatus("MetaMask is required to add token.");
      return;
    }

    const wasAdded = await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: EUREKA_TOKEN.contractAddress,
          symbol: EUREKA_TOKEN.symbol,
          decimals: EUREKA_TOKEN.decimals,
        },
      },
    });

    setStatus(wasAdded ? "EUREKA token added in MetaMask." : "MetaMask token add was canceled.");
  }, []);

  const sendToken = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!browserProvider || !wallet.connected) {
        setStatus("Connect a wallet before sending EUREKA.");
        return;
      }

      try {
        if (!ethers.isAddress(sendTo)) {
          throw new Error("Recipient address is invalid.");
        }
        if (!sendAmount || Number(sendAmount) <= 0) {
          throw new Error("Amount must be greater than zero.");
        }

        const signer = await browserProvider.getSigner();
        const contract = new Contract(EUREKA_TOKEN.contractAddress, ERC20_ABI, signer);
        const tx = await contract.transfer(sendTo, parseUnits(sendAmount, EUREKA_TOKEN.decimals));
        setStatus("Transaction submitted. Waiting for confirmation...");
        await tx.wait();

        setTxHash(tx.hash);
        setRecentTransactions((prev) => [{ hash: tx.hash, createdAt: Date.now() }, ...prev].slice(0, 5));
        await refreshBalances(browserProvider, wallet.address);
        setSendTo("");
        setSendAmount("");
        setStatus("EUREKA transfer confirmed.");
      } catch (error) {
        setStatus(`Transfer failed: ${(error as Error).message}`);
      }
    },
    [browserProvider, refreshBalances, sendAmount, sendTo, wallet.address, wallet.connected]
  );

  useEffect(() => {
    if (!browserProvider || !wallet.address || !wallet.connected) return;
    const interval = window.setInterval(() => {
      refreshBalances(browserProvider, wallet.address).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [browserProvider, refreshBalances, wallet.address, wallet.connected]);

  const explorer = useMemo(() => parseChain(wallet.chainId || EUREKA_TOKEN.chainId).explorer, [wallet.chainId]);
  const walletStatus = wallet.connected ? "Connected" : "Disconnected";

  return (
    <div className="min-h-screen bg-tinan-black text-white">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img alt="EUREKA logo" className="h-11 w-11 rounded-xl bg-black/40 p-1" src="/logo.svg" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-tinan-cyan">TINAN EUREKA</p>
            <h1 className="text-2xl font-semibold text-white">TinanEureka</h1>
          </div>
        </div>
        <nav className="glass cyan-outline flex flex-wrap items-center gap-1 px-2 py-2 text-sm">
          {[
            ["/", "Home"],
            ["/dashboard", "Dashboard"],
            ["/wallet", "Wallet"],
            ["/ai-chat", "AI Chat"],
            ["/swap", "Swap"],
            ["/staking", "Staking"],
            ["/explorer", "Explorer"],
            ["/settings", "Settings"],
          ].map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 ${isActive ? "bg-tinan-cyan text-black" : "text-white/75 hover:bg-white/10"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-10">
        <section className="glass cyan-outline grid gap-2 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-tinan-cyan">Wallet status</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
            <span>{walletStatus}</span>
            <span>•</span>
            <span>{wallet.network}</span>
            <span>•</span>
            <span>{wallet.address ? shorten(wallet.address) : "No wallet"}</span>
          </div>
          <p className="text-sm text-white/70">{status}</p>
        </section>

        <Routes>
          <Route
            path="/"
            element={
              <div className="grid gap-4 md:grid-cols-2">
                <section className="glass cyan-outline p-5">
                  <h2 className="text-xl font-semibold">One App. Every Chain. Infinite Possibilities.</h2>
                  <p className="mt-3 text-white/75">
                    Futuristic premium TinanEureka interface powered by React, Vite, TypeScript, Tailwind, MetaMask, and WalletConnect.
                  </p>
                </section>
                <section className="glass p-5">
                  <h3 className="text-lg font-medium text-tinan-cyan">EUREKA Token Configuration</h3>
                  <ul className="mt-3 space-y-2 text-sm text-white/80">
                    <li>Name: {EUREKA_TOKEN.name}</li>
                    <li>Symbol: {EUREKA_TOKEN.symbol}</li>
                    <li>Decimals: {EUREKA_TOKEN.decimals}</li>
                    <li>Chain ID: {EUREKA_TOKEN.chainId}</li>
                    <li className="break-all">Contract: {EUREKA_TOKEN.contractAddress}</li>
                  </ul>
                </section>
              </div>
            }
          />

          <Route
            path="/dashboard"
            element={
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["EUREKA Balance", `${wallet.tokenBalance} ${EUREKA_TOKEN.symbol}`],
                  ["Native Balance", `${wallet.nativeBalance} ${wallet.nativeSymbol}`],
                  ["Total Supply", wallet.totalSupply],
                  ["Burned Tokens", wallet.burnedTokens],
                  ["Connected Network", wallet.network],
                  ["Wallet Address", wallet.address ? shorten(wallet.address) : "Disconnected"],
                ].map(([label, value]) => (
                  <article key={label} className="glass p-4">
                    <p className="text-xs uppercase tracking-wider text-tinan-cyan">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                  </article>
                ))}
              </div>
            }
          />

          <Route
            path="/wallet"
            element={
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="glass cyan-outline p-5">
                  <h2 className="text-lg font-semibold">Connect Wallet</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button className="rounded-xl bg-tinan-cyan px-4 py-2 font-semibold text-black" onClick={connectInjected}>
                      MetaMask
                    </button>
                    <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2" onClick={connectWalletConnect}>
                      WalletConnect
                    </button>
                    <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2" onClick={disconnect}>
                      Disconnect
                    </button>
                    <button
                      className="rounded-xl border border-white/20 bg-white/5 px-4 py-2"
                      onClick={() => wallet.address && navigator.clipboard.writeText(wallet.address)}
                      disabled={!wallet.address}
                    >
                      Copy Address
                    </button>
                  </div>

                  <dl className="mt-5 grid grid-cols-1 gap-2 text-sm">
                    <DataCard label="Wallet address" value={wallet.address || "—"} breakAll />
                    <DataCard label="EUREKA balance" value={wallet.tokenBalance} />
                    <DataCard label={`${wallet.nativeSymbol} / Native balance`} value={wallet.nativeBalance} />
                    <DataCard label="Network" value={wallet.network} />
                  </dl>
                </section>

                <section className="glass p-5">
                  <h2 className="text-lg font-semibold">Token Actions</h2>
                  <form className="mt-4 grid gap-3" onSubmit={sendToken}>
                    <input
                      className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white"
                      placeholder="Recipient address"
                      value={sendTo}
                      onChange={(event) => setSendTo(event.target.value.trim())}
                    />
                    <input
                      className="rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-white"
                      placeholder="Amount in EUREKA"
                      value={sendAmount}
                      onChange={(event) => setSendAmount(event.target.value.trim())}
                    />
                    <button className="rounded-xl bg-tinan-cyan px-4 py-2 font-semibold text-black" type="submit">
                      Send EUREKA
                    </button>
                  </form>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button className="rounded-xl border border-white/20 bg-white/5 px-4 py-2" onClick={addToken}>
                      Add Token to MetaMask
                    </button>
                    <button
                      className="rounded-xl border border-white/20 bg-white/5 px-4 py-2"
                      onClick={() => window.open(`${explorer}/token/${EUREKA_TOKEN.contractAddress}`, "_blank", "noopener,noreferrer")}
                    >
                      View Contract
                    </button>
                    <button
                      className="rounded-xl border border-white/20 bg-white/5 px-4 py-2"
                      onClick={() => {
                        if (!wallet.address) return;
                        window.open(
                          `${explorer}/token/${EUREKA_TOKEN.contractAddress}?a=${wallet.address}`,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                      disabled={!wallet.address}
                    >
                      View Wallet Transactions
                    </button>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-wider text-tinan-cyan">Recent transactions</p>
                    {recentTransactions.length === 0 ? (
                      <p className="mt-2 text-sm text-white/65">No recent transactions yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {recentTransactions.map((tx) => (
                          <li key={tx.hash}>
                            <a
                              className="break-all text-tinan-cyan hover:underline"
                              href={`${explorer}/tx/${tx.hash}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {tx.hash}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {txHash && (
                    <p className="mt-3 break-all text-sm text-white/70">
                      Last transaction: <a className="text-tinan-cyan" href={`${explorer}/tx/${txHash}`}>{txHash}</a>
                    </p>
                  )}
                </section>
              </div>
            }
          />

          <Route
            path="/ai-chat"
            element={<Placeholder title="AI Chat" subtitle="TINAN AI conversational workflows and automations are ready to connect." />}
          />
          <Route path="/swap" element={<Placeholder title="Swap" subtitle="Multi-chain swap routing is prepared for DEX integrations." />} />
          <Route
            path="/staking"
            element={<Placeholder title="Staking" subtitle="Staking controls are provisioned for protocol reward modules." />}
          />
          <Route
            path="/explorer"
            element={
              <section className="glass p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-tinan-cyan">Explorer</p>
                <h2 className="mt-2 text-2xl font-semibold">On-chain Explorer</h2>
                <p className="mt-2 text-white/75">Open EUREKA contract and wallet activity directly on the active network explorer.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <a
                    className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-center"
                    href={`${explorer}/token/${EUREKA_TOKEN.contractAddress}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Contract
                  </a>
                  <a
                    className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-center"
                    href={wallet.address ? `${explorer}/address/${wallet.address}` : `${explorer}/token/${EUREKA_TOKEN.contractAddress}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Wallet
                  </a>
                </div>
              </section>
            }
          />
          <Route
            path="/settings"
            element={
              <Placeholder
                title="Settings"
                subtitle="Manage display, wallet preferences, and environment variables for integrations."
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function DataCard({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <dt className="text-tinan-cyan">{label}</dt>
      <dd className={`mt-1 text-white/90 ${breakAll ? "break-all" : ""}`}>{value}</dd>
    </div>
  );
}

function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="glass p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-tinan-cyan">{title}</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-white/75">{subtitle}</p>
    </section>
  );
}
