export const APP_CONFIG = Object.freeze({
  app: {
    name: 'EurekaCore',
    aiName: 'TINAN AI',
    tokenLabel: 'EUREKA',
    storageNamespace: 'eurekacore.data.tokenization.v1',
    tagline: 'Natural intelligence for verifiable data assets.',
    coreMessage: 'DATA → PROOF → TOKENIZATION → UTILITY',
    universeMessage: 'EUREKA · ONE UNIVERSE. ALL CHAINS. ALL DATA.',
  },
  brand: {
    siteName: 'Tinan Eureka',
    domain: 'www.tinaneureka.com',
    displayDomain: 'tinaneureka.com',
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
  storage: {
    defaultProvider: 'browser-vault',
    externalOnChainStorage: false,
  },
  whitepaper: {
    title: 'EUREKA CHAIN Whitepaper v2.0',
    path: '/whitepaper/EUREKA_CHAIN_Whitepaper_v2.pdf',
  },
  integrations: {
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() ?? '',
    coinbaseWalletUrl: 'https://go.cb-w.com/dapp',
  },
});

export const NAV_ITEMS = Object.freeze([
  ['/', 'HOME'],
  ['/eureka', 'EUREKA'],
  ['/data', 'DATA'],
  ['/dashboard', 'DASHBOARD'],
  ['/tinan-ai', 'TINAN AI'],
  ['/tokenize', 'TOKENIZE'],
  ['/my-assets', 'MY ASSETS'],
  ['/proofs', 'PROOFS'],
  ['/ecosystem', 'ECOSYSTEM'],
  ['/wallet', 'WALLET'],
  ['/whitepaper', 'WHITEPAPER'],
]);

export const DATA_TYPES = Object.freeze([
  { title: 'Photos', copy: 'Capture origin, metadata, and ownership references for visual evidence and memories.' },
  { title: 'Screenshots', copy: 'Preserve digital context, interface states, and user activity snapshots.' },
  { title: 'Video', copy: 'Record motion-based events while keeping large media files off-chain.' },
  { title: 'Audio', copy: 'Tokenize recordings, voice notes, and sound evidence with proof-ready metadata.' },
  { title: 'Documents & PDFs', copy: 'Hash contracts, reports, briefs, and documents into verifiable references.' },
  { title: 'Analytics & Datasets', copy: 'Structure CSV, JSON, and exported metrics as reusable knowledge assets.' },
]);

export const ECOSYSTEM_ITEMS = Object.freeze([
  {
    title: 'Existing Eureka Wallet Layer',
    copy: 'MetaMask, WalletConnect v2, and Coinbase Wallet remain active so users can connect to Base without replacing the current Web3 stack.',
  },
  {
    title: 'EUREKA Token Infrastructure',
    copy: 'The live EUREKA token configuration, contract telemetry, and explorer exits stay centralized in one runtime config layer.',
  },
  {
    title: 'Data Tokenizer',
    copy: 'Upload files, classify them with TINAN AI guidance, generate proofs, and create tokenized asset records in a unified interface.',
  },
  {
    title: 'Proof Registry',
    copy: 'Proof of Data, Proof of Action, and Proof of Knowledge records are stored as structured references with clear claim boundaries.',
  },
  {
    title: 'Private Browser Vault',
    copy: 'The default storage provider keeps uploaded files private in the local browser while the proof layer stores only lightweight references.',
  },
  {
    title: 'Multichain Readiness',
    copy: 'Base is active today, while future network expansion remains modular and only activates when real integrations are configured.',
  },
]);

export const TINAN_CAPABILITIES = Object.freeze([
  {
    title: 'Understand data',
    copy: 'Identify file classes, metadata, timestamps, and usage context before tokenization.',
  },
  {
    title: 'Organize and categorize',
    copy: 'Prepare structured descriptions, categories, and proof labels for each asset.',
  },
  {
    title: 'Extract knowledge',
    copy: 'Turn raw documents, notes, and datasets into knowledge-ready asset records.',
  },
  {
    title: 'Prepare token metadata',
    copy: 'Generate token IDs, proof references, and utility notes without overstating value.',
  },
]);

export const TOKENIZATION_WORKFLOW = Object.freeze([
  {
    title: 'Upload data',
    copy: 'Accept images, screenshots, audio, video, PDFs, documents, CSV, JSON, and other supported digital files.',
  },
  {
    title: 'Analyze data',
    copy: 'TINAN AI reviews file type, size, timestamps, metadata patterns, and potential utility using device-side analysis.',
  },
  {
    title: 'Create proof',
    copy: 'Generate a cryptographic hash, metadata record, content identifier, timestamp, and ownership reference.',
  },
  {
    title: 'Tokenize',
    copy: 'Create a tokenized asset record that references the proof instead of placing large files directly on-chain.',
  },
  {
    title: 'Manage asset utility',
    copy: 'Track verification status, storage references, network context, and future transaction readiness from one portfolio.',
  },
]);

export const ROADMAP_ITEMS = Object.freeze([
  {
    phase: 'Phase 1 — Foundation',
    title: 'Eureka ecosystem, TINAN AI, and proof architecture',
    copy: 'Establish the integrated data tokenization layer, Proof of Data, Proof of Action, Proof of Knowledge, and the base user experience.',
  },
  {
    phase: 'Phase 2 — Data Engine',
    title: 'Hashing, metadata extraction, verification, and storage',
    copy: 'Expand file hashing, metadata extraction, storage provider integration, and the tokenization workflow engine.',
  },
  {
    phase: 'Phase 3 — AI Intelligence',
    title: 'Smarter TINAN AI assistance',
    copy: 'Deliver richer classification, knowledge extraction, dataset creation, and AI-driven token preparation workflows.',
  },
  {
    phase: 'Phase 4 — Eureka Data Economy',
    title: 'Marketplace and developer ecosystem',
    copy: 'Open the path toward data marketplaces, cross-chain infrastructure, developer APIs, and third-party applications.',
  },
]);

export const PROOF_ITEMS = Object.freeze([
  {
    id: 'proof-of-data',
    title: 'Proof of Data',
    copy: 'A cryptographically verifiable record that connects a digital asset with metadata, timestamp, origin reference, and blockchain-ready fields.',
  },
  {
    id: 'proof-of-action',
    title: 'Proof of Action',
    copy: 'A record of a user-driven digital action that produced a file or event, plus the resulting proof trail and tokenization metadata.',
  },
  {
    id: 'proof-of-knowledge',
    title: 'Proof of Knowledge',
    copy: 'A structured knowledge record created with TINAN AI assistance that preserves provenance without pretending to prove unverifiable claims.',
  },
]);

export const NETWORK_SUPPORT = Object.freeze([
  {
    name: 'Base',
    status: 'active',
    copy: 'Wallet connection, network switching, and explorer links are configured and active in the current application.',
  },
  {
    name: 'Ethereum',
    status: 'planned',
    copy: 'Eureka ecosystem architecture may expand here later, but this root application does not enable Ethereum wallet flows today.',
  },
  {
    name: 'Arbitrum',
    status: 'planned',
    copy: 'Prepared conceptually for future multichain expansion once real integrations exist.',
  },
  {
    name: 'Polygon',
    status: 'planned',
    copy: 'Shown only as future architecture; no active root-site integration is exposed yet.',
  },
  {
    name: 'Optimism',
    status: 'planned',
    copy: 'Potential future network path once supported by real wallet and registry infrastructure.',
  },
  {
    name: 'Solana',
    status: 'planned',
    copy: 'Legacy repository code references Solana, but the current production root-site flow does not expose Solana features here.',
  },
]);

export const DEFAULT_NOTIFICATIONS = Object.freeze([
  {
    title: 'Proof engine ready',
    copy: 'The Data Tokenizer can hash files, create proof records, and keep uploaded files private by default.',
    tone: 'success',
  },
  {
    title: 'Base network pinned',
    copy: 'Wallet actions and explorer links point to Base and the live EUREKA contract.',
    tone: 'success',
  },
  {
    title: 'External storage is modular',
    copy: 'IPFS and Arweave style providers remain optional until production upload infrastructure is configured.',
    tone: 'warning',
  },
]);

export const AGENT_DEFS = Object.freeze([
  {
    id: 'data-agent',
    name: 'Data Agent',
    description: 'Explains asset categories, metadata, privacy, and tokenization readiness.',
  },
  {
    id: 'proof-agent',
    name: 'Proof Agent',
    description: 'Clarifies Proof of Data, Proof of Action, Proof of Knowledge, and verification boundaries.',
  },
  {
    id: 'wallet-agent',
    name: 'Wallet Agent',
    description: 'Summarizes wallet state, Base network readiness, and operational next steps.',
  },
  {
    id: 'token-agent',
    name: 'Token Agent',
    description: 'Explains EUREKA token metadata, utility disclaimers, contract routing, and explorer links.',
  },
  {
    id: 'developer-agent',
    name: 'Developer Agent',
    description: 'Guides Cloudflare deployment, storage architecture, and frontend extension workflows.',
  },
]);
