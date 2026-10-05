# EUREKA · TINAN AI

TINAN AI is the React/TypeScript application in this existing EurekaCore repository. The former static Eureka landing page remains available at `/eureka-legacy.html`.

## Local development

```sh
npm install
npm run dev
```

Validation:

```sh
npm run build
npm test
```

There is no lint script configured in `package.json`.

## Product routes

The app includes `/`, `/ai`, `/tokenize`, `/create`, `/projects`, `/project/:id`, `/dashboard`, `/wallet`, `/tokens`, `/tokens/:address`, `/contracts`, `/deploy`, `/verify`, `/community`, `/docs`, `/about`, `/privacy`, `/terms`, and `/settings`. Existing Eureka routes remain available, including `/marketplace`, `/explorer`, `/staking`, `/swap`, `/whitepaper`, `/tinan-ai`, `/tinan-ai-token`, and `/pumpfun`.

## Demo behavior and storage

The current `DemoAIProvider` is deterministic, local-only, and requires no AI API. Project drafts and blueprints are stored in browser localStorage. The tokenization wizard is a planning flow only; it does not deploy contracts or submit transactions. On-chain token values are read from the configured RPC and show an error when a contract cannot be read. Energy measurements, prices, balances, transactions, and verification status are never fabricated.

## Environment

Copy `.env.example` to `.env.local` and set only values appropriate for the target deployment:

- `VITE_TINAN_TOKEN_ADDRESS` optionally overrides the supplied existing-token address.
- `VITE_TINAN_TOKEN_CHAIN_ID` must explicitly select a supported EVM chain; no chain is assumed.
- `VITE_RPC_URL` enables read-only ERC-20 queries. It is bundled into the browser, so use only a public-safe HTTPS endpoint; do not put private API keys or credentials in it.
- `VITE_EXPLORER_URL` optionally selects a trusted explorer host.
- `VITE_WALLETCONNECT_PROJECT_ID` configures the existing WalletConnect integration.
- Existing Solana variables configure the separate Solana wallet/token surfaces.

External AI API credentials, if added later, must be Cloudflare Worker secrets or another server-side secret store. Never add private API keys to `VITE_` variables, React source, or public files.

## Cloudflare deployment

This project deploys as a Cloudflare Worker with static assets, not as a Pages project. Wrangler uses `cloudflare/worker.js`, serves the Vite build from `dist`, and configures `www.tinaneureka.com` as a custom domain in `wrangler.toml`.

The production build command is `npm run build`; its output directory is `dist`. To deploy locally, run `npm ci`, `npm run build`, and `npm run deploy` with Wrangler authenticated. Wrangler is pinned in the lockfile for reproducible installs.

To enable automatic deployment from pushes to `main`:

1. Add `www.tinaneureka.com` to an active Cloudflare DNS zone for `tinaneureka.com`. The zone must be managed by Cloudflare.
2. Create a Cloudflare API token with Workers Scripts Edit permission for the account and DNS Edit plus Zone Read permissions for the domain's zone.
3. In the GitHub repository, add Actions secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Merge or push to `main`. The workflow runs `npm ci`, `npm test` (TypeScript check and production build), then deploys the Worker. Wrangler provisions the configured custom domain and its DNS record; do not add a conflicting `www` DNS record manually.
5. Confirm the `www.tinaneureka.com` custom domain and HTTPS status in the Cloudflare Worker dashboard.

The Worker sets basic browser security headers, avoids caching HTML so deployments become visible promptly, and gives Vite-hashed assets a one-year immutable cache lifetime. `public/_redirects` and Wrangler's single-page-app asset fallback preserve direct navigation to client-side routes.

`VITE_*` settings are compiled into browser assets and must be available to the build process before building; setting them only as Worker runtime variables will not configure the frontend. Use only public-safe values for Vite variables. Configure future private API credentials as Cloudflare Worker secrets only when a server-side Worker integration consumes them; no AI secret is required by the current demo.

Vercel's existing `vercel.json` remains available as a separate deployment configuration.

## Production limitations

- The demo AI provider is not a production AI service.
- Network options in the tokenization wizard are architectural choices, not enabled deployments.
- Deploy and verify pages do not claim or submit on-chain actions.
- Repository Solidity sources are not evidence of deployed or audited contracts.
- Browser-local project storage is device-specific and is not a backup.
