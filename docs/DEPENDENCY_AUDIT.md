# Dependency audit (Phase 4)

Package manager: npm (Node 22), `package-lock.json` committed; installs use `npm ci`.
Command: `npm audit --json` (counts at time of audit: 27 total = 11 moderate, 16 high, 0 critical).
CI: `node scripts/audit-check.mjs` fails on any high/critical package not listed in `security/audit-baseline.json`; accepted ones are printed on every run. The baseline is a triage record, not a fix.

| High package(s) | Direct? | Path | Fix available | Risk |
|---|---|---|---|---|
| `tailwindcss` (via `chokidar`, `fast-glob`, `micromatch`, `braces`) | direct (`^3.4.19`) | tailwindcss → chokidar/micromatch → braces | `tailwindcss@4.3.3` (semver-major) | Tailwind 4 changes config/PostCSS setup; needs a styling migration and visual check. Build-time tooling only (not shipped in the bundle). Not done. |
| `@solana-mobile/*` (`wallet-adapter-mobile`, `mobile-wallet-adapter-protocol[-web3js]`, `wallet-standard-mobile`) | transitive of `@solana/wallet-adapter-*` | wallet-adapter → solana-mobile → react-native | none non-breaking (`fixAvailable` is a major/downgrade) | `--force` would change the wallet stack; not applied. |
| `react-native`, `@react-native/*`, `metro*` | transitive | via solana-mobile | none | React Native tooling is not used by this web app; advisories are in dev-server/CLI code. Not exploitable in the Vite bundle as far as can be told, but unverified. |

`npm audit fix --dry-run` (no `--force`) proposes no changes, so no dependency update was applied in Phase 4. Wallet and blockchain libraries were deliberately left untouched. Next step: an owner-approved Tailwind 4 migration, and upstream releases of the Solana wallet adapters.

## Launch triage (2026-11-04) — supersedes the table above

`npm audit` now reports 14 high packages (after `npm audit fix` resolved `vite` and `follow-redirects`). The old Tailwind/Solana/React Native entries are no longer reported and were removed from `security/audit-baseline.json`. The 14 below are **accepted, not fixed**, and are still printed on every CI run.

| Packages | Exposure | Justification | Exit |
|---|---|---|---|
| `@walletconnect/ethereum-provider`, `@reown/appkit*` (7), `zod` (GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized constrained collections), `abitype`, `@coinbase/cdp-sdk` | Browser bundle (wallet connect) | No non-breaking fix exists: `npm audit` only offers `@walletconnect/ethereum-provider@2.19.4`, a downgrade. The impact is a client-side DoS in the visitor's own tab; the Worker, D1 and approvals do not use these packages. Wallet and blockchain libraries are deliberately not force-changed without a wallet regression test. | Upgrade when Reown/WalletConnect depend on `zod >= 4.6.6`; re-run `npm audit`; remove entries. |
| `miniflare`, `sharp`, `undici` (GHSA-8xcm-r25x-g524 and ~24 others, fixed in undici 7.30.1) | devDependency, local test harness only; not in `dist` or the deployed Worker (which runs on workerd) | The harness only talks to a local Miniflare instance and stubbed services. | Upgrade Miniflare once it ships `undici >= 7.30.1`. |

Review again before enabling any feature that processes untrusted client-side input through the wallet stack.
