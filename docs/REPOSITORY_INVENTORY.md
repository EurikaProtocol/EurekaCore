# EurikaProtocol Repository Inventory

Snapshot: 2026-10-16. GitHub organization/user search found nine accessible repositories. Repositories and refs were inspected through their GitHub metadata, content listings, commit histories, pull requests, workflows, and releases where available. All listed repositories use `main` as the default branch. No external source repository was modified.

## Repositories

| Repository | Inspected source/ref | Purpose and technology | Classification and migration decision | License |
| --- | --- | --- | --- | --- |
| [EurekaCore](https://github.com/EurikaProtocol/EurekaCore) | `main@9c9b3d0d3ebff80f019a06aac267d1392b51accf`; current PR #19 head `738b5935f9aa41711c209a64b5582aba45c4f269` | Canonical React 19/TypeScript/Vite app, React Router, EVM/Solana wallet adapters, Solidity source, Cloudflare Worker and legacy static entry. | Essential core. Retain as the canonical app and integrate approved ecosystem modules into its existing boundaries. PR #12 is merged; PR #19 remains open. | MIT |
| [EurekaCoreMain](https://github.com/EurikaProtocol/EurekaCoreMain) | `main@66f2696913e6e015046d2f15b296318775a77ab5` | Earlier React/Vite Eureka site, wallet UI, documentation and Wrangler configuration. | Earlier overlapping implementation. No code copied; inspect any specifically identified unique feature before migration. | MIT |
| [EurekaAI](https://github.com/EurikaProtocol/EurekaAI) | `main@4e75502990f247eff980a9b69ce05866c2f82ff3` | Static HTML/CSS/JavaScript landing concept, artwork, archived ZIP and placeholder metadata. | Prototype/reference, not a running AI service. Not copied; no explicit license. | Not specified |
| [TinanAi](https://github.com/EurikaProtocol/TinanAi) | `main@dd8e659f3fd9661955abc1c9784c501483c2309d` | Next.js 15/React 18 agent/project service; OpenNext/Cloudflare, server-side provider API, owner-scoped Basic Auth, D1/R2 storage and tests. | Valuable independent server module, not migrated. Its existing UI in EurekaCore is a local deterministic demo; integration requires licensing confirmation and an authenticated same-origin API design. | Not specified |
| [Node](https://github.com/EurikaProtocol/Node) | `main@b88675e607f0b8bfb5a36c9da768af249c74e43c` | Earlier React/Vite app with ethers, wallet, SDK, Solana and core modules; monolithic app surface. | Overlapping historical implementation. No code copied pending module-by-module uniqueness and license review. | Not specified |
| [assets](https://github.com/EurikaProtocol/assets) | `main@dfa3c8d9ce929e35003a0c6a0344427c913bd738` | Static EUREKA landing and design assets; chain controls are demonstrations. | Reference material overlaps existing app/legacy page. Not copied; no explicit license. | Not specified |
| [next-starter-template](https://github.com/EurikaProtocol/next-starter-template) | `main@9da12fd62b965edea28ea8272e9d9490a58b8270` | Generic Next.js/Cloudflare Workers starter. | No Eureka product capability; intentionally excluded. | Not specified |
| [react-router-starter-template](https://github.com/EurikaProtocol/react-router-starter-template) | `main@7766fd338d00d876040ddf5a4b1288bb058078a8` | Generic React Router/Cloudflare Vite starter. | No Eureka product capability; intentionally excluded. | Not specified |
| [TinanGroup-elektrin-s](https://github.com/EurikaProtocol/TinanGroup-elektrin-s) | `main@753f5b497eeef6c1975329427f2b5a87f04232ff`; open PR #1 head `d279dc77b3c8e69d3677525eadcad4e6083311e3` | Separate Lithuanian TINAN GROUP solar sales website; PR proposes Vite/vanilla JS catalog, demo pricing/calculator, quote UI and GitHub Pages. | Separate commercial website, not an EUREKA protocol module. Intentionally excluded from EurekaCore pending explicit product-scope and licensing approval; PR says prices/specs are demo/unverified and forms have no backend. | No license found |

## GitHub metadata and review

- The eight repositories in the earlier inventory were reviewed for branches, histories, issues, tags/releases, workflow files and dependencies. Current searches add the solar storefront repository above.
- EurekaCore has no listed releases. Open pull requests: [#10](https://github.com/EurikaProtocol/EurekaCore/pull/10) proposes changing the EKA address; [#11](https://github.com/EurikaProtocol/EurekaCore/pull/11) is a draft contract proposal against `EurikaProtocol/patch-477`; [#19](https://github.com/EurikaProtocol/EurekaCore/pull/19) fixes npm lockfile consistency and is the active review branch. [#12](https://github.com/EurikaProtocol/EurekaCore/pull/12) merged to `main` on 2026-10-16.
- TinanAi has no explicit license; its README describes the provider, D1/R2, authentication, tests and execution limitations. The solar PR is open and has no license file in its base repository. Do not copy/adapt either source without rights confirmation.
- No source repository was deleted, archived, renamed, made read-only, or force-pushed.

## Current checks and deployment

- The lockfile failure in Actions run `38162911104` was six missing `utf-8-validate@5.0.10` entries. PR #19 repaired them. Its earlier run `38934456288` passed `npm ci` and `npm test`. Latest PR #19 workflow run `38937872142` for head `738b5935` is `action_required`, not a confirmed pass.
- Cloudflare Workers preview builds for `eurekacore` and `tinan` failed in provider checks. GitHub log retrieval returned 404; Cloudflare dashboard logs require owner access. Their root cause is not established.
- Root `npm test` runs `tsc --noEmit`, five Node built-in tests, and `vite build`. There is no root lint script and no Solidity compile/test harness. Local Node 22 validation passed after the lockfile updates.
- The current workflow references `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; secret values/presence cannot be inspected from this environment. Production DNS and deployment were not changed.
