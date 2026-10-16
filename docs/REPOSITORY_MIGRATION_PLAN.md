# Repository Migration Plan

## Status

The organization/account repository inventory and migration branch are established. This is a staged migration, not a declaration that every external implementation has been merged or that production readiness has been verified.

Branch: `copilot/unify-eurikaprotocol-ecosystem`, created from current PR #19 head `cbe8cc7a973415efe029747bf10394e3df8569da`. That branch is based on PR #12's unmerged feature head (`e180c67c700cccb17371fb333bcb60eadd120b17`). Canonical `main` remains at `61196700286dd0b99aadba44c8f5246793a8025c`. Existing PR branches and source repositories are left intact.

## Decisions and sequence

1. **Use EurekaCore as the canonical web application.** The React/Vite app and route set on the current PR #12 work already consolidate Eureka website, TINAN pages, data assets, proofs, wallet surfaces, token pages, and documentation. Keep this work reviewable as an existing open PR; do not replace it with an older site's implementation.
2. **Keep EVM and Solana boundaries separate.** Preserve their separate network/config/transaction modules. Resolve the conflicting EKA address proposal in PR #10 before treating any one token address or contract as canonical.
3. **Do not copy code from repositories without an explicit license.** This applies to TinanAi, Node, EurekaAI, assets, and both starter templates. Obtain a license/ownership decision and record attribution before any future code or asset migration. EurekaCore and EurekaCoreMain have MIT metadata/files.
4. **Evaluate TinanAi as an independent server-side module.** Its Next.js/OpenNext app has server authentication, provider calls, and D1/R2 persistence that the current static-asset Vite Worker does not provide. Before integration, select the supported hosting/runtime boundary, authentication and ownership model, API routes, data migration policy, and workspace/build strategy. Do not expose its secrets to Vite or claim its capabilities in the browser-only demo.
5. **Compare Node and EurekaCoreMain only for demonstrably unique features.** Current EurekaCore already contains modular wallet, data/proof, SDK, and route implementations; no wholesale app copy or duplicate dashboard is justified. Preserve their source SHAs and histories regardless of migration outcome.
6. **Keep starter templates out of product code.** They are generic frameworks with newer/different Next, React Router, Tailwind, and Cloudflare plugin versions, not Eureka features.
7. **Keep contracts unverified until reviewed.** The repository contains Solidity files, and PR #11 proposes additional contracts, but neither source presence nor a branch is evidence of deployed, audited, or tested contracts. Resolve PR #11's non-main base before considering its work.
8. **Maintain one navigation and distinguish implementation state.** Mark local/demo behavior as local or simulated, configured-but-unverified behavior as such, and future capabilities as planned. Do not claim transactions, AI calls, verification, market data, or deployment outcomes that have not occurred.

## Work completed on this branch

- Created the isolated migration branch from the existing PR #19 head; the source branches and default branch were not changed.
- Rechecked actionable, outdated PR #12 review comments against the current source. The verification handler previously saved proof and asset status separately; it now writes both in one IndexedDB transaction when a linked proof exists, with an asset-only fallback if it does not. Proof of Action and Proof of Knowledge controls now have visible labels.
- Added the repository inventory, migration mapping, architecture snapshot, and consolidation report.
- No code/assets were copied from another repository, no repositories or refs were removed, and no deployment or contract operation was run.

## Required follow-up before broader integration

- Resolve the open PRs #10, #11, and #12 with their owners. PR #10's proposed EKA address differs from the current config; PR #11 targets `EurikaProtocol/patch-477`; PR #12's deployment checks have failed and its outdated review threads should be resolved against the current tree.
- Confirm licenses and authorization for all source repos without explicit licenses.
- Decide whether TinanAi is a separate service or a first-class app/workspace. Then define API contracts, auth, D1/R2 provisioning, data ownership/migration, deployment, and secret handling before moving code.
- Decide whether Node contains unique modules after a code-level comparison. If so, migrate only the specific module and retain its source commit/attribution.
- Reconcile EKA/TINAN token sources and verify the intended public contract/mint values with the owner; do not infer from conflicting app configs or draft pull requests.
- Establish smart-contract compiler/test tooling and review/deployment controls before contract integration. Do not deploy as part of this migration.
- Plan production identity, backend authorization, storage backups, rate limiting, monitoring, and staging verification before exposing any server-side AI or project builder.
- Run tests for each new module from its own supported toolchain in addition to the canonical `npm test`; do not report external provider or live-cloud behavior as verified without credentials and explicit authorization.

## Acceptance gates for later migration stages

- A source-to-destination mapping and source SHA are recorded for each transferred file/module.
- License/attribution and secret scans are clear; no real credentials or personal data enter the repository.
- The chosen module builds and tests independently and through the canonical CI path.
- Existing routes and deployment targets remain functional, and new server/API capabilities have explicit authentication and ownership checks.
- README and architecture/report documents distinguish implemented, demo, configured-but-unverified, and planned behavior.
- Source repositories remain available until migration verification and a separate archival approval.
