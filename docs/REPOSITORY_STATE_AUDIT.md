# EurekaCore in-place state audit

Base: `56846cd` (+ local `ae8beec`). Architecture: Vite + React/TypeScript SPA, deployed as a Cloudflare Worker with static assets (`wrangler.toml` is authoritative; scripts pass `--config wrangler.toml`).

## Removed (unreferenced anywhere in source, docs, config or tests)
- `pillow-12.3.0-cp312-...whl` – Python wheel, unrelated to this JS project.
- `direct_url.json` – pip install metadata pointing at a local iOS path.

## Kept, needs an owner decision
- `EurekaTinanCore.git (1).zip` – archive containing a `.git` directory and an older EurekaCore copy; possibly a backup, so not deleted.
- `index (5).html` – differs from `index.html`; purpose unknown.
- `public/script.js` and `public/styles.css` differ from the root `script.js` / `styles.css`. Root files are bundled via `eureka-legacy.html`; the `public/` copies are shipped verbatim. Determine which is authoritative before deduplicating.
- `wrangler.jsonc` vs `wrangler.toml` – worker names differ (`eurekacore` vs `eurekacore-v3`); confirm the live Worker.
- Unreferenced TypeScript modules (not imported anywhere): `src/core/asset.ts`, `data-proof.ts`, `device.ts`, `proof.ts`, `src/sdk/index.ts`, `src/solana/transactions.ts`. They are part of the intended core/SDK surface and were not deleted; wire them into pages/services or remove with owner approval.
