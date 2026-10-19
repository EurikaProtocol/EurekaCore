import { isValidEvmAddress, isValidSolanaAddress } from './verify';
import { fail, ok, type Result } from './errors';

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

export type EcosystemAssetSources = {
  eka: { name: string; symbol: string; chainName: string; contractAddress: string };
  tinanai: { network: string; mintAddress: string | null };
};

/** Pure construction from supplied configuration; see src/config/ecosystem-assets.ts for the app binding. */
export function createEcosystemAssets({ eka, tinanai }: EcosystemAssetSources): EcosystemAsset[] {
  return [
    {
      id: 'eka',
      name: eka.name,
      symbol: eka.symbol,
      network: eka.chainName,
      type: 'EVM',
      location: eka.contractAddress,
      status: 'ready',
      summary: 'Primary EVM asset used for Ethereum-based wallet, explorer, and contract flows.',
    },
    {
      id: 'tinanai',
      name: 'TinanAI Token',
      symbol: 'TINANAI',
      network: tinanai.network,
      type: 'Solana',
      location: tinanai.mintAddress ?? 'Requires VITE_TINANAI_SOLANA_MINT',
      status: tinanai.mintAddress ? 'ready' : 'needs-config',
      summary: 'Solana launch asset kept separate from EKA in configuration, routing, and wallet logic.',
    },
  ];
}

/** Rejects malformed assets, including a "ready" asset whose address is invalid for its chain family. */
export function validateEcosystemAsset(asset: EcosystemAsset): Result<EcosystemAsset> {
  if (!asset.name.trim() || !asset.symbol.trim() || !asset.network.trim()) {
    return fail('INVALID_INPUT', 'Asset name, symbol and network are required.');
  }
  if (asset.type !== 'EVM' && asset.type !== 'Solana') {
    return fail('UNSUPPORTED', `Unsupported asset type: ${String(asset.type)}`);
  }
  if (asset.status === 'ready') {
    const valid = asset.type === 'EVM' ? isValidEvmAddress(asset.location) : isValidSolanaAddress(asset.location);
    if (!valid) return fail('INVALID_INPUT', `A ready ${asset.type} asset needs a valid address.`);
  }
  return ok(asset);
}
