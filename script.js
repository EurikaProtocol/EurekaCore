import { EUREKACORE_CONFIG as config } from "./config.js";
import { createStorage, createInitialState, persistState } from "./assets/js/app-state.js";
import { decryptVault, encryptVault } from "./assets/js/storage-service.js";
import {
  connectMetaMask,
  explorerUrl,
  getEthereumProvider,
  loadTokenDetails,
  openCoinbaseDeepLink,
  refreshWalletSnapshot,
  sendNativeTransfer,
  walletConnectReady
} from "./assets/js/wallet-service.js";
import {
  AGENTS,
  PROMPT_TEMPLATES,
  QUICK_ACTIONS,
  buildProjectMemory,
  createAssistantReply,
  createChatEntry
} from "./assets/js/tinan-service.js";
import { downloadFile, escapeHtml, formatAddress, formatNumber, nowLabel, truncateText } from "./assets/js/utils.js";

const storage = createStorage(config.app.storageNamespace);
const state = createInitialState(config, storage);

const elements = {
  sections: document.querySelectorAll(".view-section"),
  navLinks: document.querySelectorAll("[data-nav]"),
  tinanTabs: document.querySelectorAll("[data-tinan-tab]"),
  tinanPanels: document.querySelectorAll(".tinan-panel"),
  menuToggle: document.getElementById("menuToggle"),
  closeDrawer: document.getElementById("closeDrawer"),
  mobileDrawer: document.getElementById("mobileDrawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  toast: document.getElementById("toast"),
  connectWalletTrigger: document.getElementById("connectWalletTrigger"),
  connectMetaMask: document.getElementById("connectMetaMask"),
  connectWalletConnect: document.getElementById("connectWalletConnect"),
  connectCoinbase: document.getElementById("connectCoinbase"),
  disconnectAction: document.getElementById("disconnectAction"),
  sendAction: document.getElementById("sendAction"),
  receiveAction: document.getElementById("receiveAction"),
  sendForm: document.getElementById("sendForm"),
  sendToInput: document.getElementById("sendToInput"),
  sendAmountInput: document.getElementById("sendAmountInput"),
  cancelSendAction: document.getElementById("cancelSendAction"),
  receiveModal: document.getElementById("receiveModal"),
  closeReceiveModal: document.getElementById("closeReceiveModal"),
  copyReceiveAddress: document.getElementById("copyReceiveAddress"),
  clearActivity: document.getElementById("clearActivity"),
  clearChat: document.getElementById("clearChat"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  conversationHistory: document.getElementById("conversationHistory"),
  quickActions: document.getElementById("quickActions"),
  promptTemplateSelect: document.getElementById("promptTemplateSelect"),
  agentGrid: document.getElementById("agentGrid"),
  activeAgentLabel: document.getElementById("activeAgentLabel"),
  historyList: document.getElementById("historyList"),
  conversationCount: document.getElementById("conversationCount"),
  projectMemoryList: document.getElementById("projectMemoryList"),
  memoryCount: document.getElementById("memoryCount"),
  workspaceLanguageSelect: document.getElementById("workspaceLanguageSelect"),
  generateWorkspaceFile: document.getElementById("generateWorkspaceFile"),
  workspaceFileList: document.getElementById("workspaceFileList"),
  workspaceFileName: document.getElementById("workspaceFileName"),
  workspacePreview: document.getElementById("workspacePreview"),
  exportWorkspaceFile: document.getElementById("exportWorkspaceFile"),
  saveWorkspaceFile: document.getElementById("saveWorkspaceFile"),
  vaultPassphrase: document.getElementById("vaultPassphrase"),
  unlockVault: document.getElementById("unlockVault"),
  lockVault: document.getElementById("lockVault"),
  saveVault: document.getElementById("saveVault"),
  clearVault: document.getElementById("clearVault"),
  vaultNotes: document.getElementById("vaultNotes"),
  vaultWhitepaper: document.getElementById("vaultWhitepaper"),
  vaultRoadmap: document.getElementById("vaultRoadmap"),
  vaultIdeas: document.getElementById("vaultIdeas"),
  motionToggle: document.getElementById("motionToggle"),
  routeMemoryToggle: document.getElementById("routeMemoryToggle"),
  preferredNetworkSelect: document.getElementById("preferredNetworkSelect"),
  integrationStatusList: document.getElementById("integrationStatusList"),
  activityTimeline: document.getElementById("activityTimeline"),
  notificationsList: document.getElementById("notificationsList"),
  notificationCount: document.getElementById("notificationCount"),
  walletConnectStatus: document.getElementById("walletConnectStatus"),
  coinbaseStatus: document.getElementById("coinbaseStatus"),
  walletStatusBadge: document.getElementById("walletStatusBadge"),
  walletAddressValue: document.getElementById("walletAddressValue"),
  walletNetworkValue: document.getElementById("walletNetworkValue"),
  walletNativeValue: document.getElementById("walletNativeValue"),
  walletTokenValue: document.getElementById("walletTokenValue"),
  receiveAddressValue: document.getElementById("receiveAddressValue"),
  portfolioValue: document.getElementById("portfolioValue"),
  portfolioMeta: document.getElementById("portfolioMeta"),
  walletBalanceValue: document.getElementById("walletBalanceValue"),
  walletBalanceMeta: document.getElementById("walletBalanceMeta"),
  tokenBalanceValue: document.getElementById("tokenBalanceValue"),
  tokenBalanceMeta: document.getElementById("tokenBalanceMeta"),
  networkStatusValue: document.getElementById("networkStatusValue"),
  networkStatusMeta: document.getElementById("networkStatusMeta"),
  heroWalletStatus: document.getElementById("heroWalletStatus"),
  heroVaultStatus: document.getElementById("heroVaultStatus"),
  tokenNameValue: document.getElementById("tokenNameValue"),
  tokenSymbolValue: document.getElementById("tokenSymbolValue"),
  tokenSupplyValue: document.getElementById("tokenSupplyValue"),
  tokenContractValue: document.getElementById("tokenContractValue"),
  tokenHolderValue: document.getElementById("tokenHolderValue"),
  tokenExplorerButton: document.getElementById("tokenExplorerButton")
};

let toastTimer;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function recordActivity(title, detail) {
  state.activity.unshift({ title, detail, timestamp: nowLabel() });
  state.activity = state.activity.slice(0, config.ui.activityLimit);
}

function saveState() {
  state.chatHistory = state.chatHistory.slice(-config.ui.historyLimit);
  persistState(storage, state);
}

function setRoute(route) {
  state.route = route;
  elements.sections.forEach((section) => {
    section.classList.toggle("is-active", section.id === route);
  });
  elements.navLinks.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === route);
  });
  if (state.preferences.rememberRoute) {
    saveState();
  }
  closeDrawer();
}

