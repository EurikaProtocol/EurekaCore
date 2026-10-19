# Unified EurekaCore Architecture

## Current architecture

```text
EurekaCore (canonical repository)
├── React + TypeScript + Vite web application
│   ├── EUREKA routes, shared shell and documentation
│   ├── TINAN AI local demo and project UI
│   ├── data-asset / proof workspace (browser IndexedDB)
│   ├── EVM wallet and EKA SDK
│   └── separate Solana wallet/token adapters
├── Solidity source artifacts (not yet test/deploy ready)
├── legacy static landing compatibility entry
└── Cloudflare Worker static-asset deployment + separate Vercel config
```

`main` is canonical. The React app and PR #12 data/proof/TINAN UI work are on main. The external TinanAi provider/API service has not been migrated. EurekaCore's `/ai` is a deterministic local demo, not a production AI system.

## Module boundaries

- **Web:** `index.html` mounts React; `src/App.tsx`, `src/pages/`, and `src/components/` implement route surfaces. `eureka-legacy.html` and the static root JS remain a separate compatibility entry.
- **EVM:** `src/hooks/useEvmWallet.ts`, `src/sdk/evm.ts`, `src/config/` handle connected wallet, token reads/transfers and configuration. The PR #10 address proposal is not treated as authoritative.
- **Solana:** `src/solana/` and `src/config/tinanai-solana.ts` handle the separate chain, wallet and token settings.
- **Data/proofs:** `src/core/data-assets.ts` and `src/core/data-asset-store.ts` validate and persist records in browser IndexedDB. File hash comparison verifies consistency with that local record; a wallet signature verifies authorization of a message. Neither proves legal ownership, public publication, or that an external event happened.
- **AI:** current TINAN AI React surfaces use local deterministic behavior. The independent TinanAi backend has provider calls, auth and D1/R2 persistence, but is not connected. If approved for migration, use authenticated same-origin server APIs with server-only provider secrets and owner-scoped persistence. Keep generated-code execution disabled unless isolated execution is separately designed and reviewed.
- **Contracts:** repository Solidity files and PR #11 are source only. The project has no configured contract compiler/test harness. No deployment/audit/readiness is claimed.
- **Solar storefront:** TinanGroup-elektrin-s is an independent commercial website. It is not included in the protocol app absent owner scope decision and license confirmation.

## Security/configuration

- All `VITE_*` variables are public client-build values. Do not put AI provider keys, passwords, private keys, or other server credentials there.
- For any future AI backend, authenticate/authorize at the Worker/API boundary, scope every record to the authenticated owner, verify same-origin unsafe requests, require HTTPS, rate-limit, cap payloads/timeouts, and redact logs.
- IndexedDB/localStorage are per-browser local persistence; they are not encrypted server storage or blockchain proofs.
- Preserve existing token addresses, chain IDs, and environment variable names absent authoritative owner-confirmed migration.

## Deployment and validation

- `npm test` runs TypeScript checking, Node tests in `tests/*.test.mjs`, and the Vite production build.
- `.github/workflows/cloudflare-deploy.yml` runs install/test for PRs and pushes to main; it deploys with Wrangler on main push using `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- `wrangler.toml` serves `dist` as Worker assets and configures `www.tinaneureka.com`. This is config evidence, not proof the secret values exist or deployment is healthy.
- `vercel.json` is a separate supported preview/deployment config; validate it independently.
- Keep production deployment and DNS unchanged until actual check results and owner approval.
