import { EVM_NETWORKS, type EvmNetworkConfig, type SupportedEvmChain } from '../config/networks';
import { getSolscanAddressUrl } from '../solana/connection';
import { normalizeSolanaNetwork, type SolanaNetworkName } from '../solana/constants';
import { isValidEvmAddress, isValidSolanaAddress } from '../core/verify';

export interface BlockchainAdapter {
  readonly family: 'EVM' | 'Solana';
  readonly networkName: string;
  getAddressExplorerUrl(address: string): string | null;
}

export class EVMAdapter implements BlockchainAdapter {
  readonly family = 'EVM' as const;
  readonly config: EvmNetworkConfig;
  readonly networkName: string;

  constructor(chainId: SupportedEvmChain) {
    this.config = EVM_NETWORKS[chainId];
    this.networkName = this.config.name;
  }

  getAddressExplorerUrl(address: string): string | null {
    return isValidEvmAddress(address) ? `${this.config.explorerBaseUrl}/address/${address}` : null;
  }
}

export class SolanaAdapter implements BlockchainAdapter {
  readonly family = 'Solana' as const;
  readonly network: SolanaNetworkName;
  readonly networkName: string;

  constructor(network?: string) {
    this.network = normalizeSolanaNetwork(network);
    this.networkName = this.network;
  }

  getAddressExplorerUrl(address: string): string | null {
    return isValidSolanaAddress(address) ? getSolscanAddressUrl(address) : null;
  }
}
