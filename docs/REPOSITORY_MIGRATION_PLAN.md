# EurekaCore Ecosystem Migration Plan

## Goal and guardrails

EurekaCore remains the canonical application and single source of truth for the EUREKA protocol. TINAN AI is an integrated capability within that app, not a replacement for it. Keep EVM, Solana, contracts, data assets, proofs, server-side AI, and storage as independently testable boundaries. This is a staged plan; the external repositories have not all been consolidated.

Do not merge to `main`, deploy, change DNS, move assets, delete/archive source repositories, or copy unlicensed code as part of this plan. Preserve addresses, chain IDs, deployment settings and API/environment names until validated evidence and an approved migration justify a change.

## Stages

1. **Protect and review the canonical baseline.** Keep PR #19 reviewable; its current branch is `copilot/fix-github-actions-job-failure`. PR #12 was merged. Do not overwrite other PRs or assume all unpublished earlier work is present in this checkout.
2. **Retain the current application structure.** Use React/Vite as the primary site and keep the legacy HTML page as a compatibility entry. Retain existing modular EVM and Solana adapters, local data/proof workspace and explicit demo labels.
3. **Resolve product/security decisions before source migration.** Confirm the EKA contract address from authoritative owner-controlled deployment evidence; obtain written rights/license confirmation for TinanAi, Node, EurekaAI, assets and the solar storefront before copying their code or assets.
4. **Integrate TinanAi as a backend capability in EurekaCore.** After licensing approval, port only needed server-side modules behind same-origin `/api/tinan/*` routes. Require authenticated, owner-scoped operations, CSRF/origin protection, HTTPS, rate limits, request size/time limits, and redacted logging. Keep provider keys in Worker secrets. Use D1/R2 only after provisioning and schema/data migration review; keep project execution disabled absent a separately reviewed sandbox. Do not expose provider keys or authenticated API operations to Vite bundles.
5. **Keep unrelated company storefront separate unless explicitly scoped.** TinanGroup-elektrin-s is a different sales website with separate audience, content, demo prices and deployment assumptions. Do not merge its application into EurekaCore without a confirmed product-scope decision and license. If later approved, integrate a link or a well-isolated route/service after design and operational review.
6. **Handle contracts only after review.** PR #11 is a 77-file/34-commit draft based on a non-main branch. Review the exact source, resolve its base/history, confirm desired token economics/admin powers, compile with pinned Solidity tooling, and add unit/invariant tests before any contract is considered. No deployment is authorized.
7. **Address dependencies incrementally.** A compatible Wrangler patch update (4.151.1) and `source-map-js` patch (1.2.2) were applied on PR #19. Remaining 16 high/11 moderate audit findings span Tailwind 3, Solana/React Native/Metro and transitive packages. Run a separately scoped, tested Tailwind 4 migration and investigate supported Solana dependency updates; do not use forced major upgrades or blind overrides.
8. **Validate and publish through reviewed PRs.** Run clean Node 22/npm 10 install, `npm test`, audit, secret scan and contract tests after tooling exists. Verify any subsequent CI result on its exact head SHA. Keep Cloudflare preview failures blocked pending provider logs; do not deploy unverified code.

## Acceptance gates

- Every copied component has a source URL/SHA, rights/attribution record, destination, and secret scan.
- EVM and Solana networks/configs remain distinct and existing addresses/API contracts are not changed without owner evidence.
- Browser IndexedDB remains described as local-only. Hash matching and signer authorization are not described as public/on-chain proof, legal ownership, or independent evidence of external actions.
- TINAN backend access is authenticated server-side and provider credentials are absent from client bundles.
- Builds/tests pass for changed modules and the actual CI check confirms the pushed commit.
- No release/deployment or source repository archival happens without separate authorization and verified rollback.
