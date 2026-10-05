const networks = [
  {
    id: "ethereum",
    name: "Ethereum",
    url: "https://ethereum.org/",
    icon: "assets/icons/ethereum.svg",
    description: "The leading smart-contract ecosystem powering DeFi, NFTs, infrastructure, and ERC-20 liquidity.",
    token: "ETH",
    ecosystem: "Layer 1",
    family: "evm",
    chainId: 1,
    chainIdHex: "0x1",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io"
  },
  {
    id: "solana",
    name: "Solana",
    url: "https://solana.com/",
    icon: "assets/icons/solana.svg",
    description: "Ultra-fast execution for consumer-scale apps, DeFi, payments, and onchain trading.",
    token: "SOL",
    ecosystem: "Layer 1",
    family: "solana",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    explorerUrl: "https://solscan.io"
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    url: "https://bitcoin.org/",
    icon: "assets/icons/bitcoin.svg",
    description: "The original decentralized monetary network securing global value transfer with the BTC ecosystem.",
    token: "BTC",
    ecosystem: "Layer 1",
    family: "bitcoin",
    explorerUrl: "https://mempool.space"
  },
  {
    id: "bnb",
    name: "BNB Chain",
    url: "https://www.bnbchain.org/",
    icon: "assets/icons/bnb-chain.svg",
    description: "A high-throughput EVM ecosystem with strong exchange connectivity and mass-market reach.",
    token: "BNB",
    ecosystem: "EVM Layer 1",
    family: "evm",
    chainId: 56,
    chainIdHex: "0x38",
    rpcUrl: "https://bsc-dataseed.binance.org",
    explorerUrl: "https://bscscan.com"
  },
  {
    id: "base",
    name: "Base",
    url: "https://base.org/",
    icon: "assets/icons/base.svg",
    description: "Coinbase-backed onchain infrastructure for consumer applications and Ethereum-native builders.",
    token: "ETH",
    ecosystem: "Layer 2",
    family: "evm",
    chainId: 8453,
    chainIdHex: "0x2105",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org"
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    url: "https://arbitrum.io/",
    icon: "assets/icons/arbitrum.svg",
    description: "A leading Ethereum scaling ecosystem optimized for DeFi, gaming, and high-performance apps.",
    token: "ETH",
    ecosystem: "Layer 2",
    family: "evm",
    chainId: 42161,
    chainIdHex: "0xa4b1",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io"
  },
  {
    id: "polygon",
    name: "Polygon",
    url: "https://polygon.technology/",
    icon: "assets/icons/polygon.svg",
    description: "A broad scaling suite connecting EVM apps across multiple chains, rollups, and liquidity layers.",
    token: "POL",
    ecosystem: "Scaling Ecosystem",
    family: "evm",
    chainId: 137,
    chainIdHex: "0x89",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com"
  },
  {
    id: "avalanche",
    name: "Avalanche",
    url: "https://www.avax.network/",
    icon: "assets/icons/avalanche.svg",
    description: "A high-speed smart contract network built for subnets, onchain finance, gaming, and custom app chains.",
    token: "AVAX",
    ecosystem: "Layer 1",
    family: "evm",
    chainId: 43114,
    chainIdHex: "0xa86a",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerUrl: "https://snowtrace.io"
  },
  {
    id: "optimism",
    name: "Optimism",
    url: "https://www.optimism.io/",
    icon: "assets/icons/optimism.svg",
    description: "A Superchain-focused rollup ecosystem designed to scale Ethereum with shared standards.",
    token: "ETH",
    ecosystem: "Layer 2",
    family: "evm",
    chainId: 10,
    chainIdHex: "0xa",
    rpcUrl: "https://mainnet.optimism.io",
    explorerUrl: "https://optimistic.etherscan.io"
  },
  {
    id: "sui",
    name: "Sui",
    url: "https://sui.io/",
    icon: "assets/icons/sui.svg",
    description: "An object-centric Layer 1 network built for fast consumer apps, gaming, and scalable digital assets.",
    token: "SUI",
    ecosystem: "Layer 1",
    family: "sui",
    explorerUrl: "https://suivision.xyz"
  },
  {
    id: "xrp",
    name: "XRP",
    url: "https://xrpl.org/",
    icon: "assets/icons/xrp-ledger.svg",
    description: "The XRP Ledger powers fast settlement, tokenization, and cross-border payments across a global network.",
    token: "XRP",
    ecosystem: "Payments Network",
    family: "xrp",
    explorerUrl: "https://livenet.xrpl.org"
  },
  {
    id: "stellar",
    name: "Stellar",
    url: "https://stellar.org/",
    icon: "assets/icons/stellar.svg",
    description: "A payment-focused blockchain connecting wallets, stablecoins, and financial rails for global transfers.",
    token: "XLM",
    ecosystem: "Payments Network",
    family: "stellar",
    explorerUrl: "https://stellar.expert/explorer/public"
  }
];

