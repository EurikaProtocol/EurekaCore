import { BrowserProvider, Contract, JsonRpcProvider, formatEther, formatUnits, getAddress, isAddress } from "https://esm.sh/ethers@6.15.0";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.4?bundle";
import { PhantomWalletAdapter } from "https://esm.sh/@solana/wallet-adapter-phantom@0.9.28?bundle";
import EthereumProvider from "https://esm.sh/@walletconnect/ethereum-provider@2.21.5?bundle";
import CoinbaseWalletSDK from "https://esm.sh/@coinbase/wallet-sdk@3.9.3?bundle";

const EUREKA_TOKEN_ADDRESS = "PASTE_CONTRACT_HERE";
const WALLETCONNECT_PROJECT_ID = "PASTE_PROJECT_ID_HERE";
const TINAN_SOLANA_MINT = "PASTE_SOLANA_MINT_HERE";
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];
const APP_METADATA = {
  name: "EUREKA Wallet",
  description: "Read-only multichain wallet dashboard for EUREKA.",
  url: window.location.origin,
  icons: [`${window.location.origin}/assets/eureka-logo.svg`]
};
const chains = Array.isArray(window.EUREKA_NETWORKS) ? window.EUREKA_NETWORKS : [];
const evmChains = chains.filter(chain => chain.family === "evm");
const solanaChain = chains.find(chain => chain.family === "solana");
const ethereumChain = chains.find(chain => chain.id === "ethereum") || evmChains[0] || null;
const eurekaTokenChain = ethereumChain;
const eurekaTokenExplorerUrl = "https://etherscan.io/token";
const ENS_PROVIDER = ethereumChain ? new JsonRpcProvider(ethereumChain.rpcUrl) : null;
const providerCache = new Map();
const phantomAdapter = new PhantomWalletAdapter();
const coinbaseWalletSdk = new CoinbaseWalletSDK({
  appName: APP_METADATA.name,
  appLogoUrl: APP_METADATA.icons[0],
  darkMode: true
});

const walletPrimaryAction = document.getElementById("walletPrimaryAction");
const walletChainSelector = document.getElementById("walletChainSelector");
const walletConnectionHint = document.getElementById("walletConnectionHint");
const walletProviderName = document.getElementById("walletProviderName");
const walletConnectionBadge = document.getElementById("walletConnectionBadge");
const walletAddress = document.getElementById("walletAddress");
const walletEns = document.getElementById("walletEns");
const walletSelectedChain = document.getElementById("walletSelectedChain");
const walletNativeBalance = document.getElementById("walletNativeBalance");
const walletChainFamily = document.getElementById("walletChainFamily");
const walletTokenList = document.getElementById("walletTokenList");
const copyWalletAddressButton = document.getElementById("copyWalletAddressButton");
const disconnectWalletButton = document.getElementById("disconnectWalletButton");
const eurekaTokenStatus = document.getElementById("eurekaTokenStatus");
const eurekaTokenBalance = document.getElementById("eurekaTokenBalance");
const eurekaTokenSymbol = document.getElementById("eurekaTokenSymbol");
const eurekaTokenDecimals = document.getElementById("eurekaTokenDecimals");
const eurekaTokenSupply = document.getElementById("eurekaTokenSupply");
const eurekaTokenAddress = document.getElementById("eurekaTokenAddress");
const copyTokenAddressButton = document.getElementById("copyTokenAddressButton");
const viewTokenOnExplorer = document.getElementById("viewTokenOnExplorer");
const addTokenToMetaMaskButton = document.getElementById("addTokenToMetaMaskButton");
const tinanMintPlaceholder = document.getElementById("tinanMintPlaceholder");
const providerButtons = [...document.querySelectorAll("[data-wallet-provider]")];

const state = {
  selectedChain: window.EurekaOrbit?.getSelectedChain?.() || chains[0] || null,
  connectedWallet: null,
  providerFamily: null,
  address: "",
  ens: "Unavailable",
  nativeBalance: "—",
  chainBalanceSymbol: "",
  tokenBalance: "—",
  tokenMeta: {
    symbol: "EUREKA",
    decimals: "—",
    totalSupply: "—"
  },
  activeProviderLabel: null,
  evmProvider: null,
  walletConnectProvider: null,
  coinbaseProvider: null,
  busy: false
};

