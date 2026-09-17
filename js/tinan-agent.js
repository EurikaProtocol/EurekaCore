import { AGENT_DEFS } from './config.js';

const KNOWLEDGE_BASE = [
  'EurekaCore is deployed on Base and serves the live EUREKA contract through a Cloudflare-ready frontend.',
  'TINAN AI exposes wallet, knowledge, token, and developer agents with prompt history stored locally in the browser.',
  'Wallet actions require explicit user approval and the app reads token metadata from the shared config layer.',
  'Cloudflare deployment uses a Vite build followed by wrangler deploy for www.tinaneureka.com.',
];

function buildWalletReply(walletState, config) {
  if (!walletState.connected) {
    return `No wallet is connected yet. Use MetaMask, WalletConnect v2, or Coinbase Wallet and switch to ${config.network.name} to unlock ${config.token.symbol} actions.`;
  }

  if (!walletState.chainMatched) {
    return `The connected wallet is on ${walletState.network}. Switch to ${config.network.name} (${config.network.chainHex}) before sending or reading ${config.token.symbol}.`;
  }

  return `Wallet connected via ${walletState.providerType}. Current address ${walletState.address} holds ${walletState.nativeBalance} ${walletState.nativeSymbol} and ${walletState.tokenBalance} ${config.token.symbol}.`;
}

function buildTokenReply(tokenDetails, config) {
  return `${tokenDetails.name} (${tokenDetails.symbol}) is configured at ${tokenDetails.contractAddress} on ${config.network.name}. Decimals: ${tokenDetails.decimals}. Total supply: ${tokenDetails.totalSupply}.`;
}

function buildKnowledgeReply(config) {
  return KNOWLEDGE_BASE.join(' ');
}

function buildDeveloperReply(config) {
  return `Set VITE_WALLETCONNECT_PROJECT_ID if you want WalletConnect v2 pairing, then run npm install && npm run build to produce dist. Deploy with npx wrangler deploy and the worker will serve the Vite output on ${config.brand.domain} with SPA routing enabled.`;
}

export function getAgents() {
  return AGENT_DEFS;
}

export function getQuickPrompts() {
  return [
    'Summarize the current wallet status.',
    'What does the EUREKA token config look like?',
    'How do I deploy this app to Cloudflare?',
    'Explain the roadmap in operator terms.',
  ];
}

export function createAssistantReply({ agentId, prompt, walletState, tokenDetails, config }) {
  const lowered = prompt.toLowerCase();

  if (agentId === 'wallet-agent' || lowered.includes('wallet') || lowered.includes('connect') || lowered.includes('balance')) {
    return buildWalletReply(walletState, config);
  }

  if (agentId === 'token-agent' || lowered.includes('token') || lowered.includes('supply') || lowered.includes('contract')) {
    return buildTokenReply(tokenDetails, config);
  }

  if (agentId === 'developer-agent' || lowered.includes('deploy') || lowered.includes('cloudflare') || lowered.includes('wrangler') || lowered.includes('build')) {
    return buildDeveloperReply(config);
  }

  if (lowered.includes('roadmap')) {
    return 'The roadmap moves from public Base launch, to richer wallet operations, to larger TINAN AI workflows, and finally to ecosystem automation hardening.';
  }

  return buildKnowledgeReply(config);
}
