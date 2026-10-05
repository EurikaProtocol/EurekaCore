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

The existing `wrangler.toml` Worker asset binding and custom domain are preserved. Build the app with `npm run build`, configure the variables above in the Cloudflare Worker environment, and deploy using an authenticated Wrangler CLI with `npx wrangler deploy`. Do not configure secret values as public Vite build variables.

Vercel's existing `vercel.json` remains available as a separate deployment configuration.

## Production limitations

- The demo AI provider is not a production AI service.
- Network options in the tokenization wizard are architectural choices, not enabled deployments.
- Deploy and verify pages do not claim or submit on-chain actions.
- Repository Solidity sources are not evidence of deployed or audited contracts.
- Browser-local project storage is device-specific and is not a backup.
