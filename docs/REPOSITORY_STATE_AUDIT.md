# EurekaCore in-place state audit

Base: `56846cd` plus local commits. Architecture: Vite + React/TypeScript SPA deployed as a Cloudflare Worker with static assets.

## Audit findings and resolution

| Finding | Evidence | Resolution |
|---|---|---|
| `wrangler.toml` vs `wrangler.jsonc` | `package.json` scripts, the workflow, README and docs only reference `wrangler.toml`; it alone defines `main`, the `ASSETS` binding, the `www.tinaneureka.com` route and worker `eurekacore-v3`. `wrangler.jsonc` (`eurekacore`, assets only) is referenced nowhere. | `wrangler.toml` is authoritative for this repo; scripts pin `--config`. `wrangler.jsonc` is **kept**: Git history is flat, so it cannot be proven that no dashboard/Git integration deploys the Worker named `eurekacore`. **Owner decision:** confirm the live Worker name in the Cloudflare dashboard, then delete the unused config. |
| `index (5).html` | Unreferenced; 816-line single-file earlier version of the TINAN AI landing page (not identical to `index.html` or `eureka-legacy.html`). | Kept as a user backup; safe to delete once owner confirms. `index.html` is the Vite entry. |
| Root vs `public/` `script.js`, `styles.css` | `eureka-legacy.html` links `styles.css` (Vite bundles the **root** file into JS) and `<script src="script.js">` (a classic script Vite cannot bundle, so the built page loads **`public/script.js`** at `/script.js`). The two scripts differ: root renders text network marks, `public/` renders icon `<img>`s. | **Not deduplicated.** Deleting either breaks the legacy page (verified: removing `public/script.js` leaves a dead `/script.js` tag). The legacy page currently pairs the `public/` script with the root stylesheet, which may mis-style network icons. **Owner decision / browser test needed:** align the pair (e.g. serve both from `public/`, or make the root script a module). |
| `eureka-legacy.html` | Second Vite input (`vite.config.ts`), linked from `AppShell.tsx`, README and docs. | Required; unchanged. |
| `EurekaTinanCore.git (1).zip` | Contains an old `EurekaCore-main` static site (index, styles, script, LICENSE), a `.git` dir, Python site-packages and `EurekaCoreAI` dist-info. | Kept as backup. Nothing unique to port was identified in the static-site files. |

## Removed so far
- `pillow-12.3.0-…whl` – Python wheel unrelated to the JS app; unreferenced.
- `direct_url.json` – pip metadata with a local iOS path; unreferenced.

## Core modules (all integrated through `src/core/index.ts` and `src/sdk/index.ts`)
See `docs/CORE_ARCHITECTURE.md`.