function setTinanTab(tab) {
  state.tinanTab = tab;
  elements.tinanTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tinanTab === tab);
  });
  elements.tinanPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tab);
  });
  saveState();
}

function openDrawer() {
  elements.mobileDrawer.classList.add("is-open");
  elements.drawerBackdrop.classList.add("is-open");
  elements.mobileDrawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  elements.mobileDrawer.classList.remove("is-open");
  elements.drawerBackdrop.classList.remove("is-open");
  elements.mobileDrawer.setAttribute("aria-hidden", "true");
}

function renderAgents() {
  elements.agentGrid.innerHTML = AGENTS.map((agent) => `
    <button class="agent-card ${agent.id === state.activeAgent ? "is-active" : ""}" data-agent-id="${agent.id}">
      <strong>${escapeHtml(agent.name)}</strong>
      <small>${escapeHtml(agent.description)}</small>
    </button>
  `).join("");

  elements.agentGrid.querySelectorAll("[data-agent-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAgent = button.dataset.agentId;
      elements.activeAgentLabel.textContent = `${AGENTS.find((agent) => agent.id === state.activeAgent)?.name || "TINAN AI"} active`;
      renderAgents();
      saveState();
    });
  });
}

function renderQuickActions() {
  elements.quickActions.innerHTML = QUICK_ACTIONS.map((action) => `
    <button class="quick-action" data-quick-action="${action.id}">${escapeHtml(action.label)}</button>
  `).join("");
  elements.quickActions.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = QUICK_ACTIONS.find((entry) => entry.id === button.dataset.quickAction);
      if (action) {
        elements.chatInput.value = action.prompt;
        elements.chatInput.focus();
      }
    });
  });
}

