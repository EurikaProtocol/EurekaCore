import './styles.css';
import footerTemplate from './components/footer.html?raw';
import headerTemplate from './components/header.html?raw';
import receiveModalTemplate from './components/receive-modal.html?raw';
import toastTemplate from './components/toast.html?raw';
import dashboardPage from './pages/dashboard.html?raw';
import dataPage from './pages/data.html?raw';
import ecosystemPage from './pages/ecosystem.html?raw';
import landingPage from './pages/landing.html?raw';
import myAssetsPage from './pages/my-assets.html?raw';
import proofsPage from './pages/proofs.html?raw';
import tinanPage from './pages/tinan-ai.html?raw';
import tokenPage from './pages/token.html?raw';
import tokenizePage from './pages/tokenize.html?raw';
import walletPage from './pages/wallet.html?raw';
import whitepaperPage from './pages/whitepaper.html?raw';
import {
  AGENT_DEFS,
  APP_CONFIG,
  DATA_TYPES,
  DEFAULT_NOTIFICATIONS,
  ECOSYSTEM_ITEMS,
  NAV_ITEMS,
  NETWORK_SUPPORT,
  PROOF_ITEMS,
  ROADMAP_ITEMS,
  TINAN_CAPABILITIES,
  TOKENIZATION_WORKFLOW,
} from './js/config.js';
import { createAssistantReply, getAgents, getQuickPrompts } from './js/tinan-agent.js';
import {
  ASSET_FILTERS,
  PROOF_TYPE_DEFS,
  STORAGE_PROVIDER_DEFS,
  analyzeFile,
  buildAssetDownloadName,
  createDataAssetRecord,
  formatBytes,
  getPrivateFile,
  loadDataState,
  matchesAssetFilter,
  saveDataState,
} from './js/data-tokenization.js';
import {
  connectCoinbaseWallet,
  connectInjectedWallet,
  connectWalletConnect,
  copyText,
  disconnectWallet,
  loadTokenDetails,
  readWalletSnapshot,
  restoreInjectedWallet,
  sendToken,
  shortenAddress,
} from './js/wallet.js';

const app = document.getElementById('app');
const routes = {
  '/': { pageId: '/', navKey: '/', template: landingPage },
  '/dashboard': { pageId: '/dashboard', navKey: '/dashboard', template: dashboardPage },
  '/wallet': { pageId: '/wallet', navKey: '/wallet', template: walletPage },
  '/tinan-ai': { pageId: '/tinan-ai', navKey: '/tinan-ai', template: tinanPage },
  '/eureka': { pageId: '/eureka', navKey: '/eureka', template: tokenPage },
  '/token': { pageId: '/eureka', navKey: '/eureka', template: tokenPage },
  '/data': { pageId: '/data', navKey: '/data', template: dataPage },
  '/tokenize': { pageId: '/tokenize', navKey: '/tokenize', template: tokenizePage },
  '/my-assets': { pageId: '/my-assets', navKey: '/my-assets', template: myAssetsPage },
  '/proofs': { pageId: '/proofs', navKey: '/proofs', template: proofsPage },
  '/ecosystem': { pageId: '/ecosystem', navKey: '/ecosystem', template: ecosystemPage },
  '/whitepaper': { pageId: '/whitepaper', navKey: '/whitepaper', template: whitepaperPage },
};

const storageKey = APP_CONFIG.app.storageNamespace;
const initialChatMessage = {
  role: 'assistant',
  agentId: 'data-agent',
  createdAt: nowLabel(),
  content: `Welcome to ${APP_CONFIG.app.aiName}. I can explain Proof of Data, help you prepare a tokenized asset, summarize wallet status, and describe the Eureka roadmap.`,
};
const initialState = {
  route: normalizeRoute(window.location.pathname),
  receiveOpen: false,
  activeAgent: 'data-agent',
  lastProviderType: '',
  toastMessage: '',
  walletSession: null,
  assetFilter: 'ALL',
  focusedProofId: '',
  selectedFile: null,
  analysisResult: null,
  lastCreatedAssetId: '',
  tokenizerForm: {
    title: '',
    description: '',
    tags: '',
    proofType: PROOF_TYPE_DEFS[0].id,
    storageProvider: APP_CONFIG.storage.defaultProvider,
    visibility: 'private',
  },
  tokenizerStatus: 'Select a file to begin a proof-backed tokenization workflow.',
  dataAssets: [],
  proofs: [],
  wallet: {
    connected: false,
    address: '',
    providerType: null,
    network: APP_CONFIG.network.name,
    chainMatched: false,
    nativeSymbol: APP_CONFIG.network.nativeSymbol,
    nativeBalance: '0',
    tokenBalance: '0',
    portfolio: 'Connect wallet',
    explorerAddressUrl: '',
    status: 'Ready to connect a Base wallet.',
  },
  tokenDetails: {
    name: APP_CONFIG.token.name,
    symbol: APP_CONFIG.token.symbol,
    decimals: APP_CONFIG.token.decimals,
    totalSupply: 'Loading…',
    contractAddress: APP_CONFIG.token.contractAddress,
    explorerUrl: `${APP_CONFIG.network.explorerBaseUrl}/token/${APP_CONFIG.token.contractAddress}`,
  },
  activity: [],
  notifications: DEFAULT_NOTIFICATIONS.map((entry) => ({ ...entry, createdAt: nowLabel() })),
  promptHistory: [],
  chat: [initialChatMessage],
};

const persistedState = loadPersistedState();
const state = {
  ...initialState,
  ...persistedState,
  tokenizerForm: {
    ...initialState.tokenizerForm,
    ...(persistedState.tokenizerForm ?? {}),
  },
};
let toastTimer = 0;
let shouldFocusReceiveModal = false;
let receiveModalListeners = null;
let walletSessionListeners = null;

boot();

async function boot() {
  if (!app) return;
  const dataState = loadDataState(storageKey);
  state.dataAssets = Array.isArray(dataState.assets) ? dataState.assets : [];
  state.proofs = Array.isArray(dataState.proofs) ? dataState.proofs : [];
  window.addEventListener('popstate', handlePopState);
  recordActivity('Application ready', `${APP_CONFIG.app.name} initialized for ${APP_CONFIG.brand.displayDomain}.`);
  render();
  try {
    await hydrateTokenDetails();
  } finally {
    await restoreWalletSession().catch(() => undefined);
  }
}

function resolveRoute(value) {
  const pathname = new URL(value, window.location.origin).pathname;
  if (routes[pathname]) {
    return { path: pathname, ...routes[pathname], params: {} };
  }

  const assetMatch = pathname.match(/^\/assets\/([^/]+)$/);
  if (assetMatch) {
    return {
      path: pathname,
      pageId: '/assets/:id',
      navKey: '/my-assets',
      template: '',
      params: { assetId: decodeURIComponent(assetMatch[1]) },
    };
  }

  return { path: '/', ...routes['/'], params: {} };
}

function normalizeRoute(value) {
  return resolveRoute(value).path;
}

