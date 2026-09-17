# TinanEureka (EurekaCore)

TinanEureka is a React 19 + Vite + TypeScript Web3 interface for the EUREKA Protocol.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- ethers v6
- Solana Web3.js
- Solana Wallet Adapter + Phantom
- WalletConnect
- Framer Motion

## Routes

- /
- /dashboard
- /wallet
- /tinan-ai
- /marketplace
- /whitepaper
- /staking
- /swap
- /explorer
- /settings
- /tinan-ai-token
- /pumpfun

## Token separation

- `EKA` is the native EVM token and is configured in `/home/runner/work/EurekaCore/EurekaCore/src/config/token.ts`.
- `TinanAI` is the Solana token path and is configured in `/home/runner/work/EurekaCore/EurekaCore/src/config/tinanai-solana.ts`.
- Do not hardcode fake Solana mint addresses.

## Required environment variables

- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_SOLANA_NETWORK`
- `VITE_SOLANA_RPC_URL`
- `VITE_TINANAI_SOLANA_MINT`
- `VITE_PUMPFUN_TOKEN_URL`
- `VITE_TINANAI_METADATA_URI`

## Cloudflare Pages

- Framework preset: Vite
- Root directory: `/`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`
- Environment variable: `NPM_FLAGS=--legacy-peer-deps`

SPA routing is handled by `public/_redirects`.