function renderPromptTemplates() {
  elements.promptTemplateSelect.innerHTML = PROMPT_TEMPLATES.map((template) => `
    <option value="${template.id}">${escapeHtml(template.label)}</option>
  `).join("");
}

function renderChat() {
  elements.conversationHistory.innerHTML = state.chatHistory.length
    ? state.chatHistory.map((entry) => `
        <article class="chat-bubble ${entry.role}">
          <small>${escapeHtml(entry.role === "assistant" ? (AGENTS.find((agent) => agent.id === entry.agentId)?.name || config.app.aiName) : "You")} · ${escapeHtml(entry.createdAt)}</small>
          <p>${escapeHtml(entry.content)}</p>
        </article>
      `).join("")
    : `<article class="chat-bubble assistant"><small>${config.app.aiName}</small><p>${config.app.tagline}\nAsk about wallets, token telemetry, secure local memory, or generated code exports.</p></article>`;
  elements.conversationHistory.scrollTop = elements.conversationHistory.scrollHeight;

  const recentUserEntries = state.chatHistory.filter((entry) => entry.role === "user").slice(-6).reverse();
  elements.historyList.innerHTML = recentUserEntries.length
    ? recentUserEntries.map((entry) => `<li><strong>${escapeHtml(entry.createdAt)}</strong><small>${escapeHtml(truncateText(entry.content, 92))}</small></li>`).join("")
    : "<li><strong>No prompts yet</strong><small>Conversation history will appear here.</small></li>";
  elements.conversationCount.textContent = String(recentUserEntries.length);
}

function ensureWorkspaceFile(file) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const record = {
    id,
    filename: file.filename,
    content: file.content,
    updatedAt: nowLabel()
  };
  state.workspace.files.unshift(record);
  state.workspace.activeFileId = id;
  state.workspace.files = state.workspace.files.slice(0, 20);
  recordActivity("Workspace file generated", record.filename);
}

function getActiveWorkspaceFile() {
  return state.workspace.files.find((file) => file.id === state.workspace.activeFileId) || null;
}

function renderWorkspace() {
  elements.workspaceFileList.innerHTML = state.workspace.files.length
    ? state.workspace.files.map((file) => `
      <button class="${file.id === state.workspace.activeFileId ? "is-active" : ""}" data-workspace-id="${file.id}">
        <strong>${escapeHtml(file.filename)}</strong>
        <small>${escapeHtml(file.updatedAt)}</small>
      </button>
    `).join("")
    : "<button type=\"button\" disabled><strong>No generated files</strong><small>Use the Developer Agent or workspace generator.</small></button>";

  const activeFile = getActiveWorkspaceFile();
  elements.workspaceFileName.value = activeFile?.filename || "";
  elements.workspacePreview.value = activeFile?.content || "";

  elements.workspaceFileList.querySelectorAll("[data-workspace-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.workspace.activeFileId = button.dataset.workspaceId;
      renderWorkspace();
      saveState();
    });
  });
}

function renderMemory() {
  const items = buildProjectMemory(state);
  elements.projectMemoryList.innerHTML = items.map((item) => `<li><strong>Memory</strong><small>${escapeHtml(item)}</small></li>`).join("");
  elements.memoryCount.textContent = String(items.length);
  elements.heroVaultStatus.textContent = state.vaultSummary.updatedAt ? `Updated ${state.vaultSummary.updatedAt}` : "Encrypted local memory";
}

