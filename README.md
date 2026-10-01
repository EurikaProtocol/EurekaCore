# TinanEureka (EurekaCore)

Production-oriented EUREKA Protocol frontend built with React 19, TypeScript, Vite, Tailwind, React Router, ethers v6, Solana Web3.js, Solana Wallet Adapter, WalletConnect, MetaMask, Phantom, and Framer Motion.

## Runtime goals

- Keep **EKA** on EVM and **TinanAI Token** on Solana strictly separate.
- Never hardcode unofficial Solana mint values.
- Require explicit wallet approval for every network switch and transaction.
- Render only trusted external links for explorers, wallets, and Pump.fun.
- Avoid fake market data in production.

## Required environment variables

Copy `.env.example` and configure:

- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_SOLANA_NETWORK`
- `VITE_SOLANA_RPC_URL`
- `VITE_TINANAI_SOLANA_MINT`
- `VITE_PUMPFUN_TOKEN_URL`
- `VITE_TINANAI_METADATA_URI`

Current official Solana mint value:

- `VITE_TINANAI_SOLANA_MINT=6FQCFFmcCE4WY2X2hxquMnKgnzwSy1sJLX5VuRMe9Ddp`

## Local development

```bash
npm install --legacy-peer-deps
npm run build
```

## Cloudflare Pages

- Framework preset: `Vite`
- Root directory: `/`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`
- Env: `NODE_VERSION=22`, `NPM_FLAGS=--legacy-peer-deps`

SPA routing fallback is handled by `public/_redirects`.

## Routes

- `/`
- `/assets` — browser-local data asset records and file hash checks
- `/proofs` — Proof of Data, signed Proof of Action statements, and user-authored knowledge records
- `/tokenize` — export content-hash metadata packages; minting is not connected
- `/ecosystem` — current integrations and coming-soon networks
- `/dashboard`
- `/wallet`
- `/tinan-ai`
- `/marketplace`
- `/whitepaper`
- `/staking`
- `/swap`
- `/explorer`
- `/settings`
- `/tinan-ai-token`
- `/pumpfun`

## Data assets, proofs, and TINAN AI

- Supported files (maximum 25 MB) are SHA-256 hashed in the browser. File contents are not uploaded or stored by this application.
- Data asset and proof metadata is stored in browser IndexedDB for the current origin/profile only. It is not encrypted, synchronized, backed up, or anchored to a blockchain.
- Proof of Data hash comparison only confirms that a re-selected file matches a locally stored hash record.
- Proof of Action verifies that a connected EVM wallet signed a user-submitted statement. A signature does not independently prove the described external action occurred.
- Proof of Knowledge hashes a user-authored structured record; it does not certify the truth of its contents or represent AI analysis.
- Token metadata can be exported as JSON. The repository has no data-token contract, data storage backend, mint transaction, or tokenization API; exported metadata is not a minted asset.
- TINAN AI is presented as Natural Intelligence. This static frontend has no AI provider, `/api/ai/analyze`, or `/api/ai/summarize` backend. It does not return fabricated summaries or analysis. Provider-backed AI requires a future authenticated server-side integration; provider credentials must never be placed in `VITE_` variables.
- Ethereum and Solana retain their existing wallet/token-read integrations. Other multichain networks are marked Coming Soon for this data-asset flow.