function getReadProvider(chain) {
  if (!chain?.rpcUrl) return null;
  if (!providerCache.has(chain.id)) {
    providerCache.set(chain.id, new JsonRpcProvider(chain.rpcUrl));
  }
  return providerCache.get(chain.id);
}

function getCompatibleDefaultChain(family) {
  if (family === "solana") return solanaChain || state.selectedChain;
  return evmChains.find(chain => chain.id === state.selectedChain?.id) || ethereumChain || evmChains[0] || state.selectedChain;
}

function setHint(message) {
  if (walletConnectionHint) {
    walletConnectionHint.textContent = message;
  }
}

function setBusy(isBusy) {
  state.busy = isBusy;
  if (walletPrimaryAction) {
    walletPrimaryAction.disabled = isBusy;
  }
  providerButtons.forEach(button => {
    button.disabled = isBusy;
  });
  if (disconnectWalletButton) {
    disconnectWalletButton.disabled = isBusy || !state.address;
  }
}

function formatAddress(value) {
  if (!value || value.length < 11) return value || "Not connected";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDisplayNumber(value, fractionDigits = 4) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits
  }).format(numericValue);
}

function updateTokenList(items) {
  if (!walletTokenList) return;
  walletTokenList.replaceChildren(
    ...items.map(item => {
      const listItem = document.createElement("li");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = item.label;
      value.textContent = item.value;
      listItem.append(label, value);
      return listItem;
    })
  );
}

function getRecommendedWallet() {
  return state.selectedChain?.family === "solana" ? "phantom" : "metamask";
}

function getChainFamilyLabel(chain) {
  if (!chain) return "Unavailable";
  if (chain.family === "solana") return "Solana";
  if (chain.family === "evm") return "EVM";
  return chain.ecosystem || "Unsupported";
}

function getWalletRequirementMessage(chain) {
  if (!chain) return "Connect a wallet to load balances.";
  if (chain.family === "solana") return "Connect Phantom for Solana";
  if (chain.family === "evm") return "Connect an EVM wallet";
  return `Wallet connection coming soon for ${chain.name}`;
}

function syncActiveProviderButtons() {
  const activeProvider = state.activeProviderLabel || getRecommendedWallet();
  providerButtons.forEach(button => {
    button.classList.toggle("is-active", button.dataset.walletProvider === activeProvider);
  });
}

function updatePrimaryButton() {
  if (!walletPrimaryAction) return;
  walletPrimaryAction.textContent = state.address ? "Refresh Wallet" : "Connect Wallet";
}

function updateContractLink() {
  if (!viewTokenOnExplorer) return;
  viewTokenOnExplorer.href = isAddress(EUREKA_TOKEN_ADDRESS)
    ? `${eurekaTokenExplorerUrl}/${EUREKA_TOKEN_ADDRESS}`
    : "https://etherscan.io/";
}

function renderState() {
  const selectedChain = state.selectedChain || getCompatibleDefaultChain("solana");
  const chainFamilyLabel = getChainFamilyLabel(selectedChain);
  const connectionLabel = state.connectedWallet || "Not connected";
  const connectionStatus = state.address ? "Connected" : "Idle";

  if (walletChainSelector && selectedChain) {
    walletChainSelector.value = selectedChain.id;
  }

  if (walletProviderName) {
    walletProviderName.textContent = connectionLabel;
  }

  if (walletConnectionBadge) {
    walletConnectionBadge.textContent = connectionStatus;
  }

  if (walletAddress) {
    walletAddress.textContent = state.address || "Not connected";
    walletAddress.title = state.address || "Not connected";
  }

  if (walletEns) {
    walletEns.textContent = state.ens || "Unavailable";
  }

  if (walletSelectedChain) {
    walletSelectedChain.textContent = selectedChain?.name || "Unavailable";
  }

  if (walletNativeBalance) {
    walletNativeBalance.textContent = state.nativeBalance || "—";
  }

  if (walletChainFamily) {
    walletChainFamily.textContent = chainFamilyLabel;
  }

  if (eurekaTokenAddress) {
    eurekaTokenAddress.textContent = EUREKA_TOKEN_ADDRESS;
    eurekaTokenAddress.title = EUREKA_TOKEN_ADDRESS;
  }

  if (eurekaTokenBalance) {
    eurekaTokenBalance.textContent = state.tokenBalance || "—";
  }

  if (eurekaTokenSymbol) {
    eurekaTokenSymbol.textContent = state.tokenMeta.symbol || "EUREKA";
  }

  if (eurekaTokenDecimals) {
    eurekaTokenDecimals.textContent = state.tokenMeta.decimals;
  }

  if (eurekaTokenSupply) {
    eurekaTokenSupply.textContent = state.tokenMeta.totalSupply;
  }

  if (eurekaTokenStatus) {
    eurekaTokenStatus.textContent = isAddress(EUREKA_TOKEN_ADDRESS) ? "Ethereum mainnet" : "Awaiting contract";
  }

  if (tinanMintPlaceholder) {
    tinanMintPlaceholder.textContent = TINAN_SOLANA_MINT;
  }

  if (copyWalletAddressButton) {
    copyWalletAddressButton.disabled = !state.address;
  }

  if (addTokenToMetaMaskButton) {
    addTokenToMetaMaskButton.disabled = !isAddress(EUREKA_TOKEN_ADDRESS) || !window.ethereum?.request;
  }

  updateContractLink();
  updatePrimaryButton();
  syncActiveProviderButtons();
}