function walletNotifications() {
  const notifications = [];
  notifications.push(state.wallet.connected
    ? { title: "Wallet connected", detail: `${formatAddress(state.wallet.address)} on ${state.wallet.network}` }
    : { title: "Wallet pending", detail: "Connect MetaMask or prepare alternate providers." });
  notifications.push({ title: "Token explorer", detail: "EUREKA contract is ready for external inspection." });
  notifications.push(state.vaultSummary.updatedAt
    ? { title: "Vault secured", detail: `Encrypted vault updated ${state.vaultSummary.updatedAt}.` }
    : { title: "Vault empty", detail: "Save encrypted notes, whitepaper drafts, roadmap items, and ideas." });
  return notifications;
}

function renderDashboard() {
  elements.portfolioValue.textContent = state.wallet.connected ? `${formatNumber(state.wallet.nativeBalance, 4)} + ${formatNumber(state.wallet.tokenBalance, 2)} ${state.token.symbol}` : "Wallet not connected";
  elements.portfolioMeta.textContent = state.wallet.connected ? "Portfolio reflects native and EUREKA balances." : "Connect a wallet to calculate balances.";
  elements.walletBalanceValue.textContent = state.wallet.connected ? `${formatNumber(state.wallet.nativeBalance, 4)}` : "—";
  elements.walletBalanceMeta.textContent = state.wallet.connected ? `${state.wallet.network}` : "Native balance unavailable.";
  elements.tokenBalanceValue.textContent = state.wallet.connected ? `${formatNumber(state.wallet.tokenBalance, 2)} ${state.token.symbol}` : "—";
  elements.tokenBalanceMeta.textContent = state.wallet.connected ? `${state.token.name} balance loaded.` : "EUREKA balance unavailable.";
  elements.networkStatusValue.textContent = state.wallet.connected ? state.wallet.network : state.preferences.preferredNetwork;
  elements.networkStatusMeta.textContent = state.wallet.connected ? "Live provider network detected." : "Preferred network label from settings.";

  const notifications = walletNotifications();
  elements.notificationCount.textContent = String(notifications.length);
  elements.notificationsList.innerHTML = notifications.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></li>`).join("");
  elements.activityTimeline.innerHTML = state.activity.length
    ? state.activity.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.timestamp)}</span><small>${escapeHtml(item.detail)}</small></li>`).join("")
    : "<li><strong>No recent activity</strong><small>Actions will appear here as you use EurekaCore.</small></li>";
}

function renderWallet() {
  elements.walletConnectStatus.textContent = walletConnectReady(config)
    ? "WalletConnect v2 projectId configured."
    : config.integrations.walletConnect.status;
  elements.coinbaseStatus.textContent = config.integrations.coinbaseWallet.status;
  elements.heroWalletStatus.textContent = state.wallet.connected ? `Connected ${formatAddress(state.wallet.address)}` : "No wallet connected";
  elements.walletStatusBadge.textContent = state.wallet.connected ? state.wallet.providerType || "Connected" : "Disconnected";
  elements.walletStatusBadge.className = `status-badge ${state.wallet.connected ? "success" : "neutral"}`;
  elements.walletAddressValue.textContent = state.wallet.connected ? state.wallet.address : "—";
  elements.walletNetworkValue.textContent = state.wallet.network || "—";
  elements.walletNativeValue.textContent = state.wallet.connected ? `${formatNumber(state.wallet.nativeBalance, 4)}` : "—";
  elements.walletTokenValue.textContent = state.wallet.connected ? `${formatNumber(state.wallet.tokenBalance, 2)} ${state.token.symbol}` : "—";
  elements.receiveAddressValue.textContent = state.wallet.connected ? state.wallet.address : "Connect a wallet first.";
  elements.sendAction.disabled = !state.wallet.connected;
  elements.receiveAction.disabled = !state.wallet.connected;
  elements.disconnectAction.disabled = !state.wallet.connected;
}

function renderToken() {
  elements.tokenNameValue.textContent = state.token.name;
  elements.tokenSymbolValue.textContent = state.token.symbol;
  elements.tokenSupplyValue.textContent = String(state.token.totalSupply ?? "Unavailable");
  elements.tokenContractValue.textContent = state.token.contractAddress;
  elements.tokenHolderValue.textContent = String(state.token.holderCount);
}

