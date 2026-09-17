import './styles.css';
import footerTemplate from './components/footer.html?raw';
import headerTemplate from './components/header.html?raw';
import receiveModalTemplate from './components/receive-modal.html?raw';
import toastTemplate from './components/toast.html?raw';
import dashboardPage from './pages/dashboard.html?raw';
import landingPage from './pages/landing.html?raw';
import tinanPage from './pages/tinan-ai.html?raw';
import tokenPage from './pages/token.html?raw';
import walletPage from './pages/wallet.html?raw';
import { APP_CONFIG, DEFAULT_NOTIFICATIONS, ECOSYSTEM_ITEMS, NAV_ITEMS, ROADMAP_ITEMS } from './js/config.js';
import { createAssistantReply, getAgents, getQuickPrompts } from './js/tinan-agent.js';
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
  '/': landingPage,
  '/dashboard': dashboardPage,
  '/wallet': walletPage,
  '/tinan-ai': tinanPage,
  '/token': tokenPage,
};

const storageKey = APP_CONFIG.app.storageNamespace;
const initialState = {
  route: normalizeRoute(window.location.pathname),
  receiveOpen: false,
  activeAgent: 'wallet-agent',
  lastProviderType: '',
  toastMessage: '',
  walletSession: null,
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
  chat: [
    {
      role: 'assistant',
      agentId: 'wallet-agent',
      createdAt: nowLabel(),
      content: `Welcome to ${APP_CONFIG.app.aiName}. I can summarize wallet status, ${APP_CONFIG.token.symbol} token metadata, the roadmap, or the Cloudflare deploy flow.`,
    },
  ],
};

const persistedState = loadPersistedState();
const state = {
  ...initialState,
  ...persistedState,
};
let toastTimer = 0;

boot();

async function boot() {
  if (!app) return;
  recordActivity('Application ready', `${APP_CONFIG.app.name} initialized for ${APP_CONFIG.brand.domain}.`);
  render();
  try {
    await hydrateTokenDetails();
  } finally {
    await restoreWalletSession().catch(() => undefined);
  }
}

function normalizeRoute(value) {
  return routes[value] ? value : '/';
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      route: normalizeRoute(parsed.route ?? window.location.pathname),
      receiveOpen: false,
      activeAgent: parsed.activeAgent ?? initialState.activeAgent,
      lastProviderType: parsed.lastProviderType ?? initialState.lastProviderType,
      activity: Array.isArray(parsed.activity) ? parsed.activity.slice(0, 8) : initialState.activity,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications.slice(0, 8) : initialState.notifications,
      promptHistory: Array.isArray(parsed.promptHistory) ? parsed.promptHistory.slice(0, 12) : initialState.promptHistory,
      chat: Array.isArray(parsed.chat) && parsed.chat.length ? parsed.chat.slice(0, 16) : initialState.chat,
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
    activity: state.activity.slice(0, 8),
    notifications: state.notifications.slice(0, 8),
    promptHistory: state.promptHistory.slice(0, 12),
    chat: state.chat.slice(0, 16),
  };
  localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function hydrateTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? '')),
    template
  );
}

function navMarkup() {
  return NAV_ITEMS.map(
    ([href, label]) =>
      `<a class="nav-link ${state.route === href ? 'is-active' : ''}" href="${href}" data-route="${href}">${label}</a>`
  ).join('');
}

function pageMarkup() {
  return hydrateTemplate(routes[state.route], {
    APP_NAME: APP_CONFIG.app.name,
    AI_NAME: APP_CONFIG.app.aiName,
    TOKEN_SYMBOL: state.tokenDetails.symbol,
    CONTRACT_ADDRESS: state.tokenDetails.contractAddress,
  });
}

function render() {
  const walletLabel = state.wallet.connected ? shortenAddress(state.wallet.address) : 'Connect wallet';
  app.innerHTML = `
    <div class="app-shell">
      ${hydrateTemplate(headerTemplate, {
        APP_NAME: APP_CONFIG.app.name,
        AI_NAME: APP_CONFIG.app.aiName,
        NETWORK_NAME: APP_CONFIG.network.name,
        DOMAIN: APP_CONFIG.brand.domain,
        NAV_ITEMS: navMarkup(),
        GLOBAL_WALLET_LABEL: walletLabel,
      })}
      <main class="page-grid">${pageMarkup()}</main>
      ${hydrateTemplate(footerTemplate, {
        APP_NAME: APP_CONFIG.app.name,
        AI_NAME: APP_CONFIG.app.aiName,
        TOKEN_SYMBOL: state.tokenDetails.symbol,
        NETWORK_NAME: APP_CONFIG.network.name,
        DOMAIN: APP_CONFIG.brand.domain,
        CONTRACT_ADDRESS: state.tokenDetails.contractAddress,
      })}
    </div>
    ${hydrateTemplate(receiveModalTemplate, {
      RECEIVE_OPEN_CLASS: state.receiveOpen ? 'is-open' : '',
      RECEIVE_HIDDEN: String(!state.receiveOpen),
      RECEIVE_ADDRESS: state.wallet.address || 'Connect a wallet first',
      RECEIVE_EXPLORER_URL: state.wallet.explorerAddressUrl || state.tokenDetails.explorerUrl,
      TOKEN_SYMBOL: state.tokenDetails.symbol,
    })}
    ${toastTemplate}
  `;

  attachGlobalHandlers();
  renderPageState();
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
    state.receiveOpen = false;
    render();
  });

  document.getElementById('copyReceiveAddress')?.addEventListener('click', async () => {
    if (!state.wallet.address) {
      showToast('Connect a wallet first.');
      return;
    }
    await copyText(state.wallet.address);
    showToast('Receive address copied.');
  });

  window.onpopstate = () => {
    state.route = normalizeRoute(window.location.pathname);
    render();
  };
}

