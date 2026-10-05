export function createStorage(namespace) {
  const prefix = `${namespace}.`;

  function get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(prefix + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    window.localStorage.setItem(prefix + key, JSON.stringify(value));
  }

  function remove(key) {
    window.localStorage.removeItem(prefix + key);
  }

  return { get, set, remove };
}

export function createInitialState(config, storage) {
  return {
    route: storage.get("route", "home"),
    tinanTab: storage.get("tinanTab", "chat"),
    activeAgent: storage.get("activeAgent", "wallet"),
    chatHistory: storage.get("chatHistory", []),
    activity: storage.get("activity", []),
    workspace: storage.get("workspace", {
      files: [],
      activeFileId: null
    }),
    preferences: storage.get("preferences", {
      motionEnabled: true,
      rememberRoute: true,
      preferredNetwork: config.network.defaultLabel
    }),
    wallet: {
      connected: false,
      providerType: null,
      address: "",
      network: config.network.defaultLabel,
      chainId: config.network.defaultChainId,
      nativeBalance: null,
      tokenBalance: null
    },
    token: {
      name: config.token.name,
      symbol: config.token.symbol,
      contractAddress: config.token.contractAddress,
      totalSupply: config.token.totalSupply,
      holderCount: config.token.holderCountFallback
    },
    vaultUnlocked: false,
    vaultSummary: storage.get("vaultSummary", {
      notes: false,
      whitepaper: false,
      roadmap: false,
      ideas: false,
      updatedAt: null
    })
  };
}

export function persistState(storage, state) {
  storage.set("route", state.route);
  storage.set("tinanTab", state.tinanTab);
  storage.set("activeAgent", state.activeAgent);
  storage.set("chatHistory", state.chatHistory);
  storage.set("activity", state.activity);
  storage.set("workspace", state.workspace);
  storage.set("preferences", state.preferences);
  storage.set("vaultSummary", state.vaultSummary);
}