function resetBalances() {
  state.nativeBalance = "—";
  state.chainBalanceSymbol = "";
  state.tokenBalance = "—";
}

function resetConnectionState() {
  state.connectedWallet = null;
  state.providerFamily = null;
  state.address = "";
  state.ens = "Unavailable";
  state.evmProvider = null;
  resetBalances();
}

async function copyToClipboard(value, successMessage) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  setHint(successMessage);
}

async function loadEns(address) {
  if (!ENS_PROVIDER || !address || !address.startsWith("0x")) {
    return "Unavailable";
  }

  try {
    return (await ENS_PROVIDER.lookupAddress(address)) || "Unavailable";
  } catch {
    return "Unavailable";
  }
}

async function loadEurekaTokenData() {
  if (!eurekaTokenChain || !isAddress(EUREKA_TOKEN_ADDRESS)) {
    state.tokenMeta = {
      symbol: "EUREKA",
      decimals: "—",
      totalSupply: "—"
    };
    state.tokenBalance = "Set contract address";
    return;
  }

  try {
    const contract = new Contract(EUREKA_TOKEN_ADDRESS, ERC20_ABI, getReadProvider(eurekaTokenChain));
    const [symbol, decimals, totalSupply, balance] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
      state.address && state.providerFamily === "evm" ? contract.balanceOf(state.address) : Promise.resolve(null)
    ]);

    state.tokenMeta = {
      symbol,
      decimals: String(decimals),
      totalSupply: `${formatDisplayNumber(formatUnits(totalSupply, decimals), 2)} ${symbol}`
    };
    state.tokenBalance = balance === null
      ? "Connect an EVM wallet for Ethereum readout"
      : `${formatDisplayNumber(formatUnits(balance, decimals))} ${symbol}`;
  } catch {
    state.tokenMeta = {
      symbol: "EUREKA",
      decimals: "—",
      totalSupply: "Unavailable"
    };
    state.tokenBalance = state.address ? "Unavailable" : "Connect an EVM wallet";
  }
}

async function refreshWalletData() {
  const selectedChain = state.selectedChain;

  resetBalances();

  if (!state.address || !selectedChain) {
    await loadEurekaTokenData();
    updateTokenList([
      {
        label: "Native",
        value: "Connect a wallet to load balances."
      }
    ]);
    renderState();
    return;
  }

  if (state.providerFamily === "evm" && selectedChain.family === "evm") {
    try {
      const readProvider = getReadProvider(selectedChain);
      const rawBalance = await readProvider.getBalance(state.address);
      state.nativeBalance = `${formatDisplayNumber(formatEther(rawBalance))} ${selectedChain.token}`;
      state.chainBalanceSymbol = selectedChain.token;
    } catch {
      state.nativeBalance = `Unavailable on ${selectedChain.name}`;
    }
  } else if (state.providerFamily === "solana" && selectedChain.family === "solana") {
    try {
      const connection = new Connection(selectedChain.rpcUrl, "confirmed");
      const lamports = await connection.getBalance(new PublicKey(state.address));
      state.nativeBalance = `${formatDisplayNumber(lamports / LAMPORTS_PER_SOL)} SOL`;
      state.chainBalanceSymbol = "SOL";
    } catch {
      state.nativeBalance = "Unavailable on Solana";
    }
  } else {
    state.nativeBalance = getWalletRequirementMessage(selectedChain);
  }

  await loadEurekaTokenData();

  if (state.providerFamily === "solana") {
    updateTokenList([
      {
        label: "Native SOL",
        value: state.nativeBalance
      },
      {
        label: "TINAN",
        value: "Coming Soon"
      }
    ]);
  } else if (state.providerFamily === "evm") {
    updateTokenList([
      {
        label: `${selectedChain.name} ${selectedChain.token}`,
        value: state.nativeBalance
      },
      {
        label: `${state.tokenMeta.symbol} (Ethereum)`,
        value: state.tokenBalance
      }
    ]);
  } else {
    updateTokenList([
      {
        label: "Native",
        value: "Connect a wallet to load balances."
      }
    ]);
  }

  renderState();
}

