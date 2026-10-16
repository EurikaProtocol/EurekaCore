# Repository Migration Map

Snapshot date: 2026-10-16. The source references are `main` HEADs observed during discovery. No external repository content was copied by this branch; mappings below record the current destination or the safe next destination without implying migration is complete.

| Source repository and reference | Source purpose | Destination / status | Rationale and remaining work |
| --- | --- | --- | --- |
| `EurikaProtocol/EurekaCore` — `main@61196700286dd0b99aadba44c8f5246793a8025c`; feature branch `copilot/prepare-eureka-data-tokenization@e180c67c700cccb17371fb333bcb60eadd120b17`; lockfile branch `copilot/fix-github-actions-job-failure@cbe8cc7a973415efe029747bf10394e3df8569da` | Canonical React/Vite app, contracts, deployment and legacy page | Remains canonical. Current migration branch starts at the lockfile branch head, which is based on the PR #12 feature branch. | Retains pending work without changing source branches. Review/merge ordering remains an owner decision. |
| `EurikaProtocol/EurekaCoreMain` — `main@66f2696913e6e015046d2f15b296318775a77ab5` | Earlier React/Vite Eureka site and deployment/docs | No files copied. Existing canonical routes/components are the destination for already-covered website behavior. | MIT-licensed, but mostly overlapping. Revisit only a specifically identified unique page or asset after comparing it to the canonical implementation. |
| `EurikaProtocol/EurekaAI` — `main@4e75502990f247eff980a9b69ce05866c2f82ff3` | Static landing concept, website ZIP, artwork and empty metadata | No files copied. Canonical homepage and `/eureka-legacy.html` remain the web destinations. | No license specified; placeholder links and token language are not evidence of live integrations. |
| `EurikaProtocol/TinanAi` — `main@dd8e659f3fd9661955abc1c9784c501483c2309d` | Next.js server-side agent/project builder with D1/R2 and tests | Candidate isolated module boundary: `apps/ai-agent` or a separately deployed service, undecided; not present/migrated yet. | No license specified. Requires runtime/API/auth/storage/deployment design and independent tests before source migration. |
| `EurikaProtocol/Node` — `main@b88675e607f0b8bfb5a36c9da768af249c74e43c` | Earlier React/Vite prototype with ethers, UI, and separate core/config/SDK/Solana folders | No files copied. Candidate modules map to existing `src/core`, `src/sdk`, `src/solana`, and route/page modules only after a uniqueness and license review. | No license specified; significant implementation overlap and a large monolithic app entry make wholesale copying unsafe. |
| `EurikaProtocol/assets` — `main@dfa3c8d9ce929e35003a0c6a0344427c913bd738` | Static landing and supplied artwork | No files copied. Design reference only. | No license specified; similar content already exists in EurekaCore. |
| `EurikaProtocol/next-starter-template` — `main@9da12fd62b965edea28ea8272e9d9490a58b8270` | Generic Next.js/Cloudflare Workers starter | Excluded from product migration. | No Eureka product code; no license specified. |
| `EurikaProtocol/react-router-starter-template` — `main@7766fd338d00d876040ddf5a4b1288bb058078a8` | Generic React Router/Cloudflare Vite starter | Excluded from product migration. | No Eureka product code; no license specified. |

## Current in-repository destinations

| Capability | Current EurekaCore location | State and limits |
| --- | --- | --- |
| Main web app and routes | `index.html`, `src/App.tsx`, `src/pages/`, `src/components/` | React/Vite entry with React Router. The former static landing is retained as `eureka-legacy.html`. |
| EVM wallet/EKA SDK | `src/hooks/useEvmWallet.ts`, `src/sdk/evm.ts`, `src/config/` | Uses the connected wallet signer. Address/chain config has multiple sources and the draft PR #10 conflict requires owner confirmation. |
| Solana wallet/token | `src/solana/`, `src/config/tinanai-solana.ts`, `src/config/networks.ts` | Separate config/network flow; values must be validated and remain distinct from EVM. |
| Data Assets and proofs | `src/pages/DataAssets.tsx`, `src/core/data-asset-store.ts` | Browser-local IndexedDB workspace; local hash/proof records do not imply upload, encryption, legal ownership, or public verification. |
| TINAN AI UI/projects | `src/pages/TinanStudio.tsx`, `src/pages/TinanProjects.tsx`, `src/services/` | Existing app uses a deterministic demo/local browser storage. It is not the TinanAi server-side provider/project service. |
| Solidity | `Contract/` and root Solidity files | Source only. No deployment or audit is asserted; PR #11 remains open against a non-main base. |
| Deployment/documentation | `.github/workflows/`, `wrangler.toml`, `wrangler.jsonc`, `vercel.json`, `README.md` | Cloudflare and Vercel configurations coexist; maintain both only while actively supported and independently verified. |

## Preservation record

All source repositories, branches, tags, releases, and histories remain untouched. No tags/releases were present at discovery. Each repository uses `main` as its default branch; the SHAs above provide reproducible source references for this inventory. The open EurekaCore PR refs and their status are listed in `REPOSITORY_INVENTORY.md`.
