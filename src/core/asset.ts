import { EKA_TOKEN } from '../config/token';
import { TINANAI_SOLANA } from '../config/tinanai-solana';

export type EcosystemAsset = {
  id: 'eka' | 'tinanai';
  name: string;
  symbol: string;
  network: string;
  type: 'EVM' | 'Solana';
  location: string;
  status: 'ready' | 'needs-config';
  summary: string;
};

export const ECOSYSTEM_ASSETS: EcosystemAsset[] = [
  {
    id: 'eka',
    name: EKA_TOKEN.name,
    symbol: EKA_TOKEN.symbol,
    network: EKA_TOKEN.chainName,
    type: 'EVM',
    location: EKA_TOKEN.contractAddress,
    status: 'ready',
    summary: 'Primary EVM asset used for Ethereum-based wallet, explorer, and contract flows.',
  },
  {
    id: 'tinanai',
    name: 'TinanAI Token',
    symbol: 'TINANAI',
    network: TINANAI_SOLANA.network,
    type: 'Solana',
    location: TINANAI_SOLANA.mintAddress ?? 'Requires VITE_TINANAI_SOLANA_MINT',
    status: TINANAI_SOLANA.mintAddress ? 'ready' : 'needs-config',
    summary: 'Solana launch asset kept separate from EKA in configuration, routing, and wallet logic.',
  },
];
