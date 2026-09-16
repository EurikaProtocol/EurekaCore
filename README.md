# TinanEureka (EurekaCore)

TinanEureka is a React + Vite + TypeScript Web3 interface with a futuristic glass UI for the Eureka ecosystem.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- ethers v6
- MetaMask + WalletConnect
- Cloudflare Pages (`npm run build`, output `dist`)

## Pages

- Home
- Dashboard
- Wallet
- AI Chat
- Swap
- Staking
- Explorer
- Settings

## Token configuration

EUREKA token settings are centralized in:

- `/home/runner/work/EurekaCore/EurekaCore/src/config/token.ts`

Update this single file to change token fields (`name`, `symbol`, `decimals`, `contractAddress`, `chainId`).
