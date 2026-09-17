export const APP_CONFIG = Object.freeze({
  app: {
    name: 'EurekaCore',
    aiName: 'TINAN AI',
    tokenLabel: 'EUREKA',
    storageNamespace: 'eurekacore.v3.cloudflare',
    tagline: 'Natural intelligence for the Base-native EUREKA ecosystem.',
  },
  brand: {
    siteName: 'Tinan Eureka',
    domain: 'www.tinaneureka.com',
    githubRepository: 'EurikaProtocol/EurekaCore',
  },
  network: {
    name: 'Base',
    chainId: 8453,
    chainHex: '0x2105',
    nativeSymbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org',
    currency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  token: {
    name: 'EUREKA',
    symbol: 'EUREKA',
    contractAddress: '0x4042973c0863cca0d73f028ca98465f44f0e6f97',
    decimals: 18,
  },
  integrations: {
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() ?? '',
    coinbaseWalletUrl: 'https://go.cb-w.com/dapp',
  },
});

export const NAV_ITEMS = Object.freeze([
  ['/', 'Landing'],
  ['/dashboard', 'Dashboard'],
  ['/wallet', 'Wallet'],
  ['/tinan-ai', 'TINAN AI'],
  ['/token', 'Token'],
]);

export const ECOSYSTEM_ITEMS = Object.freeze([
  {
    title: 'Landing Experience',
    copy: 'Animated emerald hero, domain-forward branding, and direct entry into the Base-native EUREKA ecosystem.',
  },
  {
    title: 'Wallet Control',
    copy: 'MetaMask, WalletConnect v2, and Coinbase Wallet access with explicit Base network switching and send/receive flows.',
  },
  {
    title: 'Dashboard Visibility',
    copy: 'Portfolio, wallet balance, EUREKA balance, activity, and notifications in one production-ready console.',
  },
  {
    title: 'TINAN AI Agents',
    copy: 'Wallet, knowledge, token, and developer agents with prompt history for repeatable operator workflows.',
  },
  {
    title: 'Token Telemetry',
    copy: 'Live contract metadata, total supply reads, and BaseScan exits sourced from a single configuration layer.',
  },
  {
    title: 'Cloudflare Delivery',
    copy: 'Vite build output is served through Wrangler with SPA routing for www.tinaneureka.com.',
  },
]);

export const ROADMAP_ITEMS = Object.freeze([
  {
    phase: 'Phase 01',
    title: 'Launch the public Base deployment',
    copy: 'Ship the Emerald landing experience, domain routing, and token telemetry for the live EUREKA contract.',
  },
  {
    phase: 'Phase 02',
    title: 'Expand wallet operations',
    copy: 'Enable richer send, receive, and account visibility flows while keeping every action wallet approved.',
  },
  {
    phase: 'Phase 03',
    title: 'Scale TINAN AI workflows',
    copy: 'Grow agent-driven prompts for knowledge, token operations, developer guidance, and wallet monitoring.',
  },
  {
    phase: 'Phase 04',
    title: 'Deepen ecosystem automation',
    copy: 'Layer in richer analytics, release notifications, and Cloudflare deployment hardening without changing the core brand.',
  },
]);

export const AGENT_DEFS = Object.freeze([
  {
    id: 'wallet-agent',
    name: 'Wallet Agent',
    description: 'Summarizes wallet state, Base network readiness, and operational next steps.',
  },
  {
    id: 'knowledge-agent',
    name: 'Knowledge Agent',
    description: 'Answers product, roadmap, and deployment questions from the built-in EurekaCore knowledge graph.',
  },
  {
    id: 'token-agent',
    name: 'Token Agent',
    description: 'Explains EUREKA token metadata, supply telemetry, contract routing, and explorer links.',
  },
  {
    id: 'developer-agent',
    name: 'Developer Agent',
    description: 'Guides Cloudflare deploy, configuration, and frontend extension workflows.',
  },
]);

export const DEFAULT_NOTIFICATIONS = Object.freeze([
  {
    title: 'Cloudflare deployment target ready',
    copy: 'www.tinaneureka.com is configured as the primary production domain.',
    tone: 'success',
  },
  {
    title: 'Base network pinned',
    copy: 'Wallet actions and explorer links point to Base and the live EUREKA contract.',
    tone: 'success',
  },
  {
    title: 'WalletConnect project ID optional',
    copy: 'Add VITE_WALLETCONNECT_PROJECT_ID to unlock WalletConnect v2 pairing in production.',
    tone: 'warning',
  },
]);
