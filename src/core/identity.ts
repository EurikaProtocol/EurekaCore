import { toTrustedUrl } from './verify';

export const PROJECT_IDENTITY = {
  brand: 'TinanEureka',
  protocol: 'EUREKA Protocol',
  website: 'tinaneureka.com',
  websiteUrl: toTrustedUrl('https://tinaneureka.com'),
  coreAI: 'TinanAI',
  coreEngine: 'EurekaCore',
  evmTokenSymbol: 'EKA',
  solanaTokenLabel: 'TinanAI Token',
  githubUrl: toTrustedUrl('https://github.com/EurikaProtocol/EurekaCore'),
  whitepaperTitle: 'EUREKA CHAIN Whitepaper v2.0',
  whitepaperPath: '/whitepaper/EUREKA_CHAIN_Whitepaper_v2.pdf',
} as const;

export const PRIMARY_NAVIGATION = [
  ['/', 'Home'],
  ['/dashboard', 'Dashboard'],
  ['/wallet', 'Wallet'],
  ['/tinan-ai', 'TinanAI'],
  ['/marketplace', 'Marketplace'],
  ['/whitepaper', 'Whitepaper'],
  ['/staking', 'Staking'],
  ['/swap', 'Swap'],
  ['/explorer', 'Explorer'],
  ['/settings', 'Settings'],
  ['/tinan-ai-token', 'TinanAI Token'],
  ['/pumpfun', 'Pump.fun'],
] as const;