function handlePopState() {
  state.route = normalizeRoute(window.location.pathname);
  render();
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      route: normalizeRoute(window.location.pathname),
      receiveOpen: false,
      activeAgent: parsed.activeAgent ?? initialState.activeAgent,
      lastProviderType: parsed.lastProviderType ?? initialState.lastProviderType,
      assetFilter: parsed.assetFilter ?? initialState.assetFilter,
      tokenizerForm: parsed.tokenizerForm ?? initialState.tokenizerForm,
      activity: Array.isArray(parsed.activity) ? parsed.activity.slice(0, 10) : initialState.activity,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications.slice(0, 10) : initialState.notifications,
      promptHistory: Array.isArray(parsed.promptHistory) ? parsed.promptHistory.slice(0, 12) : initialState.promptHistory,
      chat: Array.isArray(parsed.chat) && parsed.chat.length ? parsed.chat.slice(0, 20) : initialState.chat,
    };
  } catch {
    return {};
  }
}

function persistState() {
  const snapshot = {
    route: state.route,
    activeAgent: state.activeAgent,
    lastProviderType: state.lastProviderType,
    assetFilter: state.assetFilter,
    tokenizerForm: state.tokenizerForm,
    activity: state.activity.slice(0, 10),
    notifications: state.notifications.slice(0, 10),
    promptHistory: state.promptHistory.slice(0, 12),
    chat: state.chat.slice(0, 20),
  };
  localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function persistDataRecords() {
  saveDataState(storageKey, {
    assets: state.dataAssets,
    proofs: state.proofs,
  });
}

function hydrateTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? '')),
    template
  );
}

function navMarkup(currentRoute) {
  return NAV_ITEMS.map(([href, label]) => {
    const resolved = resolveRoute(href);
    return `<a class="nav-link ${currentRoute.navKey === resolved.navKey ? 'is-active' : ''}" href="${href}" data-route="${href}">${label}</a>`;
  }).join('');
}

function getCurrentAsset() {
  const currentRoute = resolveRoute(state.route);
  if (currentRoute.pageId !== '/assets/:id') return null;
  return state.dataAssets.find((entry) => entry.id === currentRoute.params.assetId) ?? null;
}

function renderAssetPageMarkup(asset) {
  if (!asset) {
    return `
      <section class="page-shell">
        <article class="page-panel glass-outline stack">
          <p class="eyebrow">Asset not found</p>
          <h1 class="section-title">This asset is not available in your local portfolio.</h1>
          <p class="section-copy">Return to My Assets to create or review a different proof-backed data asset.</p>
          <div class="hero-actions">
            <a class="button primary" href="/my-assets" data-route="/my-assets">Back to My Assets</a>
            <a class="button ghost" href="/tokenize" data-route="/tokenize">Create asset</a>
          </div>
        </article>
      </section>
    `;
  }

  const transactionButton = asset.transactionExplorerUrl
    ? `<a class="button ghost" href="${escapeAttribute(asset.transactionExplorerUrl)}" target="_blank" rel="noreferrer">View transaction</a>`
    : '<button class="button subtle" type="button" disabled>View transaction · coming soon</button>';
  const tokenButton = asset.tokenExplorerUrl
    ? `<a class="button ghost" href="${escapeAttribute(asset.tokenExplorerUrl)}" target="_blank" rel="noreferrer">View token</a>`
    : '<button class="button subtle" type="button" disabled>View token · coming soon</button>';

  return `
    <section class="page-shell">
      <article class="page-panel glass-outline stack">
        <div class="status-row">
          <div>
            <p class="eyebrow">Data Asset</p>
            <h1 class="section-title">${escapeHtml(asset.name)}</h1>
          </div>
          <span class="status-chip ${asset.visibility === 'private' ? '' : 'success'}">${escapeHtml(asset.visibility)} asset</span>
        </div>
        <p class="section-copy">${escapeHtml(asset.description)}</p>
        <div class="asset-action-row">
          <button class="button primary" type="button" data-view-proof="${escapeAttribute(asset.proofId)}">View proof</button>
          ${transactionButton}
          ${tokenButton}
          <button class="button ghost" type="button" data-copy-hash="${escapeAttribute(asset.hash)}">Copy hash</button>
          <button class="button subtle" type="button" data-copy-token="${escapeAttribute(asset.tokenId)}">Copy token ID</button>
          ${asset.fileAvailable ? `<button class="button subtle" type="button" data-open-file="${escapeAttribute(asset.id)}">Open local file</button>` : ''}
        </div>
      </article>

      <div class="two-column two-column-balanced">
        <article class="page-panel glass-outline stack">
          <p class="eyebrow">Asset metadata</p>
          <div class="detail-grid compact-grid">
            <div class="detail-item"><div class="detail-label">Asset type</div><div class="detail-value">${escapeHtml(asset.categoryLabel)}</div></div>
            <div class="detail-item"><div class="detail-label">Owner</div><div class="detail-value code">${escapeHtml(asset.owner)}</div></div>
            <div class="detail-item"><div class="detail-label">Creation date</div><div class="detail-value">${escapeHtml(formatDate(asset.createdAt))}</div></div>
            <div class="detail-item"><div class="detail-label">File size</div><div class="detail-value">${escapeHtml(asset.fileSizeLabel)}</div></div>
            <div class="detail-item"><div class="detail-label">Hash</div><div class="detail-value code">${escapeHtml(asset.hash)}</div></div>
            <div class="detail-item"><div class="detail-label">Proof ID</div><div class="detail-value code">${escapeHtml(asset.proofId)}</div></div>
            <div class="detail-item"><div class="detail-label">Token ID</div><div class="detail-value code">${escapeHtml(asset.tokenId)}</div></div>
            <div class="detail-item"><div class="detail-label">Blockchain</div><div class="detail-value">${escapeHtml(asset.network)}</div></div>
            <div class="detail-item"><div class="detail-label">Storage reference</div><div class="detail-value code">${escapeHtml(asset.storageReference)}</div></div>
            <div class="detail-item"><div class="detail-label">Verification status</div><div class="detail-value">${escapeHtml(asset.verificationStatus)}</div></div>
            <div class="detail-item"><div class="detail-label">Transaction status</div><div class="detail-value">${escapeHtml(asset.transactionStatus)}</div></div>
            <div class="detail-item"><div class="detail-label">Content identifier</div><div class="detail-value code">${escapeHtml(asset.contentIdentifier)}</div></div>
          </div>
        </article>

        <article class="page-panel glass-outline stack">
          <p class="eyebrow">Utility context</p>
          <div class="detail-item">
            <div class="detail-label">Potential utility</div>
            <div class="detail-value">${escapeHtml(asset.potentialUtility)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Related information</div>
            <div class="detail-value">${escapeHtml(asset.relatedInformation)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Metadata facts</div>
            <div class="detail-value">${asset.metadataFacts.map((item) => `<div>${escapeHtml(item)}</div>`).join('')}</div>
          </div>
        </article>
      </div>
    </section>
  `;
}

function pageMarkup() {
  const currentRoute = resolveRoute(state.route);
  const template = currentRoute.pageId === '/assets/:id' ? renderAssetPageMarkup(getCurrentAsset()) : currentRoute.template;
  return hydrateTemplate(template, {
    APP_NAME: APP_CONFIG.app.name,
    AI_NAME: APP_CONFIG.app.aiName,
    TOKEN_SYMBOL: escapeHtml(state.tokenDetails.symbol),
    CONTRACT_ADDRESS: state.tokenDetails.contractAddress,
    NETWORK_NAME: APP_CONFIG.network.name,
  });
}

