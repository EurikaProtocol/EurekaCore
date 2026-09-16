import { formatNumber } from "./utils.js";

const NETWORKS = {
  "0x1": "Ethereum Mainnet",
  "0x89": "Polygon",
  "0xa": "Optimism",
  "0x2105": "Base",
  "0xaa36a7": "Sepolia"
};

function providerRequest(provider, method, params = []) {
  return provider.request({ method, params });
}

function rpcPayload(method, params = []) {
  return {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  };
}

async function rpcRequest(config, method, params = []) {
  const response = await fetch(config.network.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rpcPayload(method, params))
  });
  const body = await response.json();
  if (body.error) {
    throw new Error(body.error.message || `${method} failed`);
  }
  return body.result;
}

function hexToBigInt(hexValue) {
  return hexValue ? BigInt(hexValue) : 0n;
}

function parseUnits(value, decimals) {
  const [whole, fraction = ""] = String(value).split(".");
  const paddedFraction = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
}

function formatUnits(rawValue, decimals) {
  const factor = 10n ** BigInt(decimals);
  const whole = rawValue / factor;
  const fraction = rawValue % factor;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6);
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
}

function encodeAddress(address) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function decodeAsciiFromHex(hexValue) {
  const stripped = hexValue.replace(/^0x/, "");
  if (!stripped) return "";
  const offset = Number.parseInt(stripped.slice(0, 64), 16);
  if (offset === 32 && stripped.length >= 192) {
    const length = Number.parseInt(stripped.slice(64, 128), 16);
    const data = stripped.slice(128, 128 + length * 2);
    return hexToUtf8(data);
  }
  return hexToUtf8(stripped);
}

function hexToUtf8(hexString) {
  let result = "";
  for (let index = 0; index < hexString.length; index += 2) {
    const pair = hexString.slice(index, index + 2);
    if (pair === "00") continue;
    result += String.fromCharCode(Number.parseInt(pair, 16));
  }
  return result;
}

async function ethCall(config, data, provider) {
  if (provider) {
    return providerRequest(provider, "eth_call", [{ to: config.token.contractAddress, data }, "latest"]);
  }
  return rpcRequest(config, "eth_call", [{ to: config.token.contractAddress, data }, "latest"]);
}

export function getEthereumProvider() {
  return window.ethereum || null;
}

export async function connectMetaMask() {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("MetaMask is not available in this browser.");
  }
  const accounts = await providerRequest(provider, "eth_requestAccounts");
  const chainId = await providerRequest(provider, "eth_chainId");
  return {
    provider,
    address: accounts[0],
    chainId,
    network: NETWORKS[chainId] || `Chain ${chainId}`
  };
}

export async function refreshWalletSnapshot(config, walletState) {
  if (!walletState.connected || !walletState.address) return walletState;
  const provider = getEthereumProvider();
  if (!provider) return walletState;

  const [chainId, nativeRaw, tokenRaw] = await Promise.all([
    providerRequest(provider, "eth_chainId"),
    providerRequest(provider, "eth_getBalance", [walletState.address, "latest"]),
    ethCall(config, `0x70a08231${encodeAddress(walletState.address)}`, provider)
  ]);

  return {
    ...walletState,
    chainId,
    network: NETWORKS[chainId] || `Chain ${chainId}`,
    nativeBalance: formatUnits(hexToBigInt(nativeRaw), 18),
    tokenBalance: formatUnits(hexToBigInt(tokenRaw), config.token.decimals)
  };
}

export async function loadTokenDetails(config) {
  const provider = getEthereumProvider();
  const [nameHex, symbolHex, supplyHex] = await Promise.all([
    ethCall(config, "0x06fdde03", provider).catch(() => null),
    ethCall(config, "0x95d89b41", provider).catch(() => null),
    ethCall(config, "0x18160ddd", provider).catch(() => null)
  ]);

  return {
    name: decodeAsciiFromHex(nameHex || "") || config.token.name,
    symbol: decodeAsciiFromHex(symbolHex || "") || config.token.symbol,
    totalSupply: supplyHex ? formatNumber(formatUnits(hexToBigInt(supplyHex), config.token.decimals), 2) : (config.token.totalSupply ?? "Unavailable"),
    contractAddress: config.token.contractAddress,
    holderCount: config.token.holderCountFallback
  };
}

export async function sendNativeTransfer(to, amount) {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("MetaMask is not available.");
  const [from] = await providerRequest(provider, "eth_accounts");
  if (!from) throw new Error("Connect MetaMask before sending a transfer.");
  const value = `0x${parseUnits(amount, 18).toString(16)}`;
  return providerRequest(provider, "eth_sendTransaction", [{ from, to, value }]);
}

export function explorerUrl(config) {
  return `${config.token.explorerBaseUrl}${config.token.contractAddress}`;
}

export function openCoinbaseDeepLink() {
  const encoded = encodeURIComponent(window.location.href);
  window.open(`https://go.cb-w.com/dapp?cb_url=${encoded}`, "_blank", "noopener");
}

export function walletConnectReady(config) {
  return Boolean(config.integrations.walletConnect.projectId);
}

export function coinbaseReady() {
  return true;
}
