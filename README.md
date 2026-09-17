# EurekaCore

EurekaCore is a Cloudflare-ready frontend for **TINAN AI** and the **EUREKA** token on **Base**.

## Production profile

- Primary domain: `www.tinaneureka.com`
- App: `EurekaCore`
- AI: `TINAN AI`
- Token: `EUREKA`
- Network: `Base`
- Contract: `0x4042973c0863cca0d73f028ca98465f44f0e6f97`

## Features

- Emerald animated landing page with hero, ecosystem, and roadmap sections
- Dashboard with portfolio, wallet balance, EUREKA balance, activity, and notifications
- Wallet flows for MetaMask, WalletConnect v2, Coinbase Wallet, send, and receive
- TINAN AI chat with prompt history plus wallet, knowledge, token, and developer agents
- Token page with live name, symbol, total supply, decimals, contract address, and BaseScan access
- Shared runtime config in `/js/config.js`

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

## Project structure

- `index.html`
- `styles.css`
- `script.js`
- `config.js`
- `assets/`
- `components/`
- `pages/`
- `css/glass.css`
- `js/config.js`
- `js/wallet.js`
- `js/tinan-agent.js`
