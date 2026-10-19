# EurekaCore architecture

## What the core owns
Pure, framework-free domain logic in `src/core/`, usable and testable without a browser, OpenAI credentials, paid APIs or mainnet transactions. The React app (`src/pages`, `src/components`), config bindings (`src/config`, which read `import.meta.env`) and external services sit outside it.

## Modules
| Module | Responsibility |
|---|---|
| `errors.ts` | `CoreError`, `Result<T>` (`ok`/`fail`), ISO timestamp check. |
| `verify.ts` | Address validation (EVM, Solana) and trusted-host URL checks. |
| `asset.ts` | Ecosystem asset type, pure `createEcosystemAssets`, `validateEcosystemAsset`. The app-bound `ECOSYSTEM_ASSETS` lives in `src/config/ecosystem-assets.ts`. |
| `data-assets.ts` | Local data assets, SHA-256 hashing, signed-action verification, tokenization *metadata* preparation (existing). |
| `data-proof.ts` | Energy-data proof records, structural validation, and the `SUBMITTED → VERIFIED → ANCHORED` transitions. Advancing requires caller-supplied evidence; the module checks nothing on-chain. |
| `proof.ts` | `verifyProof`: data proofs (SHA-256 match) and action proofs (wallet signature). Knowledge proofs are unsupported. |
| `device.ts` | Self-reported `DeviceMetadata` validation and a `DeviceAttestationProvider` boundary. |
| `agent.ts` | Versioned (v1.0) task/result contract for an AI agent, strict result validation, `dispatchAgentTask`. |
| `task.ts` | Task lifecycle, cancellation, `TaskStore` interface and in-memory store. |
| `approval.ts` | Consequential actions and wallet-signed, parameter-bound, single-use approvals; AI output alone never authorizes them. |
| `transaction.ts` | Chain-agnostic lifecycle `proposed → submitted → confirmed / failed`. |

SDK (`src/sdk`): `evm.ts`, `solana.ts` (wallet readers), `blockchain-adapter.ts` (`EVMAdapter`, `SolanaAdapter`), plus `../solana/transactions.ts` (unsigned SOL transfer + proposed record) and a re-export of the core. Entry points: `src/core/index.ts` (pure) and `src/sdk/index.ts` (core + chain adapters).

Dependency direction: `config`/`pages` → `sdk` → `core`; `core` never imports `sdk`, `config`, or React. `errors` is the base module.

## Not supported (by design)
- **Device attestation:** no cryptographic implementation; `verifyDeviceAttestation` returns `UNAVAILABLE` without a provider and never succeeds by itself.
- **Knowledge proof verification**, on-chain anchoring/confirmation, and tokenization (metadata preparation only).
- **Solana transactions:** only builds an unsigned transfer and a `proposed` record. Signing, sending and confirmation are the wallet's/caller's job and are not implemented or tested against a network.
- A wallet signature proves the signer authorised a statement, not that an event occurred or legal ownership.
- A `data-proof.ts` hash is `0x` + 64 hex; `data-assets.ts` uses 64 hex without prefix. Both formats are retained for compatibility.

## Build and test
`npm test` = `tsc --noEmit`, Node tests (`tests/*.test.mjs`, TypeScript sources are bundled with esbuild by `tests/helpers/load-src.mjs`), then `vite build`. Tests use no network and no mocks of chains; real signatures are created with random local wallets.

## Cloudflare
`wrangler.toml` is authoritative (Worker `eurekacore-v3`, assets in `dist`, route `www.tinaneureka.com`). Remaining owner actions: confirm the live Worker name vs `wrangler.jsonc`, set GitHub secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`, and verify the custom domain after a deploy. See README.

## Control core and AI agent
See `docs/TINANAI_INTEGRATION_CONTRACT.md`. EurekaCore works without any AI agent or credentials.

## Publishing
`package.json` is `private: true` and the SDK is internal source, not a published package. The former `npm-publish.yml` never published; it is the Cloudflare deploy workflow and was renamed `cloudflare-deploy.yml`. Making the SDK a package would require a name/scope, `exports`, a build, and an `npm publish --provenance` workflow with a restricted token; that is an owner decision.
