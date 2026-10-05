import { toTrustedUrl } from './verify';

export const PROJECT_IDENTITY = {
  brand: 'EUREKA',
  protocol: 'EUREKA Protocol',
  website: 'tinaneureka.com',
  websiteUrl: toTrustedUrl('https://www.tinaneureka.com'),
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
  ['/ai', 'AI'],
  ['/tokenize', 'Tokenize'],
  ['/create', 'Create'],
  ['/projects', 'Projects'],
  ['/dashboard', 'Dashboard'],
  ['/wallet', 'Wallet'],
  ['/tokens', 'Tokens'],
  ['/contracts', 'Contracts'],
  ['/deploy', 'Deploy'],
  ['/verify', 'Verify'],
  ['/community', 'Community'],
  ['/docs', 'Docs'],
  ['/about', 'About'],
  ['/settings', 'Settings'],
] as const;