const featuredNetworks = networks.slice(0, 5);
const xUrl = "https://x.com/tinanasv?s=11";
const xProfile = {
  name: "X",
  url: xUrl,
  icon: "assets/icons/x.svg",
  label: "Follow Tinana on X (opens in a new tab)"
};
const menu = document.querySelector(".menu");
const nav = document.querySelector(".nav");
const navNetworks = document.querySelector(".nav-networks");
const launchNetworks = document.querySelector(".launch-networks");
const xSlots = document.querySelectorAll("[data-x-slot]");
const yearElement = document.getElementById("year");
const multichainShell = document.querySelector("[data-multichain-shell]");
const multichainWheel = document.getElementById("multichainWheel");
const multichainPanelLogo = document.getElementById("multichainPanelLogo");
const multichainPanelName = document.getElementById("multichainPanelName");
const multichainPanelDescription = document.getElementById("multichainPanelDescription");
const multichainPanelStatus = document.getElementById("multichainPanelStatus");
const multichainPanelToken = document.getElementById("multichainPanelToken");
const multichainPanelEcosystem = document.getElementById("multichainPanelEcosystem");
const multichainLaunch = document.getElementById("multichainLaunch");
const multichainLaunchLabel = document.getElementById("multichainLaunchLabel");
const chainChangedEventName = "eureka:chain-selected";
const chainSelectionRequestEventName = "eureka:select-chain";
const orbitState = {
  selectedIndex: 0
};

window.EUREKA_NETWORKS = networks.map(network => ({ ...network }));
window.EurekaOrbit = {
  getChains() {
    return networks.map(network => ({ ...network }));
  },
  getSelectedChain() {
    return { ...(networks[orbitState.selectedIndex] || networks[0]) };
  },
  selectChain(chainId, source = "wallet") {
    window.dispatchEvent(
      new CustomEvent(chainSelectionRequestEventName, {
        detail: { chainId, source }
      })
    );
  }
};

function badgeMarkup(network) {
  return `
    <li>
      <a class="network-badge" href="${network.url}" target="_blank" rel="noopener noreferrer" aria-label="${network.label || `Open ${network.name}`}">
        <img src="${network.icon}" alt="${network.name} logo">
      </a>
    </li>
  `;
}

function textXLinkMarkup(className) {
  return `
    <a class="${className}" href="${xUrl}" aria-label="${xProfile.label}" target="_blank" rel="noopener noreferrer">
      <img src="${xProfile.icon}" alt="" class="btn-icon" aria-hidden="true">
      <span>Follow on X</span>
    </a>
  `;
}

if (navNetworks) {
  navNetworks.innerHTML = [...featuredNetworks, xProfile].map(badgeMarkup).join("");
}

if (launchNetworks) {
  launchNetworks.innerHTML = [...networks, xProfile].map(badgeMarkup).join("");
}

xSlots.forEach(slot => {
  const className = slot.dataset.xSlot === "mobile" ? "nav-social-mobile" : "btn ghost";
  slot.innerHTML = textXLinkMarkup(className);
});

menu?.addEventListener("click", () => {
  nav.classList.toggle("mobile-open");
});

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("mobile-open");
  });
});

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

function multichainNodeMarkup(network, index) {
  return `
    <li class="multichain-item" data-index="${index}">
      <button class="multichain-node" type="button" data-chain-id="${network.id}" aria-label="Select ${network.name}">
        <img src="${network.icon}" alt="${network.name} logo">
      </button>
    </li>
  `;
}

function broadcastSelectedChain(index, source = "orbit") {
  const chain = networks[index];
  if (!chain) return;

  orbitState.selectedIndex = index;

  window.dispatchEvent(
    new CustomEvent(chainChangedEventName, {
      detail: {
        chain: { ...chain },
        source
      }
    })
  );
}

if (multichainWheel) {
  multichainWheel.innerHTML = networks.map(multichainNodeMarkup).join("");
}

