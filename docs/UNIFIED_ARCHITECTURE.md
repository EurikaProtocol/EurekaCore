# Unified EurekaCore Architecture

## Architecture status

This document describes the architecture present in the current EurekaCore worktree and a conservative target boundary. The React/Vite application in this branch includes the pending PR #12 work; canonical `main` has not yet received that PR. The TinanAi Next.js service and other repository prototypes are not copied into this branch.

```text
EurekaCore repository
├── Web app: React + TypeScript + Vite + React Router
│   ├── EUREKA product and documentation routes
│   ├── TINAN AI demo/projects/tokenization routes
│   ├── Data assets and proof workspace
│   ├── EVM wallet and EKA SDK
│   └── Solana wallet and TinanAI token modules
├── Contract sources: Contract/ and root Solidity files
├── Legacy static landing: eureka-legacy.html + legacy JS/CSS
└── Deployment: Cloudflare Worker workflow/config + Vercel config
```

## Current module boundaries

- **Web application:** `index.html` mounts the React application. `src/App.tsx` defines the consolidated routes; `src/components/` contains shared shell/UI; `src/pages/` contains page-level features. `eureka-legacy.html` remains a separate compatibility entry and loads the older static `script.js`.
- **EVM:** `src/hooks/useEvmWallet.ts` manages the connected provider/signer; `src/sdk/evm.ts` performs EKA token reads/transfers and wallet requests. The React EVM configuration and EKA configuration are separate modules; reconcile them before calling a contract address canonical.
- **Solana:** `src/solana/` and `src/config/tinanai-solana.ts` keep Solana connection, wallet, token and trusted external URL settings independent from EVM network handling.
- **Data/proofs:** `src/core/data-asset-store.ts` stores asset/proof records in local IndexedDB. Verification compares a reselected file hash with the local record; it does not establish ownership or external truth. The proof UI signs user-submitted messages only through an explicitly connected wallet.
- **AI/projects:** the current React UI's deterministic demo and project storage are local/browser-side. The independent TinanAi repository has real server-side provider request support and D1/R2 persistence, but that is a separate application/runtime and is not wired into the current browser app.
- **Contracts:** Solidity files are source artifacts. No contract deployment, on-chain transaction, automated contract test, or security audit is claimed by this architecture.
- **Compatibility:** `vite.config.ts` builds both the React entry and `eureka-legacy.html`; keep legacy routes/redirects until actual usage and replacements are verified.

## Configuration and security boundaries

- Vite `VITE_*` values are compiled into public browser code. Only public-safe RPC/project identifiers belong there; provider secrets, passwords, private keys, and server credentials must not be placed in frontend variables.
- EVM and Solana need separate chain/network validation and transaction flows. Do not infer an address or network from another chain's config.
- Browser IndexedDB/localStorage are local device storage, not server backup, encryption, multi-user storage, or proof of public publication.
- TinanAi's Basic Auth, API key, and D1/R2 bindings must stay server-side if that application is later integrated. Its README states that the current service is single-owner and project execution is disabled; a UI route alone cannot safely activate those features.
- Never turn demo/plan-only pages into claims of successful AI execution, tokenization, verification, market activity, or deployment.

## Build and deployment

- Canonical scripts: `npm run dev`, `npm test` (`tsc --noEmit && vite build`), and `npm run deploy`.
- Cloudflare deployment uses the root `wrangler.toml` and the GitHub Actions workflow. Automatic deployment is limited to a push to `main`; pull requests run install and build/test only.
- `vercel.json` is a separate root SPA deployment configuration. Do not combine the two deployment systems without verifying route fallback, output, environment values, and production behavior for each.
- No monorepo/workspace has been introduced. Keep one package manager/lockfile for the current app until a distinct server module is licensed and its build/test/deployment boundary is approved.

## Target evolution

Keep the current app as the user-facing shell. If the TinanAi service is approved for migration, define an authenticated API/service boundary and mount its UI through supported routes rather than copying a second full app or duplicating navigation. Migrate only validated modules from other repositories into existing boundaries (`src/core`, `src/sdk`, `src/solana`, `src/pages`) after license and behavior checks. Do not create empty packages or move source files solely to match a proposed directory tree.
