import EthereumProvider from '@walletconnect/ethereum-provider';
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  formatUnits,
  isAddress,
  parseUnits,
} from 'ethers';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const FALLBACK_TOKEN_DETAILS = {
  totalSupply: 'Unavailable',
  decimals: 18,
};

function formatValue(value, decimals, maximumFractionDigits = 4) {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits });
}

function getCandidateProviders() {
  if (!window.ethereum) return [];
  if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
    return window.ethereum.providers;
  }
  return [window.ethereum];
}

function getInjectedProvider(kind) {
  const providers = getCandidateProviders();
  if (!providers.length) return null;

  if (kind === 'coinbase') {
    return providers.find((provider) => provider?.isCoinbaseWallet) ?? null;
  }

  return (
    providers.find((provider) => provider?.isMetaMask && !provider?.isCoinbaseWallet) ??
    providers.find((provider) => provider?.isMetaMask) ??
    providers[0]
  );
}

async function requestConfiguredNetwork(rawProvider, config) {
  const chainParams = {
    chainId: config.network.chainHex,
    chainName: config.network.name,
    nativeCurrency: config.network.currency,
    rpcUrls: [config.network.rpcUrl],
    blockExplorerUrls: [config.network.explorerBaseUrl],
  };

  try {
    await rawProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.network.chainHex }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;

    await rawProvider.request({
      method: 'wallet_addEthereumChain',
      params: [chainParams],
    });
  }
}

async function buildWalletSession(rawProvider, providerType, config, options = {}) {
  const accounts = await rawProvider.request({ method: options.requestAccounts === false ? 'eth_accounts' : 'eth_requestAccounts' });
  const address = accounts?.[0];
  if (!address || !isAddress(address)) {
    if (options.optional) return null;
    throw new Error('A valid wallet address was not returned.');
  }

  if (options.switchNetwork !== false) {
    await requestConfiguredNetwork(rawProvider, config);
  }

  const browserProvider = new BrowserProvider(rawProvider);
  return {
    providerType,
    rawProvider,
    browserProvider,
    address,
  };
}

export async function connectInjectedWallet(providerType, config) {
  const provider = getInjectedProvider(providerType);
  if (!provider) {
    throw new Error(providerType === 'coinbase' ? 'Coinbase Wallet extension was not detected.' : 'MetaMask was not detected.');
  }

  return buildWalletSession(provider, providerType, config);
}

export async function restoreInjectedWallet(providerType, config) {
  const provider = getInjectedProvider(providerType);
  if (!provider) return null;
  return buildWalletSession(provider, providerType, config, {
    requestAccounts: false,
    switchNetwork: false,
    optional: true,
  });
}

export async function connectCoinbaseWallet(config) {
  const injectedProvider = getInjectedProvider('coinbase');
  if (injectedProvider) {
    return connectInjectedWallet('coinbase', config);
  }

  const url = `${config.integrations.coinbaseWalletUrl}?cb_url=${encodeURIComponent(`https://${config.brand.domain}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return {
    deepLinked: true,
    message: 'Coinbase Wallet deep link opened. Continue inside the Coinbase Wallet app or install the browser extension.',
  };
}

export async function connectWalletConnect(config) {
  if (!config.integrations.walletConnectProjectId) {
    throw new Error('Add VITE_WALLETCONNECT_PROJECT_ID to enable WalletConnect v2.');
  }

  const rawProvider = await EthereumProvider.init({
    projectId: config.integrations.walletConnectProjectId,
    chains: [config.network.chainId],
    showQrModal: true,
    metadata: {
      name: config.app.name,
      description: config.app.tagline,
      url: `https://${config.brand.domain}`,
      icons: ['https://www.tinaneureka.com/apple-touch-icon.png'],
    },
  });

  await rawProvider.enable();
  await requestConfiguredNetwork(rawProvider, config);
  const browserProvider = new BrowserProvider(rawProvider);
  const signer = await browserProvider.getSigner();
  const address = await signer.getAddress();

  return {
    providerType: 'walletconnect',
    rawProvider,
    browserProvider,
    address,
  };
}

export async function disconnectWallet(session) {
  if (!session) return;
  if (typeof session.rawProvider?.disconnect === 'function') {
    await session.rawProvider.disconnect();
  }
}

export async function loadTokenDetails(config) {
  const provider = new JsonRpcProvider(config.network.rpcUrl);
  const contract = new Contract(config.token.contractAddress, ERC20_ABI, provider);

  const decimalsResult = await contract.decimals().catch(() => config.token.decimals);
  const decimals = Number(decimalsResult ?? config.token.decimals);

  const [name, symbol, totalSupply] = await Promise.all([
    contract.name().catch(() => config.token.name),
    contract.symbol().catch(() => config.token.symbol),
    contract.totalSupply().catch(() => null),
  ]);

  return {
    name,
    symbol,
    decimals,
    totalSupply: totalSupply ? formatValue(totalSupply, decimals, 2) : FALLBACK_TOKEN_DETAILS.totalSupply,
    contractAddress: config.token.contractAddress,
    explorerUrl: `${config.network.explorerBaseUrl}/token/${config.token.contractAddress}`,
  };
}

export async function readWalletSnapshot(session, config, tokenDetails = FALLBACK_TOKEN_DETAILS) {
  if (!session?.browserProvider || !session.address) {
    return {
      connected: false,
      address: '',
      providerType: null,
      network: config.network.name,
      chainMatched: false,
      nativeSymbol: config.network.nativeSymbol,
      nativeBalance: '0',
      tokenBalance: '0',
      portfolio: 'Connect wallet',
      explorerAddressUrl: '',
    };
  }

  const { browserProvider, address, providerType } = session;
  const network = await browserProvider.getNetwork();
  const chainId = Number(network.chainId);
  const nativeBalance = await browserProvider.getBalance(address);
  const chainMatched = chainId === config.network.chainId;
  const tokenContract = new Contract(config.token.contractAddress, ERC20_ABI, browserProvider);
  const tokenBalanceRaw = chainMatched ? await tokenContract.balanceOf(address) : 0n;
  const tokenBalance = chainMatched ? formatValue(tokenBalanceRaw, tokenDetails.decimals ?? config.token.decimals) : 'Unavailable';
  const native = Number(formatEther(nativeBalance)).toLocaleString(undefined, { maximumFractionDigits: 4 });

  return {
    connected: true,
    address,
    providerType,
    network: network.name && network.name !== 'unknown' ? network.name : `Chain ${chainId}`,
    chainMatched,
    nativeSymbol: config.network.nativeSymbol,
    nativeBalance: native,
    tokenBalance,
    portfolio: chainMatched ? `${tokenBalance} ${tokenDetails.symbol ?? config.token.symbol}` : 'Switch to Base',
    explorerAddressUrl: `${config.network.explorerBaseUrl}/address/${address}`,
  };
}

export async function sendToken(session, recipient, amount, config, decimals = config.token.decimals) {
  if (!session?.browserProvider || !session?.address) {
    throw new Error('Connect a wallet before sending EUREKA.');
  }

  if (!isAddress(recipient)) {
    throw new Error('Recipient address is invalid.');
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  await requestConfiguredNetwork(session.rawProvider, config);
  const signer = await session.browserProvider.getSigner();
  const contract = new Contract(config.token.contractAddress, ERC20_ABI, signer);
  const tx = await contract.transfer(recipient, parseUnits(amount, decimals));
  return tx;
}

export async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

export function getBaseScanUrl(config, type, value) {
  return `${config.network.explorerBaseUrl}/${type}/${value}`;
}

export function shortenAddress(value, fallback = 'Not connected') {
  if (!value) return fallback;
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
