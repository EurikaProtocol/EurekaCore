import { AGENT_DEFS } from './config.js';

const KNOWLEDGE_BASE = [
  'Eureka integrates data, proof, tokenization, and utility into one ecosystem message.',
  'The Data Tokenizer keeps large files off-chain and stores only hashes, timestamps, ownership references, and lightweight metadata in proof records.',
  'TINAN AI acts as the natural intelligence layer that helps users classify information, structure datasets, and prepare proof-backed asset metadata.',
  'Economic value is not automatic. Tokenization provides a verification layer, while value depends on utility, demand, data quality, and ecosystem adoption.',
  'Base is the active network in the current root application, and additional chains remain roadmap items until production integrations are enabled.',
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
  return `${tokenDetails.name} (${tokenDetails.symbol}) is configured at ${tokenDetails.contractAddress} on ${config.network.name}. Decimals: ${tokenDetails.decimals}. Total supply: ${tokenDetails.totalSupply}. Tokenization does not automatically assign market value to any asset.`;
}

function buildDataReply(assetSummary, config) {
  const count = assetSummary?.assets ?? 0;
  const proofCount = assetSummary?.proofs ?? 0;
  return `The Data Tokenizer currently tracks ${count} asset${count === 1 ? '' : 's'} and ${proofCount} proof record${proofCount === 1 ? '' : 's'} locally. Uploaded files stay private by default and the proof layer stores hashes, timestamps, metadata, and ownership references.`;
}

function buildProofReply() {
  return 'Proof of Data verifies file-level metadata, hashes, timestamps, and storage references. Proof of Action links a user-triggered event to the created artifact. Proof of Knowledge structures human-created information into auditable knowledge assets without claiming unverifiable truth.';
}

function buildDeveloperReply(config) {
  return `Run npm install && npm run build to produce dist, then deploy with npx wrangler deploy. The root site uses modular config, local proof storage, and Base wallet flows, so future storage or token registry integrations can be added without rewriting the front-end.`;
}

export function getAgents() {
  return AGENT_DEFS;
}

export function getQuickPrompts() {
  return [
    'Explain Proof of Data in simple terms.',
    'How does the Data Tokenizer keep files off-chain?',
    'Summarize the current wallet status.',
    'How can TINAN AI help prepare a knowledge asset?',
    'What does the EUREKA token configuration look like?',
    'How do I deploy this site to Cloudflare?',
  ];
}

export function createAssistantReply({ agentId, prompt, walletState, tokenDetails, config, assetSummary }) {
  const lowered = prompt.toLowerCase();

  if (agentId === 'wallet-agent' || lowered.includes('wallet') || lowered.includes('connect') || lowered.includes('balance')) {
    return buildWalletReply(walletState, config);
  }

  if (agentId === 'token-agent' || lowered.includes('token') || lowered.includes('supply') || lowered.includes('contract')) {
    return buildTokenReply(tokenDetails, config);
  }

  if (agentId === 'data-agent' || lowered.includes('data') || lowered.includes('asset') || lowered.includes('tokenize') || lowered.includes('upload')) {
    return buildDataReply(assetSummary, config);
  }

  if (agentId === 'proof-agent' || lowered.includes('proof') || lowered.includes('knowledge') || lowered.includes('action')) {
    return buildProofReply();
  }

  if (agentId === 'developer-agent' || lowered.includes('deploy') || lowered.includes('cloudflare') || lowered.includes('wrangler') || lowered.includes('build')) {
    return buildDeveloperReply(config);
  }

  if (lowered.includes('roadmap')) {
    return 'The roadmap starts with proof architecture, moves into data engines and storage integrations, then expands TINAN AI intelligence and the wider Eureka data economy.';
  }

  return KNOWLEDGE_BASE.join(' ');
}
