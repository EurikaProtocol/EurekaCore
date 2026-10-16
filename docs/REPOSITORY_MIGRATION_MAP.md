# EurekaCore Repository Migration Map

Snapshot: 2026-10-16. This map separates capabilities already in EurekaCore from external repositories that have **not** been copied. Source repositories and refs remain intact.

| Source | Source reference | EurekaCore destination/status | Follow-up |
| --- | --- | --- | --- |
| EurekaCore | `main@9c9b3d0d3ebff80f019a06aac267d1392b51accf`; PR #19 head `738b5935f9aa41711c209a64b5582aba45c4f269` | Canonical app; PR #12's React/TINAN UI and local data/proof capability are merged on `main`. | Review PR #19 for lockfile fix, audited compatible dependency updates and migration documentation. |
| EurekaCoreMain | `main@66f2696913e6e015046d2f15b296318775a77ab5` | No files copied; overlapping site. | Compare only a specifically identified unique, MIT-compatible feature. |
| EurekaAI | `main@4e75502990f247eff980a9b69ce05866c2f82ff3` | No files copied; static prototype/assets. | No license; retain as design reference pending rights confirmation. |
| TinanAi | `main@dd8e659f3fd9661955abc1c9784c501483c2309d` | Existing EurekaCore `/ai` UI is local demo only. Server implementation is not migrated or connected. | No license; after rights approval, integrate server logic into an in-repo backend module and authenticated same-origin API; keep provider secrets server-side. |
| Node | `main@b88675e607f0b8bfb5a36c9da768af249c74e43c` | No files copied; prototype overlaps current SDK/wallet/core. | No license; compare modules and obtain approval before copying. |
| assets | `main@dfa3c8d9ce929e35003a0c6a0344427c913bd738` | No files copied; overlapping static landing/artwork. | No license; do not transfer assets absent rights confirmation. |
| next-starter-template | `main@9da12fd62b965edea28ea8272e9d9490a58b8270` | Excluded generic starter. | No product capability to migrate. |
| react-router-starter-template | `main@7766fd338d00d876040ddf5a4b1288bb058078a8` | Excluded generic starter. | No product capability to migrate. |
| TinanGroup-elektrin-s | `main@753f5b497eeef6c1975329427f2b5a87f04232ff`; open PR #1 head `d279dc77b3c8e69d3677525eadcad4e6083311e3` | No files copied; separate solar-equipment storefront, not an EUREKA protocol module. | No license; separate product and audience. Keep out unless owner confirms scope and rights. |

## Existing EurekaCore module destinations

| Capability | Current location | Verified limits |
| --- | --- | --- |
| Main application/routes | `index.html`, `src/App.tsx`, `src/pages/`, `src/components/` | React/Vite primary entry; legacy static page is a second build entry. |
| EVM/EKA | `src/hooks/useEvmWallet.ts`, `src/sdk/evm.ts`, `src/config/` | Connected-wallet signer; EKA address proposal in PR #10 is unverified and conflicts with current config. |
| Solana/TINAN token | `src/solana/`, `src/config/tinanai-solana.ts`, `src/config/networks.ts` | Separate network and wallet flow; do not infer values from EVM config. |
| Data assets/proofs | `src/core/data-assets.ts`, `src/core/data-asset-store.ts`, `src/pages/DataAssets.tsx` | Browser IndexedDB, local hashing and wallet signatures; not server persistence, public anchoring, legal ownership, or external-action verification. |
| AI/project UI | `src/pages/TinanStudio.tsx`, `src/pages/TinanProjects.tsx`, `src/services/` | Deterministic local demo/storage only; external TinanAi server is unwired. |
| Contracts | `Contract/` and root Solidity files | Source artifacts; no current compiler/test harness or audit claim. PR #11 is a draft on a non-main base. |
| Deployment | `.github/workflows/npm-publish.yml`, `wrangler.toml`, `vercel.json` | Cloudflare Worker deploys only from main; Vercel is a separate config. Provider-side build results and production secret presence are unverified. |
