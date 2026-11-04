# Cleanup changelog

## 2026-11-04 — repository audit

| File or area | Action | Reason |
|---|---|---|
| `src/server/api.ts` | Updated | Reject `Content-Length` values over 16 KB before buffering; stream and count actual body bytes, canceling over-limit reads. This closes the unbounded buffering and character-versus-byte gap for protected JSON writes. |
| `tests/worker.integration.test.mjs` | Updated | Added a regression test proving that a JSON body over 16 KB in UTF-8 bytes is rejected. |
| `docs/REPOSITORY_AUDIT.md` | Added | Records the source-tree inventory, architecture, findings, and blockers for the audited `main` snapshot. |
| `docs/ARCHITECTURE.md` | Added | Documents implemented module responsibilities and production boundaries. |
| `docs/PRODUCTION_DEPLOYMENT.md` | Added | Records the verified workflow and safe owner steps for the remaining Cloudflare setup. |
| `docs/SECURITY_AUDIT.md` | Added | Records code-level controls, findings, and unverified live settings. |
| `docs/PRODUCTION_READINESS.md` | Added | Summarizes evidence-based release status and remaining prerequisites. |
| Retained legacy/backup files and dependencies | No change | `index (5).html`, `EurekaTinanCore.git (1).zip`, overlapping static assets, and dependencies were not proven safe to delete. No deletions or dependency removals were made. |

No files were moved or consolidated. No migrations, production bindings, secrets, DNS records, databases, or integrations were changed. Historical audit and migration documents remain intact.