function render() {
  const currentRoute = resolveRoute(state.route);
  const walletLabel = state.wallet.connected ? shortenAddress(state.wallet.address) : 'Connect wallet';
  app.innerHTML = `
    <div class="app-shell">
      ${hydrateTemplate(headerTemplate, {
        APP_NAME: APP_CONFIG.app.name,
        AI_NAME: APP_CONFIG.app.aiName,
        NETWORK_NAME: APP_CONFIG.network.name,
        DOMAIN: APP_CONFIG.brand.displayDomain,
        NAV_ITEMS: navMarkup(currentRoute),
        GLOBAL_WALLET_LABEL: walletLabel,
      })}
      <main class="page-grid">${pageMarkup()}</main>
      ${hydrateTemplate(footerTemplate, {
        APP_NAME: APP_CONFIG.app.name,
        AI_NAME: APP_CONFIG.app.aiName,
        TOKEN_SYMBOL: escapeHtml(state.tokenDetails.symbol),
        NETWORK_NAME: APP_CONFIG.network.name,
        DOMAIN: APP_CONFIG.brand.displayDomain,
        CONTRACT_ADDRESS: state.tokenDetails.contractAddress,
      })}
    </div>
    ${hydrateTemplate(receiveModalTemplate, {
      RECEIVE_OPEN_CLASS: state.receiveOpen ? 'is-open' : '',
      RECEIVE_HIDDEN: String(!state.receiveOpen),
      RECEIVE_ADDRESS: state.wallet.address || 'Connect a wallet first',
      RECEIVE_EXPLORER_URL: state.wallet.explorerAddressUrl || state.tokenDetails.explorerUrl,
      TOKEN_SYMBOL: escapeHtml(state.tokenDetails.symbol),
    })}
    ${toastTemplate}
  `;

  attachGlobalHandlers();
  renderPageState(currentRoute);
  persistState();
  if (state.toastMessage) {
    const message = state.toastMessage;
    state.toastMessage = '';
    showToast(message);
  }
}

function attachGlobalHandlers() {
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.getAttribute('data-route'));
    });
  });

  document.getElementById('globalConnectButton')?.addEventListener('click', async () => {
    if (state.wallet.connected) {
      navigate('/wallet');
      return;
    }
    await handleMetaMaskConnect();
  });

  document.getElementById('closeReceiveModal')?.addEventListener('click', () => {
    closeReceiveModal();
  });

  document.getElementById('copyReceiveAddress')?.addEventListener('click', async () => {
    if (!state.wallet.address) {
      showToast('Connect a wallet first.');
      return;
    }
    await copyText(state.wallet.address);
    showToast('Receive address copied.');
  });

  document.querySelectorAll('[data-copy-hash]').forEach((button) => {
    button.addEventListener('click', async () => {
      await copyText(button.getAttribute('data-copy-hash') || '');
      showToast('Hash copied.');
    });
  });

  document.querySelectorAll('[data-copy-token]').forEach((button) => {
    button.addEventListener('click', async () => {
      await copyText(button.getAttribute('data-copy-token') || '');
      showToast('Token ID copied.');
    });
  });

  document.querySelectorAll('[data-view-proof]').forEach((button) => {
    button.addEventListener('click', () => {
      openProof(button.getAttribute('data-view-proof') || '');
    });
  });

  document.querySelectorAll('[data-open-file]').forEach((button) => {
    button.addEventListener('click', async () => {
      const asset = state.dataAssets.find((entry) => entry.id === button.getAttribute('data-open-file'));
      if (!asset) return;
      await openAssetFile(asset);
    });
  });

  syncReceiveModal();
}

function renderPageState(currentRoute) {
  if (currentRoute.pageId === '/') renderLanding();
  if (currentRoute.pageId === '/dashboard') renderDashboard();
  if (currentRoute.pageId === '/wallet') renderWallet();
  if (currentRoute.pageId === '/tinan-ai') renderTinanAi();
  if (currentRoute.pageId === '/eureka') renderToken();
  if (currentRoute.pageId === '/data') renderData();
  if (currentRoute.pageId === '/tokenize') renderTokenize();
  if (currentRoute.pageId === '/my-assets') renderMyAssets();
  if (currentRoute.pageId === '/proofs') renderProofs();
  if (currentRoute.pageId === '/ecosystem') renderEcosystem();
  if (currentRoute.pageId === '/whitepaper') renderWhitepaper();
  if (currentRoute.pageId === '/assets/:id') renderAssetDetail();
}