function renderPageState() {
  if (state.route === '/') renderLanding();
  if (state.route === '/dashboard') renderDashboard();
  if (state.route === '/wallet') renderWallet();
  if (state.route === '/tinan-ai') renderTinanAi();
  if (state.route === '/token') renderToken();
}

function renderLanding() {
  const walletStatus = document.getElementById('heroWalletStatus');
  if (walletStatus) {
    walletStatus.textContent = state.wallet.connected ? `Connected • ${shortenAddress(state.wallet.address)}` : 'Wallet disconnected';
  }

  const ecosystemGrid = document.getElementById('ecosystemGrid');
  if (ecosystemGrid) {
    ecosystemGrid.innerHTML = ECOSYSTEM_ITEMS.map(
      (item) => `
        <article class="tile glass-outline">
          <h3 class="tile-title">${item.title}</h3>
          <p class="tile-copy">${item.copy}</p>
        </article>
      `
    ).join('');
  }

  const roadmapGrid = document.getElementById('roadmapGrid');
  if (roadmapGrid) {
    roadmapGrid.innerHTML = ROADMAP_ITEMS.map(
      (item) => `
        <article class="timeline-step glass-outline">
          <p class="eyebrow">${item.phase}</p>
          <strong>${item.title}</strong>
          <p class="tile-copy">${item.copy}</p>
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
  setText('walletBalanceValue', `${state.wallet.nativeBalance} ${state.wallet.nativeSymbol}`);
  setText('walletBalanceMeta', state.wallet.connected ? state.wallet.network : 'Native Base balance');
  setText('tokenBalanceValue', `${state.wallet.tokenBalance} ${state.tokenDetails.symbol}`);
  setText('tokenBalanceMeta', state.wallet.connected ? `Contract ${shortenAddress(state.tokenDetails.contractAddress)}` : 'Token balance on Base');
  setText('notificationCount', String(state.notifications.length));
  setText('networkStatusValue', state.wallet.chainMatched || !state.wallet.connected ? 'Base ready' : 'Switch network');
  setText('networkStatusMeta', state.wallet.connected ? state.wallet.status : 'Status feed');

  const activityList = document.getElementById('activityList');
  if (activityList) {
    activityList.innerHTML = state.activity.length
      ? state.activity.map((entry) => `<li class="activity-item"><div class="list-row"><strong>${escapeHtml(entry.title)}</strong><span class="notification-time">${escapeHtml(entry.createdAt)}</span></div><p class="activity-copy">${escapeHtml(entry.copy)}</p></li>`).join('')
      : '<li class="empty-card">No wallet activity yet.</li>';
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
    state.receiveOpen = true;
    render();
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

function renderTinanAi() {
  const agents = getAgents();
  const activeAgent = agents.find((agent) => agent.id === state.activeAgent) ?? agents[0];
  setText('activeAgentBadge', `${activeAgent.name} active`);

  const switches = document.getElementById('agentSwitches');
  if (switches) {
    switches.innerHTML = agents.map((agent) => `<button class="agent-switch ${agent.id === state.activeAgent ? 'is-active' : ''}" data-agent-id="${agent.id}" type="button">${agent.name}</button>`).join('');
    switches.querySelectorAll('[data-agent-id]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeAgent = button.getAttribute('data-agent-id');
        render();
      });
    });
  }

  const chatFeed = document.getElementById('chatFeed');
  if (chatFeed) {
    chatFeed.innerHTML = state.chat.map((entry) => `<li class="chat-bubble ${entry.role}"><span class="chat-meta">${entry.role === 'assistant' ? agents.find((agent) => agent.id === entry.agentId)?.name ?? APP_CONFIG.app.aiName : 'You'} • ${entry.createdAt}</span><p>${escapeHtml(entry.content)}</p></li>`).join('');
    chatFeed.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  const quickPromptGrid = document.getElementById('quickPromptGrid');
  if (quickPromptGrid) {
    quickPromptGrid.innerHTML = getQuickPrompts().map((prompt) => `<button class="prompt-chip" data-quick-prompt="${encodeURIComponent(prompt)}" type="button">${prompt}</button>`).join('');
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
    state.chat = [
      {
        role: 'assistant',
        agentId: 'wallet-agent',
        createdAt: nowLabel(),
        content: `Welcome to ${APP_CONFIG.app.aiName}. I can summarize wallet status, ${APP_CONFIG.token.symbol} token metadata, the roadmap, or the Cloudflare deploy flow.`,
      },
    ];
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
  if (state.route === nextRoute) return;
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
      state.wallet.status = session.message;
      state.lastProviderType = '';
      addNotification('Coinbase Wallet handoff started', session.message, 'success');
      render();
      return;
    }

    state.walletSession = session;
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
  await disconnectWallet(state.walletSession).catch(() => undefined);
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
    }),
  });
  state.chat = state.chat.slice(-16);
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
    await refreshWalletState('Wallet restored.');
  } catch {
    state.walletSession = null;
    state.lastProviderType = '';
    state.wallet = {
      ...initialState.wallet,
      status: 'Reconnect your wallet to refresh Base balances.',
    };
    render();
  }
}

function addNotification(title, copy, tone) {
  state.notifications.unshift({ title, copy, tone, createdAt: nowLabel() });
  state.notifications = state.notifications.slice(0, 8);
  state.toastMessage = title;
}

function recordActivity(title, copy) {
  state.activity.unshift({ title, copy, createdAt: nowLabel() });
  state.activity = state.activity.slice(0, 8);
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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