function ensureChainSelection(family) {
  const compatibleChain = getCompatibleDefaultChain(family);
  if (!compatibleChain || state.selectedChain?.family === family) return compatibleChain;
  window.EurekaOrbit?.selectChain?.(compatibleChain.id, "wallet");
  state.selectedChain = compatibleChain;
  return compatibleChain;
}

async function connectMetaMask() {
  if (!window.ethereum?.request) {
    throw new Error("MetaMask was not detected in this browser.");
  }

  state.activeProviderLabel = "metamask";
  const chain = ensureChainSelection("evm");
  if (!chain) {
    throw new Error("No EVM chain is configured for MetaMask.");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) {
    throw new Error("MetaMask did not return an account.");
  }

  state.connectedWallet = "MetaMask";
  state.providerFamily = "evm";
  state.evmProvider = new BrowserProvider(window.ethereum);
  state.address = getAddress(accounts[0]);
  state.ens = await loadEns(state.address);
  setHint(`Connected ${formatAddress(state.address)} with MetaMask in read-only mode.`);
}

async function connectCoinbaseWallet() {
  state.activeProviderLabel = "coinbase";
  const chain = ensureChainSelection("evm");
  if (!chain) {
    throw new Error("No EVM chain is configured for Coinbase Wallet.");
  }
  state.coinbaseProvider = coinbaseWalletSdk.makeWeb3Provider(chain.rpcUrl, chain.chainId);
  const accounts = await state.coinbaseProvider.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) {
    throw new Error("Coinbase Wallet did not return an account.");
  }

  state.connectedWallet = "Coinbase Wallet";
  state.providerFamily = "evm";
  state.evmProvider = new BrowserProvider(state.coinbaseProvider);
  state.address = getAddress(accounts[0]);
  state.ens = await loadEns(state.address);
  setHint(`Connected ${formatAddress(state.address)} with Coinbase Wallet in read-only mode.`);
}

async function connectWalletConnect() {
  state.activeProviderLabel = "walletconnect";

  if (WALLETCONNECT_PROJECT_ID === "PASTE_PROJECT_ID_HERE") {
    throw new Error("Set WALLETCONNECT_PROJECT_ID in wallet.js to enable WalletConnect.");
  }

  const chain = ensureChainSelection("evm");
  if (!chain) {
    throw new Error("No EVM chain is configured for WalletConnect.");
  }

  if (!state.walletConnectProvider) {
    state.walletConnectProvider = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: evmChains.map(network => network.chainId),
      showQrModal: true,
      metadata: APP_METADATA
    });
  }

  const accounts = await state.walletConnectProvider.enable();
  if (!accounts?.[0]) {
    throw new Error("WalletConnect did not return an account.");
  }

  state.connectedWallet = "WalletConnect";
  state.providerFamily = "evm";
  state.evmProvider = new BrowserProvider(state.walletConnectProvider);
  state.address = getAddress(accounts[0]);
  state.ens = await loadEns(state.address);
  setHint(`Connected ${formatAddress(state.address)} with WalletConnect in read-only mode.`);
}

async function connectPhantom() {
  if (!solanaChain) {
    throw new Error("Solana support is not configured.");
  }

  state.activeProviderLabel = "phantom";
  ensureChainSelection("solana");
  await phantomAdapter.connect();

  if (!phantomAdapter.publicKey) {
    throw new Error("Phantom did not return a public key.");
  }

  state.connectedWallet = "Phantom";
  state.providerFamily = "solana";
  state.address = phantomAdapter.publicKey.toBase58();
  state.ens = "Unavailable on Solana";
  setHint(`Connected ${formatAddress(state.address)} with Phantom in read-only mode.`);
}