function renderLanding() {
  const walletStatus = document.getElementById('heroWalletStatus');
  if (walletStatus) {
    walletStatus.textContent = state.wallet.connected ? `Connected • ${shortenAddress(state.wallet.address)}` : 'Wallet disconnected';
  }

  const dataTypeGrid = document.getElementById('dataTypeGrid');
  if (dataTypeGrid) {
    dataTypeGrid.innerHTML = DATA_TYPES.map(
      (item) => `
        <article class="tile glass-outline">
          <h3 class="tile-title">${escapeHtml(item.title)}</h3>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  const capabilityGrid = document.getElementById('tinanCapabilitiesGrid');
  if (capabilityGrid) {
    capabilityGrid.innerHTML = TINAN_CAPABILITIES.map(
      (item) => `
        <article class="tile glass-outline">
          <h3 class="tile-title">${escapeHtml(item.title)}</h3>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  const ecosystemGrid = document.getElementById('ecosystemGrid');
  if (ecosystemGrid) {
    ecosystemGrid.innerHTML = ECOSYSTEM_ITEMS.map(
      (item) => `
        <article class="tile glass-outline">
          <h3 class="tile-title">${escapeHtml(item.title)}</h3>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  const roadmapGrid = document.getElementById('roadmapGrid');
  if (roadmapGrid) {
    roadmapGrid.innerHTML = ROADMAP_ITEMS.map(
      (item) => `
        <article class="timeline-step glass-outline">
          <p class="eyebrow">${escapeHtml(item.phase)}</p>
          <strong>${escapeHtml(item.title)}</strong>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  document.getElementById('heroConnectButton')?.addEventListener('click', async () => {
    await handleMetaMaskConnect();
  });
}

function renderDashboard() {
  setText('portfolioValue', state.wallet.connected ? state.wallet.portfolio : 'Connect wallet');
  setText('portfolioMeta', state.wallet.connected ? `Connected via ${state.wallet.providerType}` : 'Base-native summary');
  setText('walletBalanceValue', state.wallet.connected ? `${state.wallet.nativeBalance} ${state.wallet.nativeSymbol}` : 'Connect wallet');
  setText('walletBalanceMeta', state.wallet.connected ? state.wallet.network : 'Native Base balance');
  setText('tokenBalanceValue', state.wallet.connected ? `${state.wallet.tokenBalance} ${state.tokenDetails.symbol}` : 'Connect wallet');
  setText('tokenBalanceMeta', state.wallet.connected ? `Contract ${shortenAddress(state.tokenDetails.contractAddress)}` : 'Token balance on Base');
  setText('notificationsBadge', `${state.notifications.length} update${state.notifications.length === 1 ? '' : 's'}`);
  setText('networkStatusValue', state.wallet.connected ? (state.wallet.chainMatched ? 'Base ready' : 'Switch network') : 'Connect wallet');
  setText('networkStatusMeta', state.wallet.connected ? state.wallet.status : 'Status feed');

  const activityList = document.getElementById('activityList');
  if (activityList) {
    activityList.innerHTML = state.activity.length
      ? state.activity.map((entry) => `<li class="activity-item"><div class="list-row"><strong>${escapeHtml(entry.title)}</strong><span class="notification-time">${escapeHtml(entry.createdAt)}</span></div><p class="activity-copy">${escapeHtml(entry.copy)}</p></li>`).join('')
      : '<li class="empty-card">No wallet or asset activity yet.</li>';
  }

  const notificationsList = document.getElementById('notificationsList');
  if (notificationsList) {
    notificationsList.innerHTML = state.notifications.length
      ? state.notifications.map((entry) => `<li class="notification-item"><div class="card-row"><span class="notification-dot"></span><strong>${escapeHtml(entry.title)}</strong></div><p class="notification-copy">${escapeHtml(entry.copy)}</p><p class="notification-time">${escapeHtml(entry.createdAt)}</p></li>`).join('')
      : '<li class="empty-card">No notifications.</li>';
  }
}

function renderWallet() {
  setText('walletStatusBadge', state.wallet.connected ? (state.wallet.chainMatched ? 'Connected' : 'Wrong network') : 'Disconnected');
  setText('walletAddressValue', state.wallet.address || 'Not connected');
  setText('walletNetworkValue', state.wallet.connected ? state.wallet.network : APP_CONFIG.network.name);
  setText('walletNativeValue', `${state.wallet.nativeBalance} ${state.wallet.nativeSymbol}`);
  setText('walletTokenValue', `${state.wallet.tokenBalance} ${state.tokenDetails.symbol}`);
  setText('walletConnectStatus', state.wallet.status);

  const explorerButton = document.getElementById('walletExplorerButton');
  if (explorerButton) {
    explorerButton.href = state.wallet.explorerAddressUrl || state.tokenDetails.explorerUrl;
  }

  document.getElementById('connectMetaMask')?.addEventListener('click', handleMetaMaskConnect);
  document.getElementById('connectWalletConnect')?.addEventListener('click', handleWalletConnect);
  document.getElementById('connectCoinbase')?.addEventListener('click', handleCoinbaseConnect);
  document.getElementById('disconnectAction')?.addEventListener('click', handleDisconnect);
  document.getElementById('receiveAction')?.addEventListener('click', () => {
    if (!state.wallet.address) {
      showToast('Connect a wallet before opening receive mode.');
      return;
    }
    openReceiveModal();
  });
  document.getElementById('copyAddressAction')?.addEventListener('click', async () => {
    if (!state.wallet.address) {
      showToast('Connect a wallet first.');
      return;
    }
    await copyText(state.wallet.address);
    showToast('Wallet address copied.');
  });
  document.getElementById('refreshWalletAction')?.addEventListener('click', async () => {
    await refreshWalletState('Wallet state refreshed.', { recordActivity: true });
  });
  document.getElementById('sendForm')?.addEventListener('submit', handleSend);
}

function renderData() {
  const workflowGrid = document.getElementById('workflowGrid');
  if (workflowGrid) {
    workflowGrid.innerHTML = TOKENIZATION_WORKFLOW.map(
      (item, index) => `
        <article class="tile glass-outline">
          <p class="eyebrow">Step ${index + 1}</p>
          <h3 class="tile-title">${escapeHtml(item.title)}</h3>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  const storageProviderGrid = document.getElementById('storageProviderGrid');
  if (storageProviderGrid) {
    storageProviderGrid.innerHTML = STORAGE_PROVIDER_DEFS.map(
      (provider) => `
        <div class="detail-item">
          <div class="detail-label">${escapeHtml(provider.label)}</div>
          <div class="detail-value">${escapeHtml(provider.description)}</div>
          <p class="helper-copy">${provider.enabled ? 'Enabled now' : 'Coming soon'} · ${escapeHtml(provider.type)}</p>
        </div>
      `
    ).join('');
  }

  const networkSupportGrid = document.getElementById('networkSupportGrid');
  if (networkSupportGrid) {
    networkSupportGrid.innerHTML = NETWORK_SUPPORT.map(
      (entry) => `
        <div class="detail-item">
          <div class="detail-label">${escapeHtml(entry.name)}</div>
          <div class="detail-value">${escapeHtml(entry.copy)}</div>
          <p class="helper-copy">${entry.status === 'active' ? 'Active now' : 'Roadmap only'}</p>
        </div>
      `
    ).join('');
  }
}

function renderTokenize() {
  const fileLabel = document.getElementById('selectedFileLabel');
  if (fileLabel) {
    fileLabel.textContent = state.selectedFile ? `${state.selectedFile.name} • ${formatBytes(state.selectedFile.size)}` : 'No file selected';
  }

  const titleInput = document.getElementById('assetTitleInput');
  if (titleInput) titleInput.value = state.tokenizerForm.title;
  const descriptionInput = document.getElementById('assetDescriptionInput');
  if (descriptionInput) descriptionInput.value = state.tokenizerForm.description;
  const tagsInput = document.getElementById('assetTagsInput');
  if (tagsInput) tagsInput.value = state.tokenizerForm.tags;

  const proofTypeSelect = document.getElementById('proofTypeSelect');
  if (proofTypeSelect) {
    proofTypeSelect.innerHTML = PROOF_TYPE_DEFS.map((entry) => `<option value="${entry.id}">${escapeHtml(entry.label)}</option>`).join('');
    proofTypeSelect.value = state.tokenizerForm.proofType;
  }

  const storageProviderSelect = document.getElementById('storageProviderSelect');
  if (storageProviderSelect) {
    storageProviderSelect.innerHTML = STORAGE_PROVIDER_DEFS.map(
      (entry) => `<option value="${entry.id}" ${entry.enabled ? '' : 'disabled'}>${escapeHtml(entry.label)}${entry.enabled ? '' : ' — Coming soon'}</option>`
    ).join('');
    storageProviderSelect.value = state.tokenizerForm.storageProvider;
  }

  const visibilitySelect = document.getElementById('visibilitySelect');
  if (visibilitySelect) visibilitySelect.value = state.tokenizerForm.visibility;

  renderAnalysisGrid();
  renderProofGrid();
  renderAssetOutputGrid();
  setText('tokenizerStatusMessage', state.tokenizerStatus);

  document.getElementById('tokenizerFileInput')?.addEventListener('change', (event) => {
    const input = event.currentTarget;
    const [file] = input.files ?? [];
    state.selectedFile = file ?? null;
    state.analysisResult = null;
    state.lastCreatedAssetId = '';
    state.tokenizerStatus = file ? `Ready to analyze ${file.name}.` : 'Select a file to begin a proof-backed tokenization workflow.';
    render();
  });

  document.getElementById('proofTypeSelect')?.addEventListener('change', syncTokenizerFormFromDom);
  document.getElementById('storageProviderSelect')?.addEventListener('change', syncTokenizerFormFromDom);
  document.getElementById('visibilitySelect')?.addEventListener('change', syncTokenizerFormFromDom);
  document.getElementById('assetTitleInput')?.addEventListener('input', syncTokenizerFormFromDom);
  document.getElementById('assetDescriptionInput')?.addEventListener('input', syncTokenizerFormFromDom);
  document.getElementById('assetTagsInput')?.addEventListener('input', syncTokenizerFormFromDom);
  document.getElementById('analyzeDataButton')?.addEventListener('click', handleAnalyzeData);
  document.getElementById('createAssetButton')?.addEventListener('click', handleCreateAsset);
}

function renderAnalysisGrid() {
  const analysisGrid = document.getElementById('analysisGrid');
  if (!analysisGrid) return;
  if (!state.analysisResult) {
    analysisGrid.innerHTML = '<div class="detail-item"><div class="detail-label">TINAN AI analysis</div><div class="detail-value">Waiting for file analysis.</div></div>';
    return;
  }

  analysisGrid.innerHTML = `
    <div class="detail-item">
      <div class="detail-label">File type</div>
      <div class="detail-value">${escapeHtml(state.analysisResult.fileType)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Size</div>
      <div class="detail-value">${escapeHtml(state.analysisResult.sizeLabel)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Content category</div>
      <div class="detail-value">${escapeHtml(state.analysisResult.categoryLabel)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Timestamp</div>
      <div class="detail-value">${escapeHtml(formatDate(state.analysisResult.lastModified))}</div>
    </div>
    <div class="detail-item detail-item-wide">
      <div class="detail-label">Description</div>
      <div class="detail-value">${escapeHtml(state.analysisResult.description)}</div>
    </div>
    <div class="detail-item detail-item-wide">
      <div class="detail-label">Potential utility</div>
      <div class="detail-value">${escapeHtml(state.analysisResult.potentialUtility)}</div>
    </div>
    <div class="detail-item detail-item-wide">
      <div class="detail-label">Related information</div>
      <div class="detail-value">${escapeHtml(state.analysisResult.relatedInformation)}</div>
    </div>
  `;
}

function renderProofGrid() {
  const proofGrid = document.getElementById('proofGrid');
  if (!proofGrid) return;
  const selectedProof = PROOF_TYPE_DEFS.find((entry) => entry.id === state.tokenizerForm.proofType) ?? PROOF_TYPE_DEFS[0];
  proofGrid.innerHTML = `
    <div class="detail-item">
      <div class="detail-label">${escapeHtml(selectedProof.label)}</div>
      <div class="detail-value">${escapeHtml(selectedProof.description)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Ownership reference</div>
      <div class="detail-value code">${escapeHtml(state.wallet.connected ? state.wallet.address : 'Local browser session')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Storage mode</div>
      <div class="detail-value">${escapeHtml(STORAGE_PROVIDER_DEFS.find((entry) => entry.id === state.tokenizerForm.storageProvider)?.description ?? '')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Verification boundary</div>
      <div class="detail-value">The app verifies hashes, timestamps, metadata, and storage references. It does not claim to verify facts beyond what the uploaded file and user-provided context can support.</div>
    </div>
  `;
}

function renderAssetOutputGrid() {
  const outputGrid = document.getElementById('assetOutputGrid');
  if (!outputGrid) return;
  const lastCreatedAsset = state.dataAssets.find((entry) => entry.id === state.lastCreatedAssetId);
  if (!lastCreatedAsset) {
    outputGrid.innerHTML = '<div class="detail-item"><div class="detail-label">Eureka Asset</div><div class="detail-value">After analysis, create an asset record with Data ID, Proof ID, hash, verification status, token ID, network, and transaction status.</div></div>';
    return;
  }

  outputGrid.innerHTML = `
    <div class="detail-item">
      <div class="detail-label">Data ID</div>
      <div class="detail-value code">${escapeHtml(lastCreatedAsset.id)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Proof ID</div>
      <div class="detail-value code">${escapeHtml(lastCreatedAsset.proofId)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Hash</div>
      <div class="detail-value code">${escapeHtml(lastCreatedAsset.hash)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Owner</div>
      <div class="detail-value code">${escapeHtml(lastCreatedAsset.owner)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Storage reference</div>
      <div class="detail-value code">${escapeHtml(lastCreatedAsset.storageReference)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Verification status</div>
      <div class="detail-value">${escapeHtml(lastCreatedAsset.verificationStatus)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Token ID</div>
      <div class="detail-value code">${escapeHtml(lastCreatedAsset.tokenId)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Network</div>
      <div class="detail-value">${escapeHtml(lastCreatedAsset.network)}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Transaction</div>
      <div class="detail-value">${escapeHtml(lastCreatedAsset.transactionStatus)}</div>
    </div>
    <div class="detail-item detail-item-wide">
      <div class="detail-label">Asset page</div>
      <div class="detail-value"><a class="token-link" href="/assets/${encodeURIComponent(lastCreatedAsset.id)}" data-route="/assets/${encodeURIComponent(lastCreatedAsset.id)}">Open asset details</a></div>
    </div>
  `;
}

function renderMyAssets() {
  setText('assetCountValue', String(state.dataAssets.length));
  setText('proofCountValue', String(state.proofs.length));
  setText('privateVaultValue', String(state.dataAssets.filter((entry) => entry.fileAvailable).length));
  setText('verifiedAssetValue', String(state.dataAssets.filter((entry) => entry.verificationStatus).length));
  setText('assetFilterStatus', `Showing ${state.assetFilter.toLowerCase()} assets`);

  const filterRow = document.getElementById('assetFilterRow');
  if (filterRow) {
    filterRow.innerHTML = ASSET_FILTERS.map(
      (filter) => `<button class="agent-switch ${state.assetFilter === filter ? 'is-active' : ''}" type="button" data-asset-filter="${filter}">${filter}</button>`
    ).join('');
    filterRow.querySelectorAll('[data-asset-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.assetFilter = button.getAttribute('data-asset-filter') || 'ALL';
        render();
      });
    });
  }

  const filteredAssets = state.dataAssets.filter((entry) => matchesAssetFilter(entry, state.assetFilter));
  const assetList = document.getElementById('assetList');
  if (assetList) {
    assetList.innerHTML = filteredAssets.length
      ? filteredAssets
          .map(
            (asset) => `
              <article class="asset-card glass-outline">
                <div class="status-row">
                  <div>
                    <p class="eyebrow">${escapeHtml(asset.proofLabel)}</p>
                    <h3 class="tile-title">${escapeHtml(asset.name)}</h3>
                  </div>
                  <span class="status-chip ${asset.visibility === 'private' ? '' : 'success'}">${escapeHtml(asset.categoryLabel)}</span>
                </div>
                <p class="tile-copy">${escapeHtml(asset.description)}</p>
                <div class="asset-meta-grid">
                  <div><strong>Hash</strong><span class="code">${escapeHtml(shortenHash(asset.hash))}</span></div>
                  <div><strong>Token ID</strong><span class="code">${escapeHtml(asset.tokenId)}</span></div>
                  <div><strong>Storage</strong><span>${escapeHtml(asset.storageStatus)}</span></div>
                  <div><strong>Network</strong><span>${escapeHtml(asset.network)}</span></div>
                </div>
                <div class="inline-actions">
                  <a class="button primary" href="/assets/${encodeURIComponent(asset.id)}" data-route="/assets/${encodeURIComponent(asset.id)}">View asset</a>
                  <button class="button ghost" type="button" data-view-proof="${escapeAttribute(asset.proofId)}">View proof</button>
                  <button class="button subtle" type="button" data-copy-hash="${escapeAttribute(asset.hash)}">Copy hash</button>
                </div>
              </article>
            `
          )
          .join('')
      : '<div class="empty-card">No assets match the selected filter yet. Use the Data Tokenizer to create the first record.</div>';
  }
}

function renderProofs() {
  const proofTypeGrid = document.getElementById('proofTypeGrid');
  if (proofTypeGrid) {
    proofTypeGrid.innerHTML = PROOF_ITEMS.map(
      (item) => `
        <article class="tile glass-outline">
          <h3 class="tile-title">${escapeHtml(item.title)}</h3>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  setText('proofRegistryCount', `${state.proofs.length} proof${state.proofs.length === 1 ? '' : 's'}`);
  const proofList = document.getElementById('proofList');
  if (proofList) {
    proofList.innerHTML = state.proofs.length
      ? state.proofs
          .map(
            (proof) => `
              <article class="asset-card glass-outline" id="${escapeAttribute(proof.id)}">
                <div class="status-row">
                  <div>
                    <p class="eyebrow">${escapeHtml(proof.proofLabel)}</p>
                    <h3 class="tile-title">${escapeHtml(proof.id)}</h3>
                  </div>
                  <span class="status-chip success">${escapeHtml(proof.verificationStatus)}</span>
                </div>
                <p class="tile-copy">${escapeHtml(proof.statement)}</p>
                <div class="asset-meta-grid">
                  <div><strong>Hash</strong><span class="code">${escapeHtml(shortenHash(proof.hash))}</span></div>
                  <div><strong>Owner</strong><span class="code">${escapeHtml(shortenAddress(proof.owner, proof.owner))}</span></div>
                  <div><strong>Created</strong><span>${escapeHtml(formatDate(proof.createdAt))}</span></div>
                  <div><strong>Storage</strong><span>${escapeHtml(proof.storageProviderLabel)}</span></div>
                </div>
                <div class="inline-actions">
                  <a class="button primary" href="/assets/${encodeURIComponent(proof.assetId)}" data-route="/assets/${encodeURIComponent(proof.assetId)}">View asset</a>
                  <button class="button ghost" type="button" data-copy-hash="${escapeAttribute(proof.hash)}">Copy hash</button>
                  <button class="button subtle" type="button" data-copy-token="${escapeAttribute(proof.id)}">Copy proof ID</button>
                </div>
              </article>
            `
          )
          .join('')
      : '<div class="empty-card">No proofs yet. Create an asset from the Data Tokenizer to generate your first proof.</div>';
  }

  if (state.focusedProofId) {
    const focused = document.getElementById(state.focusedProofId);
    focused?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    state.focusedProofId = '';
  }
}

function renderEcosystem() {
  const ecosystemMapGrid = document.getElementById('ecosystemMapGrid');
  if (ecosystemMapGrid) {
    ecosystemMapGrid.innerHTML = ECOSYSTEM_ITEMS.map(
      (item) => `
        <article class="tile glass-outline">
          <h3 class="tile-title">${escapeHtml(item.title)}</h3>
          <p class="tile-copy">${escapeHtml(item.copy)}</p>
        </article>
      `
    ).join('');
  }

  const enabledSurfaceList = document.getElementById('enabledSurfaceList');
  if (enabledSurfaceList) {
    enabledSurfaceList.innerHTML = [
      'Base wallet connection and network switching',
      'Live EUREKA token telemetry and BaseScan links',
      'TINAN AI prompt workspace with local history',
      'Private browser vault file storage',
      'Proof-backed data asset portfolio',
    ]
      .map((item) => `<li class="activity-item">${escapeHtml(item)}</li>`)
      .join('');
  }

  const plannedSurfaceList = document.getElementById('plannedSurfaceList');
  if (plannedSurfaceList) {
    plannedSurfaceList.innerHTML = [
      'Optional decentralized storage uploads (IPFS, Arweave, or equivalent providers)',
      'Future on-chain registry transactions for tokenized data assets',
      'Expanded multichain activation only when real infrastructure is available',
      'Developer APIs and third-party application layers for the data economy',
    ]
      .map((item) => `<li class="activity-item">${escapeHtml(item)}</li>`)
      .join('');
  }
}

function renderWhitepaper() {}

function renderAssetDetail() {
  const asset = getCurrentAsset();
  if (!asset) return;
}

function openReceiveModal() {
  state.receiveOpen = true;
  shouldFocusReceiveModal = true;
  render();
}

function closeReceiveModal({ returnFocus = true } = {}) {
  if (!state.receiveOpen) return;
  state.receiveOpen = false;
  shouldFocusReceiveModal = false;
  render();
  if (returnFocus) {
    window.requestAnimationFrame(() => {
      document.getElementById('receiveAction')?.focus();
    });
  }
}

function syncReceiveModal() {
  clearReceiveModalListeners();
  document.body.style.overflow = state.receiveOpen ? 'hidden' : '';
  const modal = document.getElementById('receiveModal');
  const dialog = document.getElementById('receiveDialog');
  if (!modal || !dialog || !state.receiveOpen) return;

  const handleBackdropClick = (event) => {
    if (event.target === modal) {
      closeReceiveModal();
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeReceiveModal();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements(dialog);
    if (!focusableElements.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  modal.addEventListener('click', handleBackdropClick);
  document.addEventListener('keydown', handleKeydown);

  receiveModalListeners = () => {
    modal.removeEventListener('click', handleBackdropClick);
    document.removeEventListener('keydown', handleKeydown);
  };

  if (shouldFocusReceiveModal || !dialog.contains(document.activeElement)) {
    shouldFocusReceiveModal = false;
    window.requestAnimationFrame(() => {
      const [firstElement] = getFocusableElements(dialog);
      (firstElement ?? dialog).focus();
    });
  }
}

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('hidden') && !element.getAttribute('aria-hidden'));
}

function clearReceiveModalListeners() {
  receiveModalListeners?.();
  receiveModalListeners = null;
}

function clearWalletSessionListeners() {
  walletSessionListeners?.();
  walletSessionListeners = null;
}

function bindWalletSessionListeners(session) {
  clearWalletSessionListeners();
  const provider = session?.rawProvider;
  if (!provider?.on) return;

  const removeListener = provider.off?.bind(provider) ?? provider.removeListener?.bind(provider);
  if (!removeListener) return;

  const handleAccountsChanged = async (accounts = []) => {
    if (state.walletSession !== session) return;
    const [address] = accounts;
    if (!address) {
      clearWalletSession();
      return;
    }
    state.walletSession.address = address;
    await refreshWalletState('Wallet account updated.');
  };

  const handleChainChanged = async () => {
    if (state.walletSession !== session) return;
    await refreshWalletState('Wallet network updated.');
  };

  provider.on('accountsChanged', handleAccountsChanged);
  provider.on('chainChanged', handleChainChanged);

  walletSessionListeners = () => {
    removeListener('accountsChanged', handleAccountsChanged);
    removeListener('chainChanged', handleChainChanged);
  };
}

function clearWalletSession(status = 'Wallet disconnected.') {
  clearWalletSessionListeners();
  state.walletSession = null;
  state.lastProviderType = '';
  state.wallet = {
    ...initialState.wallet,
    status,
  };
  render();
}

function renderTinanAi() {
  const agents = getAgents();
  const activeAgent = agents.find((agent) => agent.id === state.activeAgent) ?? agents[0];
  setText('activeAgentBadge', `${activeAgent.name} active`);

  const switches = document.getElementById('agentSwitches');
  if (switches) {
    switches.innerHTML = agents.map((agent) => `<button class="agent-switch ${agent.id === state.activeAgent ? 'is-active' : ''}" data-agent-id="${agent.id}" type="button">${escapeHtml(agent.name)}</button>`).join('');
    switches.querySelectorAll('[data-agent-id]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeAgent = button.getAttribute('data-agent-id');
        render();
      });
    });
  }

  const chatFeed = document.getElementById('chatFeed');
  if (chatFeed) {
    chatFeed.innerHTML = state.chat.map((entry) => `<li class="chat-bubble ${entry.role}"><span class="chat-meta">${entry.role === 'assistant' ? escapeHtml(agents.find((agent) => agent.id === entry.agentId)?.name ?? APP_CONFIG.app.aiName) : 'You'} • ${escapeHtml(entry.createdAt)}</span><p>${escapeHtml(entry.content)}</p></li>`).join('');
    chatFeed.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  const quickPromptGrid = document.getElementById('quickPromptGrid');
  if (quickPromptGrid) {
    quickPromptGrid.innerHTML = getQuickPrompts().map((prompt) => `<button class="prompt-chip" data-quick-prompt="${encodeURIComponent(prompt)}" type="button">${escapeHtml(prompt)}</button>`).join('');
    quickPromptGrid.querySelectorAll('[data-quick-prompt]').forEach((button) => {
      button.addEventListener('click', () => {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.value = decodeURIComponent(button.getAttribute('data-quick-prompt'));
      });
    });
  }

  const promptHistory = document.getElementById('promptHistory');
  if (promptHistory) {
    promptHistory.innerHTML = state.promptHistory.length
      ? state.promptHistory.map((entry) => `<li class="activity-item"><div class="list-row"><strong>${escapeHtml(entry.prompt)}</strong><span class="notification-time">${escapeHtml(entry.createdAt)}</span></div><p class="activity-copy">${escapeHtml(entry.agent)}</p></li>`).join('')
      : '<li class="empty-card">No prompts yet.</li>';
  }

  document.getElementById('chatForm')?.addEventListener('submit', handlePrompt);
  document.getElementById('clearChat')?.addEventListener('click', () => {
    state.chat = [{ ...initialChatMessage, createdAt: nowLabel() }];
    state.promptHistory = [];
    recordActivity('TINAN AI chat cleared', 'Prompt history reset locally.');
    render();
  });
}

function renderToken() {
  setText('tokenNameValue', state.tokenDetails.name);
  setText('tokenSymbolValue', state.tokenDetails.symbol);
  setText('tokenSupplyValue', state.tokenDetails.totalSupply);
  setText('tokenDecimalsValue', String(state.tokenDetails.decimals));
  setText('tokenContractValue', state.tokenDetails.contractAddress);
  const tokenExplorerButton = document.getElementById('tokenExplorerButton');
  if (tokenExplorerButton) tokenExplorerButton.href = state.tokenDetails.explorerUrl;
}

function navigate(route) {
  const nextRoute = normalizeRoute(route);
  if (state.route === nextRoute) {
    render();
    return;
  }
  state.route = nextRoute;
  window.history.pushState({}, '', nextRoute);
  recordActivity('Route changed', `Opened ${nextRoute}.`);
  render();
}

async function hydrateTokenDetails() {
  try {
    state.tokenDetails = await loadTokenDetails(APP_CONFIG);
    addNotification('Token telemetry loaded', `Live ${state.tokenDetails.symbol} metadata is now available from Base.`, 'success');
    render();
  } catch (error) {
    state.tokenDetails.totalSupply = 'Unavailable';
    addNotification('Token telemetry unavailable', error.message, 'warning');
    render();
  }
}

async function handleMetaMaskConnect() {
  try {
    state.wallet.status = 'Connecting MetaMask…';
    render();
    state.walletSession = await connectInjectedWallet('metamask', APP_CONFIG);
    bindWalletSessionListeners(state.walletSession);
    state.lastProviderType = 'metamask';
    recordActivity('MetaMask connected', 'MetaMask approved and switching to Base.');
    await refreshWalletState('MetaMask connected.');
  } catch (error) {
    state.wallet.status = error.message;
    addNotification('MetaMask connection failed', error.message, 'warning');
    render();
  }
}

async function handleWalletConnect() {
  try {
    state.wallet.status = 'Initializing WalletConnect…';
    render();
    state.walletSession = await connectWalletConnect(APP_CONFIG);
    bindWalletSessionListeners(state.walletSession);
    state.lastProviderType = '';
    recordActivity('WalletConnect connected', 'WalletConnect v2 pairing completed for Base.');
    await refreshWalletState('WalletConnect connected.');
  } catch (error) {
    state.wallet.status = error.message;
    addNotification('WalletConnect unavailable', error.message, 'warning');
    render();
  }
}

async function handleCoinbaseConnect() {
  try {
    state.wallet.status = 'Opening Coinbase Wallet…';
    render();
    const session = await connectCoinbaseWallet(APP_CONFIG);
    if (session?.deepLinked) {
      clearWalletSession(session.message);
      addNotification('Coinbase Wallet handoff started', session.message, 'success');
      render();
      return;
    }

    state.walletSession = session;
    bindWalletSessionListeners(state.walletSession);
    state.lastProviderType = 'coinbase';
    recordActivity('Coinbase Wallet connected', 'Coinbase Wallet approved and switching to Base.');
    await refreshWalletState('Coinbase Wallet connected.');
  } catch (error) {
    state.wallet.status = error.message;
    addNotification('Coinbase Wallet unavailable', error.message, 'warning');
    render();
  }
}

async function handleDisconnect() {
  const activeSession = state.walletSession;
  clearWalletSessionListeners();
  await disconnectWallet(activeSession).catch(() => undefined);
  state.walletSession = null;
  state.lastProviderType = '';
  state.wallet = {
    ...initialState.wallet,
    status: 'Wallet disconnected.',
  };
  recordActivity('Wallet disconnected', 'Local wallet session cleared.');
  addNotification('Wallet disconnected', 'The wallet session was removed from the current browser state.', 'success');
  render();
}

async function refreshWalletState(statusMessage = 'Wallet state refreshed.', options = {}) {
  if (!state.walletSession) {
    state.wallet.status = 'Connect a wallet first.';
    render();
    return;
  }

  try {
    const snapshot = await readWalletSnapshot(state.walletSession, APP_CONFIG, state.tokenDetails);
    state.wallet = {
      ...snapshot,
      status: snapshot.chainMatched
        ? `${statusMessage} ${snapshot.tokenBalance} ${state.tokenDetails.symbol} available on ${APP_CONFIG.network.name}.`
        : `Connected on ${snapshot.network}. Switch to ${APP_CONFIG.network.name} for ${state.tokenDetails.symbol} actions.`,
    };
    if (options.recordActivity) {
      recordActivity('Wallet refreshed', `${snapshot.address} synced on ${snapshot.network}.`);
    }
    render();
  } catch (error) {
    state.wallet.status = `Wallet refresh failed: ${error.message}`;
    addNotification('Wallet refresh failed', error.message, 'warning');
    render();
  }
}

async function handleSend(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const recipient = String(form.get('recipient') ?? '').trim();
  const amount = String(form.get('amount') ?? '').trim();

  try {
    state.wallet.status = `Sending ${amount || '0'} ${state.tokenDetails.symbol}…`;
    render();
    const tx = await sendToken(state.walletSession, recipient, amount, APP_CONFIG, state.tokenDetails.decimals);
    addNotification('Transfer submitted', `Transaction ${shortenAddress(tx.hash, tx.hash)} was submitted to Base.`, 'success');
    recordActivity('Transfer submitted', `${amount} ${state.tokenDetails.symbol} sent to ${recipient}.`);
    await tx.wait();
    addNotification('Transfer confirmed', `${amount} ${state.tokenDetails.symbol} confirmed on Base.`, 'success');
    event.currentTarget.reset();
    await refreshWalletState('Transfer confirmed.');
  } catch (error) {
    state.wallet.status = `Transfer failed: ${error.message}`;
    addNotification('Transfer failed', error.message, 'warning');
    render();
  }
}

function handlePrompt(event) {
  event.preventDefault();
  const input = document.getElementById('chatInput');
  const prompt = input?.value.trim();
  if (!prompt) {
    showToast('Enter a prompt for TINAN AI.');
    return;
  }

  const agents = getAgents();
  const agent = agents.find((entry) => entry.id === state.activeAgent) ?? agents[0];
  state.chat.push({
    role: 'user',
    agentId: state.activeAgent,
    createdAt: nowLabel(),
    content: prompt,
  });
  state.chat.push({
    role: 'assistant',
    agentId: state.activeAgent,
    createdAt: nowLabel(),
    content: createAssistantReply({
      agentId: state.activeAgent,
      prompt,
      walletState: state.wallet,
      tokenDetails: state.tokenDetails,
      config: APP_CONFIG,
      assetSummary: { assets: state.dataAssets.length, proofs: state.proofs.length },
    }),
  });
  state.chat = state.chat.slice(-20);
  state.promptHistory.unshift({ prompt, agent: agent.name, createdAt: nowLabel() });
  state.promptHistory = state.promptHistory.slice(0, 12);
  recordActivity('TINAN AI prompt', `${agent.name}: ${prompt}`);
  input.value = '';
  render();
}

async function restoreWalletSession() {
  if (!state.lastProviderType || !['metamask', 'coinbase'].includes(state.lastProviderType)) {
    return;
  }

  try {
    const session = await restoreInjectedWallet(state.lastProviderType, APP_CONFIG);
    if (!session) return;
    state.walletSession = session;
    bindWalletSessionListeners(state.walletSession);
    await refreshWalletState('Wallet restored.');
  } catch {
    clearWalletSession('Reconnect your wallet to refresh Base balances.');
  }
}

function syncTokenizerFormFromDom() {
  state.tokenizerForm = {
    title: document.getElementById('assetTitleInput')?.value ?? state.tokenizerForm.title,
    description: document.getElementById('assetDescriptionInput')?.value ?? state.tokenizerForm.description,
    tags: document.getElementById('assetTagsInput')?.value ?? state.tokenizerForm.tags,
    proofType: document.getElementById('proofTypeSelect')?.value ?? state.tokenizerForm.proofType,
    storageProvider: document.getElementById('storageProviderSelect')?.value ?? state.tokenizerForm.storageProvider,
    visibility: document.getElementById('visibilitySelect')?.value ?? state.tokenizerForm.visibility,
  };
}

async function handleAnalyzeData() {
  syncTokenizerFormFromDom();
  if (!state.selectedFile) {
    state.tokenizerStatus = 'Upload a supported file before starting analysis.';
    showToast(state.tokenizerStatus);
    render();
    return;
  }

  try {
    state.tokenizerStatus = `Analyzing ${state.selectedFile.name}…`;
    render();
    state.analysisResult = await analyzeFile(state.selectedFile, {
      proofType: state.tokenizerForm.proofType,
      description: state.tokenizerForm.description,
    });
    state.tokenizerStatus = `${state.selectedFile.name} is ready for proof generation.`;
    addNotification('Data analysis ready', `${state.selectedFile.name} was classified as ${state.analysisResult.categoryLabel.toLowerCase()}.`, 'success');
    render();
  } catch (error) {
    state.tokenizerStatus = `Analysis failed: ${error.message}`;
    addNotification('Data analysis failed', error.message, 'warning');
    render();
  }
}

async function handleCreateAsset() {
  syncTokenizerFormFromDom();
  if (!state.selectedFile) {
    state.tokenizerStatus = 'Upload a supported file before creating an asset.';
    showToast(state.tokenizerStatus);
    render();
    return;
  }

  if (!state.analysisResult) {
    await handleAnalyzeData();
    if (!state.analysisResult) return;
  }

  try {
    state.tokenizerStatus = 'Generating proof, hash, and tokenized asset record…';
    render();
    const owner = state.wallet.connected ? state.wallet.address : 'Local browser session';
    const network = state.wallet.connected && state.wallet.chainMatched ? APP_CONFIG.network.name : 'Off-chain preparation';
    const { asset, proof } = await createDataAssetRecord({
      file: state.selectedFile,
      title: state.tokenizerForm.title,
      analysis: state.analysisResult,
      proofTypeId: state.tokenizerForm.proofType,
      storageProviderId: state.tokenizerForm.storageProvider,
      visibility: state.tokenizerForm.visibility,
      owner,
      network,
      walletConnected: state.wallet.connected,
    });

    state.dataAssets.unshift(asset);
    state.proofs.unshift(proof);
    state.dataAssets = state.dataAssets.slice(0, 100);
    state.proofs = state.proofs.slice(0, 100);
    persistDataRecords();
    state.lastCreatedAssetId = asset.id;
    state.tokenizerStatus = `${asset.name} is now a proof-backed Eureka asset.`;
    recordActivity('Data asset created', `${asset.name} was tokenized locally as ${asset.tokenId}.`);
    addNotification('Eureka asset created', `${asset.name} generated ${proof.proofLabel} with token ID ${asset.tokenId}.`, 'success');
    state.selectedFile = null;
    state.analysisResult = null;
    render();
  } catch (error) {
    state.tokenizerStatus = `Asset creation failed: ${error.message}`;
    addNotification('Asset creation failed', error.message, 'warning');
    render();
  }
}

function openProof(proofId) {
  state.focusedProofId = proofId;
  if (state.route === '/proofs') {
    render();
    return;
  }
  navigate('/proofs');
}

async function openAssetFile(asset) {
  const file = await getPrivateFile(asset.id);
  if (!file) {
    showToast('This asset file is not available in the local browser vault.');
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = buildAssetDownloadName(asset);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

function addNotification(title, copy, tone) {
  state.notifications.unshift({ title, copy, tone, createdAt: nowLabel() });
  state.notifications = state.notifications.slice(0, 10);
  state.toastMessage = title;
}

function recordActivity(title, copy) {
  state.activity.unshift({ title, copy, createdAt: nowLabel() });
  state.activity = state.activity.slice(0, 10);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function nowLabel() {
  return new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shortenHash(value) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