function renderSettings() {
  elements.motionToggle.checked = state.preferences.motionEnabled;
  elements.routeMemoryToggle.checked = state.preferences.rememberRoute;
  document.body.classList.toggle("reduce-motion", !state.preferences.motionEnabled);

  const networkOptions = [config.network.defaultLabel, "Ethereum Mainnet", "Polygon", "Optimism", "Base"];
  elements.preferredNetworkSelect.innerHTML = [...new Set(networkOptions)].map((label) => `
    <option value="${escapeHtml(label)}" ${label === state.preferences.preferredNetwork ? "selected" : ""}>${escapeHtml(label)}</option>
  `).join("");

  elements.integrationStatusList.innerHTML = [
    { title: "MetaMask", detail: getEthereumProvider() ? "Detected in this browser." : "Not detected in this browser." },
    { title: "WalletConnect v2", detail: config.integrations.walletConnect.status },
    { title: "Coinbase Wallet", detail: config.integrations.coinbaseWallet.status }
  ].map((item) => `<li><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></li>`).join("");
}

function renderAll() {
  renderAgents();
  renderQuickActions();
  renderChat();
  renderWorkspace();
  renderMemory();
  renderDashboard();
  renderWallet();
  renderToken();
  renderSettings();
  setRoute(state.route);
  setTinanTab(state.tinanTab);
}

async function refreshTokenState() {
  try {
    state.token = await loadTokenDetails(config);
    renderToken();
    renderDashboard();
  } catch (error) {
    console.warn("Token details unavailable:", error);
  }
}

async function refreshWalletState() {
  if (!state.wallet.connected) return;
  try {
    state.wallet = await refreshWalletSnapshot(config, state.wallet);
    renderWallet();
    renderDashboard();
    saveState();
  } catch (error) {
    console.warn("Wallet refresh failed:", error);
  }
}