if (
  multichainShell &&
  multichainWheel &&
  multichainPanelLogo &&
  multichainPanelName &&
  multichainPanelDescription &&
  multichainPanelStatus &&
  multichainPanelToken &&
  multichainPanelEcosystem &&
  multichainLaunch &&
  multichainLaunchLabel
) {
  const wheelItems = [...multichainWheel.querySelectorAll(".multichain-item")];
  const wheelButtons = [...multichainWheel.querySelectorAll(".multichain-node")];
  const total = wheelItems.length || 1;
  const step = 360 / total;
  const state = {
    angle: 0,
    targetAngle: 0,
    selectedIndex: 0,
    dragging: false,
    animating: false,
    pointerStart: 0,
    angleStart: 0,
    centerX: 0,
    centerY: 0,
    baseTransforms: [],
    frameId: null,
    lastFrameAt: 0,
    pendingSelection: null,
    autoRotationSpeed: 0.012,
    autoRampStart: performance.now(),
    autoRampDuration: 900
  };

  const normalizeAngle = value => ((value % 360) + 360) % 360;

  const shortestDelta = (from, to) => {
    let delta = normalizeAngle(to) - normalizeAngle(from);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  };

  const getClosestIndex = () => {
    const raw = Math.round(-state.angle / step);
    return ((raw % total) + total) % total;
  };

  const getPointerAngle = (clientX, clientY) =>
    Math.atan2(clientY - state.centerY, clientX - state.centerX) * (180 / Math.PI);

  const updatePanel = index => {
    const chain = networks[index];
    if (!chain) return;
    multichainPanelLogo.src = chain.icon;
    multichainPanelLogo.alt = `${chain.name} logo`;
    multichainPanelName.textContent = chain.name;
    multichainPanelDescription.textContent = chain.description;
    multichainPanelStatus.innerHTML = '<span aria-hidden="true">Connected Ready</span><span class="sr-only">Connected and ready</span>';
    multichainPanelStatus.parentElement?.setAttribute("aria-label", "Connected and ready");
    multichainPanelToken.textContent = chain.token;
    multichainPanelEcosystem.textContent = chain.ecosystem;
    multichainLaunch.href = chain.url;
    multichainLaunchLabel.textContent = `Launch ${chain.name}`;
    multichainLaunch.setAttribute("aria-label", `Launch ${chain.name} official website (opens in a new tab)`);
    multichainLaunch.dataset.chain = chain.name;
  };

  const updateSelectionStyles = index => {
    wheelButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  const cacheOrbitLayout = () => {
    const bounds = multichainShell.getBoundingClientRect();
    const radius = Math.max(120, Math.min(bounds.width, bounds.height) * 0.41);
    state.centerX = bounds.left + bounds.width / 2;
    state.centerY = bounds.top + bounds.height / 2;
    state.baseTransforms = wheelItems.map((_, index) => {
      const angleDeg = (index * step) - 90;
      const angleRad = angleDeg * (Math.PI / 180);
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      return `translate3d(${x}px, ${y}px, 0)`;
    });
  };

  const renderOrbit = () => {
    multichainWheel.style.transform = `translate3d(0, 0, 0) rotate(${state.angle}deg)`;
    const nodeRotation = ` rotate(${-state.angle}deg)`;
    wheelItems.forEach((item, index) => {
      item.style.transform = `${state.baseTransforms[index]}${nodeRotation}`;
    });
  };

  const setSelectedChain = (index, source = "orbit") => {
    if (!networks[index]) return;
    state.selectedIndex = index;
    orbitState.selectedIndex = index;
    updatePanel(index);
    updateSelectionStyles(index);
    broadcastSelectedChain(index, source);
  };

  const rotateToChain = (index, source = "orbit", options = {}) => {
    if (!networks[index]) return;
    state.animating = true;
    state.selectedIndex = index;
    updatePanel(index);
    updateSelectionStyles(index);
    const targetBase = -index * step;
    const delta = shortestDelta(state.angle, targetBase);
    state.targetAngle = state.angle + delta;
    state.pendingSelection = {
      index,
      source,
      rampAuto: Boolean(options.rampAuto)
    };
  };

  const startAutoRamp = now => {
    state.autoRampStart = now;
  };

  const tick = now => {
    if (!state.lastFrameAt) state.lastFrameAt = now;
    const deltaMs = now - state.lastFrameAt;
    state.lastFrameAt = now;

    if (state.animating) {
      const delta = shortestDelta(state.angle, state.targetAngle);
      if (Math.abs(delta) < 0.08) {
        state.angle = state.targetAngle;
        state.animating = false;
        if (state.pendingSelection) {
          const pending = state.pendingSelection;
          state.pendingSelection = null;
          if (pending.rampAuto) startAutoRamp(now);
          setSelectedChain(pending.index, pending.source);
        }
      } else {
        state.angle += delta * Math.min(1, deltaMs / 150);
      }
    } else if (!state.dragging) {
      const rampProgress = Math.min(1, (now - state.autoRampStart) / state.autoRampDuration);
      const ramp = 1 - Math.pow(1 - rampProgress, 3);
      state.angle += state.autoRotationSpeed * ramp * deltaMs;
    }

    renderOrbit();
    state.frameId = requestAnimationFrame(tick);
  };

  multichainWheel.addEventListener("click", event => {
    const target = event.target.closest(".multichain-node");
    if (!target) return;
    const chainId = target.dataset.chainId;
    const nextIndex = networks.findIndex(network => network.id === chainId);
    if (nextIndex === -1) return;
    rotateToChain(nextIndex, "orbit");
  });

  const beginDrag = event => {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cacheOrbitLayout();
    state.dragging = true;
    state.animating = false;
    state.pendingSelection = null;
    state.pointerStart = getPointerAngle(event.clientX, event.clientY);
    state.angleStart = state.angle;
    multichainShell.setPointerCapture(event.pointerId);
  };

  const moveDrag = event => {
    if (!state.dragging || event.pointerType === "touch") return;
    const currentPointer = getPointerAngle(event.clientX, event.clientY);
    const delta = currentPointer - state.pointerStart;
    state.angle = state.angleStart + delta;
  };

  const endDrag = event => {
    if (event?.pointerType === "touch") return;
    if (!state.dragging) return;
    state.dragging = false;
    if (typeof event?.pointerId === "number" && multichainShell.hasPointerCapture(event.pointerId)) {
      multichainShell.releasePointerCapture(event.pointerId);
    }
    rotateToChain(getClosestIndex(), "orbit", { rampAuto: true });
  };

  const beginTouchDrag = event => {
    const touch = event.touches[0];
    if (!touch) return;
    cacheOrbitLayout();
    state.dragging = true;
    state.animating = false;
    state.pendingSelection = null;
    state.pointerStart = getPointerAngle(touch.clientX, touch.clientY);
    state.angleStart = state.angle;
  };

  const moveTouchDrag = event => {
    if (!state.dragging) return;
    const touch = event.touches[0];
    if (!touch) return;
    const currentPointer = getPointerAngle(touch.clientX, touch.clientY);
    const delta = currentPointer - state.pointerStart;
    state.angle = state.angleStart + delta;
  };

  const endTouchDrag = () => {
    if (!state.dragging) return;
    state.dragging = false;
    rotateToChain(getClosestIndex(), "orbit", { rampAuto: true });
  };

  window.addEventListener(chainSelectionRequestEventName, event => {
    const chainId = event.detail?.chainId;
    const nextIndex = networks.findIndex(network => network.id === chainId);
    if (nextIndex === -1) return;
    if (
      nextIndex === state.selectedIndex &&
      Math.abs(shortestDelta(state.angle, -nextIndex * step)) < 0.08
    ) {
      setSelectedChain(nextIndex, event.detail?.source || "wallet");
      return;
    }
    rotateToChain(nextIndex, event.detail?.source || "wallet");
  });

  multichainShell.addEventListener("pointerdown", beginDrag);
  multichainShell.addEventListener("pointermove", moveDrag);
  multichainShell.addEventListener("pointerup", endDrag);
  multichainShell.addEventListener("pointercancel", endDrag);
  multichainShell.addEventListener("touchstart", beginTouchDrag, { passive: true });
  multichainShell.addEventListener("touchmove", moveTouchDrag, { passive: true });
  multichainShell.addEventListener("touchend", endTouchDrag, { passive: true });
  multichainShell.addEventListener("touchcancel", endTouchDrag, { passive: true });
  window.addEventListener("resize", () => {
    cacheOrbitLayout();
    renderOrbit();
  });

  updatePanel(0);
  updateSelectionStyles(0);
  cacheOrbitLayout();
  renderOrbit();
  state.frameId = requestAnimationFrame(tick);
  broadcastSelectedChain(0, "init");
} else {
  broadcastSelectedChain(0, "init");
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    const target = entry.target;
    target.animate(
      [
        { opacity: 0, transform: "translateY(20px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      {
        duration: 700,
        easing: "cubic-bezier(.2,.7,.2,1)",
        fill: "forwards"
      }
    );

    observer.unobserve(target);
  });
}, { threshold: 0.12 });

document.querySelectorAll(".section > *, .token-panel").forEach(el => {
  observer.observe(el);
});
