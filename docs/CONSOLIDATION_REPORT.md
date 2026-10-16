# EurekaCore Consolidation Report

Snapshot: 2026-10-16. **EurekaCore remains the canonical repository, but ecosystem consolidation is incomplete.** The work below preserves existing functionality and documents safe next steps; it does not claim external code migration or production readiness.

## Completed in EurekaCore

- PR #12 merged the React/Vite app with integrated TINAN UI and local data/proof capabilities.
- PR #19 fixed the missing six `utf-8-validate@5.0.10` lockfile entries that caused `npm ci` failure.
- On PR #19, updated Wrangler to exact version 4.151.1 (non-major patch) and refreshed `source-map-js` to 1.2.2. These fixes remove the Wrangler/Miniflare/sharp and source-map advisories from the current audit.
- Added this repository inventory, migration plan/map, architecture and status report. No external repository code or assets were copied.
- No production deploy, contract deploy, DNS change, source repository edit/archive, or force-push was performed.

## Repository disposition

Nine organization repositories were discovered. EurekaCore is the only active canonical protocol/app destination. EurekaCoreMain and Node overlap historical app implementations; EurekaAI and assets are prototypes/references; the two starter templates are generic; TinanAi is a candidate server module but lacks an explicit license and is not wired into the current app; TinanGroup-elektrin-s is a separate commercial storefront with an open PR, no license file, and demo/unverified data. Detailed refs and decisions are in `REPOSITORY_INVENTORY.md` and `REPOSITORY_MIGRATION_MAP.md`.

## Validation

- `npm ci` using Node `22.23.3`/npm `10.9.9` — passed; 841 packages installed from the current lockfile.
- `npm test` on Node 22 — passed: `tsc --noEmit`, all five focused data/proof tests, and Vite production build.
- Vite emits an existing warning that the classic script in `eureka-legacy.html` is not bundled as a module; build completes.
- No lint script or Solidity test/compiler harness exists. No contract tests were run.
- `npm audit` after safe updates reports **27 total: 16 high, 11 moderate, no critical**. Remaining risks include Tailwind 3 dependency chain (suggested Tailwind 4 fix is major), Solana wallet/mobile adapter and React Native/Metro tree, and transitive jayson/stream-json/uuid paths. Do not blindly force overrides. Re-evaluate at remediation time.
- GitHub Actions run `38934456288` on the preceding PR #19 head passed npm install/type-check/tests/build. The current head `738b5935` run `38937872142` is `action_required`, not a confirmed pass; local checks above validate the current lockfile. Cloudflare preview builds have failed, but provider logs returned 404 through available GitHub tooling. No deployment result is claimed.
- Secret scan and CodeQL should be run on final review commits; no secret values were read or modified. Secret presence cannot be inspected here.

## Open blockers / owner action

1. Review PR #19: `https://github.com/EurikaProtocol/EurekaCore/pull/19`. Merge only through normal review/protection and only after CI status is current.
2. PR #10 proposes `0x5D0435779b10234fD4941cc15fae8C7C86117E91`, while current EKA/TINAN config and contract references use `0x4042973c0863CCA0D73F028cA98465F44F0e6F97`. Public search did not establish either as canonical. Owner must provide authoritative chain/explorer/deployment evidence before changing token configuration.
3. PR #11 remains a draft with 77 changed files/34 commits against non-main `EurikaProtocol/patch-477`. Its custom token/admin powers need product/security review; establish pinned Solidity compilation and behavior/invariant tests before considering integration.
4. Confirm license/ownership for TinanAi, Node, EurekaAI, assets and the new solar storefront before copying code/assets. Confirm whether the solar storefront is in scope; it is intentionally separate from protocol app for now.
5. Approve TinanAi backend placement/auth model and same-origin API; provision/test D1/R2 and server-only provider secret handling. Current browser UI remains demo/local.
6. Request Cloudflare build logs in the authorized account for failing `eurekacore`/`tinan` preview checks. Verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist through repository settings without revealing values. Do not deploy until checks and staging are approved.
7. Schedule independent Tailwind 4 migration and Solana wallet dependency remediation for the remaining advisories.

Do not archive any repository until every approved module is migrated, tested, licensed, deployed/verified where relevant, and archival approval is separately granted.