async function handleMetaMaskConnect() {
  try {
    const connection = await connectMetaMask();
    state.wallet = {
      ...state.wallet,
      connected: true,
      providerType: "MetaMask",
      address: connection.address,
      chainId: connection.chainId,
      network: connection.network
    };
    state.wallet = await refreshWalletSnapshot(config, state.wallet);
    recordActivity("Wallet connected", `${formatAddress(state.wallet.address)} via MetaMask`);
    showToast("MetaMask connected");
    renderAll();
    saveState();
  } catch (error) {
    showToast(error.message || "Failed to connect MetaMask");
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const message = elements.chatInput.value.trim();
  if (!message) return;
  elements.chatInput.value = "";

  const userEntry = createChatEntry("user", message, state.activeAgent);
  state.chatHistory.push(userEntry);

  const reply = createAssistantReply({
    message,
    agentId: state.activeAgent,
    state,
    token: state.token
  });

  const assistantEntry = createChatEntry("assistant", reply.text, state.activeAgent);
  state.chatHistory.push(assistantEntry);

  if (reply.file) {
    ensureWorkspaceFile(reply.file);
    setTinanTab("workspace");
  }

  recordActivity("TINAN AI response", truncateText(message, 56));
  renderAll();
  saveState();
}

function disconnectWallet() {
  state.wallet = {
    connected: false,
    providerType: null,
    address: "",
    network: config.network.defaultLabel,
    chainId: config.network.defaultChainId,
    nativeBalance: null,
    tokenBalance: null
  };
  recordActivity("Wallet disconnected", "Live provider state cleared");
  renderAll();
  saveState();
}

async function unlockVault() {
  const passphrase = elements.vaultPassphrase.value.trim();
  if (!passphrase) {
    showToast("Enter a vault passphrase first");
    return;
  }
  const record = window.localStorage.getItem(config.vault.storageKey);
  if (!record) {
    state.vaultUnlocked = true;
    showToast("Vault ready for first save");
    return;
  }
  try {
    const data = await decryptVault(JSON.parse(record), passphrase);
    elements.vaultNotes.value = data.notes || "";
    elements.vaultWhitepaper.value = data.whitepaper || "";
    elements.vaultRoadmap.value = data.roadmap || "";
    elements.vaultIdeas.value = data.ideas || "";
    state.vaultUnlocked = true;
    showToast("Vault unlocked");
  } catch (error) {
    console.error(error);
    showToast("Invalid vault passphrase");
  }
}

function lockVault() {
  state.vaultUnlocked = false;
  elements.vaultPassphrase.value = "";
  [elements.vaultNotes, elements.vaultWhitepaper, elements.vaultRoadmap, elements.vaultIdeas].forEach((field) => {
    field.value = "";
  });
  showToast("Vault locked");
}

async function saveVault() {
  const passphrase = elements.vaultPassphrase.value.trim();
  if (!passphrase) {
    showToast("Enter a vault passphrase to encrypt data");
    return;
  }
  const payload = {
    notes: elements.vaultNotes.value,
    whitepaper: elements.vaultWhitepaper.value,
    roadmap: elements.vaultRoadmap.value,
    ideas: elements.vaultIdeas.value
  };
  const encrypted = await encryptVault(payload, passphrase, config.vault.iterations);
  window.localStorage.setItem(config.vault.storageKey, JSON.stringify(encrypted));
  state.vaultUnlocked = true;
  state.vaultSummary = {
    notes: Boolean(payload.notes.trim()),
    whitepaper: Boolean(payload.whitepaper.trim()),
    roadmap: Boolean(payload.roadmap.trim()),
    ideas: Boolean(payload.ideas.trim()),
    updatedAt: nowLabel()
  };
  recordActivity("Vault encrypted", "Knowledge Vault updated in local storage");
  renderMemory();
  renderDashboard();
  saveState();
  showToast("Vault encrypted and saved");
}

function clearVault() {
  window.localStorage.removeItem(config.vault.storageKey);
  state.vaultSummary = {
    notes: false,
    whitepaper: false,
    roadmap: false,
    ideas: false,
    updatedAt: null
  };
  lockVault();
  recordActivity("Vault cleared", "Encrypted local Knowledge Vault removed");
  renderMemory();
  renderDashboard();
  saveState();
}

function generateWorkspaceFile() {
  const template = createAssistantReply({
    message: `Generate ${elements.workspaceLanguageSelect.value} for EurekaCore workspace`,
    agentId: "developer",
    state,
    token: state.token
  });
  if (template.file) {
    ensureWorkspaceFile(template.file);
    renderWorkspace();
    renderDashboard();
    saveState();
    showToast("Workspace file generated");
  }
}

function saveWorkspaceEdits() {
  const activeFile = getActiveWorkspaceFile();
  if (!activeFile) {
    showToast("Generate a file first");
    return;
  }
  activeFile.filename = elements.workspaceFileName.value.trim() || activeFile.filename;
  activeFile.content = elements.workspacePreview.value;
  activeFile.updatedAt = nowLabel();
  recordActivity("Workspace file saved", activeFile.filename);
  renderWorkspace();
  saveState();
  showToast("Workspace draft saved");
}

function exportWorkspaceFile() {
  const activeFile = getActiveWorkspaceFile();
  if (!activeFile) {
    showToast("No workspace file selected");
    return;
  }
  saveWorkspaceEdits();
  downloadFile(activeFile.filename, activeFile.content);
  recordActivity("Workspace export", activeFile.filename);
  renderDashboard();
  saveState();
}

async function submitTransfer(event) {
  event.preventDefault();
  try {
    const hash = await sendNativeTransfer(elements.sendToInput.value.trim(), elements.sendAmountInput.value.trim());
    recordActivity("Transfer submitted", truncateText(hash, 22));
    elements.sendForm.classList.add("hidden");
    elements.sendToInput.value = "";
    elements.sendAmountInput.value = "";
    showToast("Transfer submitted to wallet");
    await refreshWalletState();
    renderDashboard();
    saveState();
  } catch (error) {
    showToast(error.message || "Transfer failed");
  }
}

function bindEvents() {
  elements.navLinks.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setRoute(button.dataset.nav);
    });
  });
  elements.tinanTabs.forEach((button) => {
    button.addEventListener("click", () => setTinanTab(button.dataset.tinanTab));
  });
  elements.menuToggle?.addEventListener("click", openDrawer);
  elements.closeDrawer?.addEventListener("click", closeDrawer);
  elements.drawerBackdrop?.addEventListener("click", closeDrawer);
  elements.connectWalletTrigger.addEventListener("click", () => setRoute("wallet"));
  elements.connectMetaMask.addEventListener("click", handleMetaMaskConnect);
  elements.connectWalletConnect.addEventListener("click", () => {
    showToast(walletConnectReady(config) ? "WalletConnect v2 config detected. Attach your pairing UI or SDK next." : config.integrations.walletConnect.status);
  });
  elements.connectCoinbase.addEventListener("click", () => {
    openCoinbaseDeepLink();
    showToast("Opening Coinbase Wallet handoff");
  });
  elements.disconnectAction.addEventListener("click", disconnectWallet);
  elements.sendAction.addEventListener("click", () => elements.sendForm.classList.toggle("hidden"));
  elements.receiveAction.addEventListener("click", () => elements.receiveModal.classList.remove("hidden"));
  elements.closeReceiveModal.addEventListener("click", () => elements.receiveModal.classList.add("hidden"));
  elements.copyReceiveAddress.addEventListener("click", async () => {
    if (!state.wallet.address) {
      showToast("Connect a wallet first");
      return;
    }
    await navigator.clipboard.writeText(state.wallet.address);
    showToast("Address copied");
  });
  elements.cancelSendAction.addEventListener("click", () => elements.sendForm.classList.add("hidden"));
  elements.sendForm.addEventListener("submit", submitTransfer);
  elements.clearActivity.addEventListener("click", () => {
    state.activity = [];
    renderDashboard();
    saveState();
  });
  elements.clearChat.addEventListener("click", () => {
    state.chatHistory = [];
    renderChat();
    saveState();
  });
  elements.chatForm.addEventListener("submit", handleChatSubmit);
  elements.promptTemplateSelect.addEventListener("change", () => {
    const template = PROMPT_TEMPLATES.find((item) => item.id === elements.promptTemplateSelect.value);
    if (template?.prompt) {
      elements.chatInput.value = template.prompt;
      elements.chatInput.focus();
    }
  });
  elements.generateWorkspaceFile.addEventListener("click", generateWorkspaceFile);
  elements.saveWorkspaceFile.addEventListener("click", saveWorkspaceEdits);
  elements.exportWorkspaceFile.addEventListener("click", exportWorkspaceFile);
  elements.unlockVault.addEventListener("click", unlockVault);
  elements.lockVault.addEventListener("click", lockVault);
  elements.saveVault.addEventListener("click", saveVault);
  elements.clearVault.addEventListener("click", clearVault);
  elements.motionToggle.addEventListener("change", () => {
    state.preferences.motionEnabled = elements.motionToggle.checked;
    renderSettings();
    saveState();
  });
  elements.routeMemoryToggle.addEventListener("change", () => {
    state.preferences.rememberRoute = elements.routeMemoryToggle.checked;
    saveState();
  });
  elements.preferredNetworkSelect.addEventListener("change", () => {
    state.preferences.preferredNetwork = elements.preferredNetworkSelect.value;
    renderDashboard();
    renderMemory();
    saveState();
  });
  elements.tokenExplorerButton.addEventListener("click", () => {
    window.open(explorerUrl(config), "_blank", "noopener");
  });

  const provider = getEthereumProvider();
  provider?.on?.("accountsChanged", async (accounts) => {
    if (!accounts.length) {
      disconnectWallet();
      return;
    }
    state.wallet.address = accounts[0];
    await refreshWalletState();
    renderAll();
  });
  provider?.on?.("chainChanged", async () => {
    await refreshWalletState();
    renderAll();
  });
}

async function init() {
  recordActivity("EurekaCore ready", "TINAN AI and modular static app loaded");
  renderPromptTemplates();
  bindEvents();
  renderAll();
  await refreshTokenState();
  await refreshWalletState();
  saveState();
}

init();
