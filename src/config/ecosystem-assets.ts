import { createEcosystemAssets } from '../core/asset';
import { EKA_TOKEN } from './token';
import { TINANAI_SOLANA } from './tinanai-solana';

export const ECOSYSTEM_ASSETS = createEcosystemAssets({
  eka: EKA_TOKEN,
  tinanai: TINANAI_SOLANA,
});
