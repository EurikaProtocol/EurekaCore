import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';
import type EthereumProvider from '@walletconnect/ethereum-provider';
import { EKA_TOKEN } from '../config/token';
import { getEvmNetworkConfig } from '../config/networks';
import { isValidEvmAddress } from '../core/verify';
import { ERC20_ABI } from '../lib/erc20';

const BURN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dEaD',
] as const;

export type EvmWalletSnapshot = {
  address: string;
  chainId: number;
  network: string;
  nativeSymbol: string;
  nativeBalance: string;
  ekaBalance: string;
  totalSupply: string;
  burnedTokens: string;
  explorerBaseUrl: string;
  ekaReady: boolean;
  networkWarning: string | null;
};

function formatTokenAmount(value: bigint, decimals: number, maximumFractionDigits = 6) {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits });
}

export async function readEkaWalletSnapshot(provider: BrowserProvider, address: string): Promise<EvmWalletSnapshot> {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const networkConfig = getEvmNetworkConfig(chainId);
  const nativeBalance = await provider.getBalance(address);

  if (chainId !== EKA_TOKEN.chainId) {
    return {
      address,
      chainId,
      network: networkConfig.name,
      nativeSymbol: networkConfig.nativeSymbol,
      nativeBalance: formatTokenAmount(nativeBalance, 18),
      ekaBalance: 'Unavailable',
      totalSupply: 'Unavailable',
      burnedTokens: 'Unavailable',
      explorerBaseUrl: networkConfig.explorerBaseUrl,
      ekaReady: false,
      networkWarning: `EKA is deployed on ${EKA_TOKEN.chainName}. Switch networks before using token actions.`,
    };
  }

  const signer = await provider.getSigner();
  const contract = new Contract(EKA_TOKEN.contractAddress, ERC20_ABI, signer);
  const [tokenRaw, supplyRaw, burnedA, burnedB] = await Promise.all([
    contract.balanceOf(address),
    contract.totalSupply(),
    contract.balanceOf(BURN_ADDRESSES[0]),
    contract.balanceOf(BURN_ADDRESSES[1]),
  ]);

  return {
    address,
    chainId,
    network: networkConfig.name,
    nativeSymbol: networkConfig.nativeSymbol,
    nativeBalance: formatTokenAmount(nativeBalance, 18),
    ekaBalance: formatTokenAmount(tokenRaw, EKA_TOKEN.decimals),
    totalSupply: formatTokenAmount(supplyRaw, EKA_TOKEN.decimals, 2),
    burnedTokens: formatTokenAmount(burnedA + burnedB, EKA_TOKEN.decimals, 2),
    explorerBaseUrl: networkConfig.explorerBaseUrl,
    ekaReady: true,
    networkWarning: null,
  };
}

export async function sendEkaTransfer(provider: BrowserProvider, to: string, amount: string) {
  if (!isValidEvmAddress(to)) {
    throw new Error('Recipient address is invalid.');
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const signer = await provider.getSigner();
  const contract = new Contract(EKA_TOKEN.contractAddress, ERC20_ABI, signer);
  const tx = await contract.transfer(to, parseUnits(amount, EKA_TOKEN.decimals));
  return tx;
}

export async function requestWatchEkaAsset(ethereum: Window['ethereum']) {
  return ethereum?.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: EKA_TOKEN.contractAddress,
        symbol: EKA_TOKEN.symbol,
        decimals: EKA_TOKEN.decimals,
      },
    },
  });
}

export async function requestEthereumMainnet(ethereum: Window['ethereum']) {
  await ethereum?.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x1' }],
  });
}

export function getWalletConnectAddress(provider: EthereumProvider) {
  const accounts = provider.accounts || [];
  const address = accounts[0];
  if (!address || !isValidEvmAddress(address)) {
    throw new Error('WalletConnect did not provide a valid EVM address.');
  }
  return address;
}
