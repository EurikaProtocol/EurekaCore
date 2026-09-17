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