async function connectWallet(providerKey) {
  setBusy(true);

  try {
    resetConnectionState();

    if (providerKey === "metamask") {
      await connectMetaMask();
    } else if (providerKey === "walletconnect") {
      await connectWalletConnect();
    } else if (providerKey === "coinbase") {
      await connectCoinbaseWallet();
    } else if (providerKey === "phantom") {
      await connectPhantom();
    } else {
      throw new Error("Unsupported wallet provider.");
    }

    await refreshWalletData();
  } catch (error) {
    resetConnectionState();
    setHint(error instanceof Error ? error.message : "Wallet connection failed.");
    await refreshWalletData();
  } finally {
    setBusy(false);
  }
}

async function disconnectWallet() {
  setBusy(true);

  try {
    if (phantomAdapter.connected) {
      await phantomAdapter.disconnect();
    }

    if (state.walletConnectProvider?.disconnect) {
      await state.walletConnectProvider.disconnect();
    }

    if (state.coinbaseProvider?.disconnect) {
      await state.coinbaseProvider.disconnect();
    }

    state.walletConnectProvider = null;
    state.coinbaseProvider = null;
    resetConnectionState();
    setHint("Wallet disconnected. Public address cleared from the dashboard.");
    await refreshWalletData();
  } finally {
    setBusy(false);
  }
}

function handleChainChange(chain) {
  if (!chain) return;
  state.selectedChain = chain;

  if (state.address) {
    if (state.providerFamily === "solana" && chain.family !== "solana") {
      state.nativeBalance = getWalletRequirementMessage(chain);
      setHint(
        chain.family === "evm"
          ? "Selected chain now requires an EVM wallet for live balances."
          : `Live wallet support for ${chain.name} is coming soon.`
      );
    } else if (state.providerFamily === "evm" && chain.family !== "evm") {
      state.nativeBalance = getWalletRequirementMessage(chain);
      setHint(
        chain.family === "solana"
          ? "Selected chain is Solana. Connect Phantom for live Solana balances."
          : `Live wallet support for ${chain.name} is coming soon.`
      );
    }
  }

  refreshWalletData();
}

if (walletChainSelector) {
  walletChainSelector.innerHTML = chains.map(chain => `
    <option value="${chain.id}">${chain.name}</option>
  `).join("");

  walletChainSelector.addEventListener("change", event => {
    const chainId = event.target.value;
    window.EurekaOrbit?.selectChain?.(chainId, "wallet-selector");
  });
}

walletPrimaryAction?.addEventListener("click", async () => {
  if (state.address) {
    setBusy(true);
    try {
      await refreshWalletData();
      setHint("Wallet balances refreshed.");
    } finally {
      setBusy(false);
    }
    return;
  }

  await connectWallet(getRecommendedWallet());
});

providerButtons.forEach(button => {
  button.addEventListener("click", async () => {
    await connectWallet(button.dataset.walletProvider);
  });
});

copyWalletAddressButton?.addEventListener("click", async () => {
  try {
    await copyToClipboard(state.address, "Wallet address copied.");
  } catch {
    setHint("Clipboard access was blocked by the browser.");
  }
});

copyTokenAddressButton?.addEventListener("click", async () => {
  try {
    await copyToClipboard(EUREKA_TOKEN_ADDRESS, "Token contract address copied.");
  } catch {
    setHint("Clipboard access was blocked by the browser.");
  }
});

disconnectWalletButton?.addEventListener("click", async () => {
  await disconnectWallet();
});

addTokenToMetaMaskButton?.addEventListener("click", async () => {
  if (!window.ethereum?.request) {
    setHint("MetaMask is required to add the token automatically.");
    return;
  }

  if (!isAddress(EUREKA_TOKEN_ADDRESS)) {
    setHint("Replace EUREKA_TOKEN_ADDRESS in wallet.js before adding the token.");
    return;
  }

  try {
    const decimals = Number(state.tokenMeta.decimals === "—" ? 18 : state.tokenMeta.decimals);
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: EUREKA_TOKEN_ADDRESS,
          symbol: state.tokenMeta.symbol || "EUREKA",
          decimals
        }
      }
    });
    setHint("EUREKA token prompt sent to MetaMask.");
  } catch {
    setHint("MetaMask rejected or could not add the token.");
  }
});

window.addEventListener("eureka:chain-selected", event => {
  handleChainChange(event.detail?.chain || null);
});

renderState();
await refreshWalletData();
