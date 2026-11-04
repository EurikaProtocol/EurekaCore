# Ecosystem integration specifications

Products stay independent (own repository, deployment, data). EurekaCore coordinates them only through documented APIs and the permission tiers in `ORCHESTRATION.md`. A registered URL is never assumed to be an authenticated API.

## TINAN AI (`tinan-ai`)
Repository: `https://github.com/EurikaProtocol/TinanAi`. Contract: `TINANAI_INTEGRATION_CONTRACT.md` (`src/server/tinanai-provider.ts`). Status: contract-tested with a fake `fetch`; **not verified live**; no API base URL registered. Max level 2 (propose). Code/PR changes to TinanAi go through GitHub workflows (Phase 2), never direct writes.

## Eureka Data Token Launchpad (`token-launchpad`)
**Not integrated; no repository, API or contract is registered.** Requirements before integration: a documented API, an auth method, testnet-first deployment, and level-6 per-transaction wallet approval (`src/core/approval.ts`) for every deployment or transfer. EurekaCore never requests seed phrases or private keys. Existing token contracts in `Contract/` must be audited before any token integration; none is assumed deployed.

## Eureka Data Layer (`data-layer`)
Local domain logic only (`src/core/data-assets.ts`, `data-proof.ts`). No remote service registered.

## Marketplace (`marketplace`)
Not integrated. Local model stubs in `src/core/marketplace.ts` only.
