import { Connection } from '@solana/web3.js';
import { TINANAI_SOLANA } from '../config/tinanai-solana';
import { getSolanaClusterQuery } from './constants';

let cachedConnection: Connection | null = null;

export function getSolanaConnection() {
  if (!cachedConnection) {
    cachedConnection = new Connection(TINANAI_SOLANA.rpcUrl, 'confirmed');
  }

  return cachedConnection;
}

export function getSolscanAddressUrl(address: string) {
  return `${TINANAI_SOLANA.explorerBaseUrl}/account/${address}${getSolanaClusterQuery(TINANAI_SOLANA.network)}`;
}

export function getSolscanTokenUrl(mintAddress: string) {
  return `${TINANAI_SOLANA.explorerBaseUrl}/token/${mintAddress}${getSolanaClusterQuery(TINANAI_SOLANA.network)}`;
}
