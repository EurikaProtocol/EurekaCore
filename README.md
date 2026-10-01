# EurekaCore

EurekaCore is the existing **tinaneureka.com** frontend for **EUREKA**, **TINAN AI**, and the new **Eureka Data Tokenization** workflow.

## Production profile

- Primary domain: `tinaneureka.com`
- Canonical host: `www.tinaneureka.com`
- App: `EurekaCore`
- AI: `TINAN AI`
- Core message: `DATA → PROOF → TOKENIZATION → UTILITY`
- Active network: `Base`
- Token contract: `0x4042973c0863cca0d73f028ca98465f44f0e6f97`

## Integrated surfaces

- Homepage with data-tokenization vision, TINAN AI messaging, ecosystem overview, and roadmap
- Dashboard for wallet telemetry, activity, and runtime notifications
- Wallet flows for MetaMask, WalletConnect v2, Coinbase Wallet, send, and receive
- EUREKA token page with live on-chain metadata and BaseScan access
- Data Tokenizer for upload, device-side analysis, hashing, proof generation, and local tokenized asset records
- My Assets portfolio with proof filters and dedicated asset detail pages
- Proofs page for Proof of Data, Proof of Action, and Proof of Knowledge
- Whitepaper page with embedded PDF and download access
- Shared runtime config in `/js/config.js`

## Data tokenization architecture

The current implementation is privacy-first and production-safe:

- Uploaded files are stored privately in the browser with IndexedDB
- Proof records store hashes, timestamps, ownership references, metadata, and lightweight storage references
- Large files are **not** stored on-chain
- Tokenization creates a digital representation and verification layer; it does **not** promise automatic market value
- Additional storage providers such as IPFS or Arweave can be added later without redesigning the asset model

## Local setup

```bash
npm install
npm run build
```

Optional environment variables:

```bash
cp .env.example .env
```

- `VITE_WALLETCONNECT_PROJECT_ID` enables WalletConnect v2 pairing.

## Cloudflare deploy

Build:

```bash
npm install && npm run build
```

Deploy:

```bash
npx wrangler deploy
```

The repository includes:

- `wrangler.toml` for the Worker + static assets deployment
- `cloudflare/worker.js` to serve the Vite `dist` output
- `public/whitepaper/EUREKA_CHAIN_Whitepaper_v2.pdf` for the embedded whitepaper route

## Vercel preview deploy

This repository is **not** a Next.js app. The active frontend is the root Vite SPA:

- frontend root: repository root
- app entry: `index.html` → `script.js`
- framework: Vite
- build command: `npm run build`
- output directory: `dist`

For Vercel previews:

- keep the **Root Directory** set to the repository root (`.`)
- use the committed `vercel.json`
- do **not** switch the project to a Next.js framework preset

Cloudflare Workers remains the production deployment path for `tinaneureka.com`. Vercel should only mirror the existing static frontend for preview builds unless the deployment architecture is intentionally changed later.

## Project structure

- `index.html`
- `styles.css`
- `script.js`
- `config.js`
- `components/`
- `pages/`
- `js/config.js`
- `js/data-tokenization.js`
- `js/tinan-agent.js`
- `js/wallet.js`
- `public/`
- `cloudflare/`
