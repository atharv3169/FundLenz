# Cloudflare Workers setup

This configuration serves the same application and snapshots through Cloudflare Workers. No UI, financial calculations or catalogue records were changed. The existing Site stays live until a separate domain migration.

## Import this repository

Choose `atharv3169/FundLenz`, branch `main`, with these settings:

| Field | Value |
|---|---|
| Project / Worker name | `fundlenz` |
| Build command | `pnpm run build` |
| Deploy command | `pnpm run deploy` |
| Preview / non-production deploy command | `pnpm run deploy:preview` |
| Root / path | `/` |
| Preview builds | Enabled |
| Cloudflare Access protection | Disabled for a public preview |

Use the Cloudflare-generated build API token. No Gemini key or application environment variable is needed for hosting. Locked dependencies are in `pnpm-lock.yaml`; use pnpm 11.25.0 and Node >=22.13.0. Do not replace the project with a different framework template or change the dependency versions during import.

`pnpm run build` generates `dist/server/wrangler.json` and static assets in `dist/client`. Both deployment scripts explicitly use that generated configuration. Do not deploy the raw TypeScript entry point without building. Preview uploads use `wrangler versions upload`, not `wrangler preview`.

Click Deploy and wait for Cloudflare's build and deployment result. Open the workers.dev URL Cloudflare supplies. Do not change fundlenz.com DNS until the following checks pass:

1. Homepage and all three catalogue routes load; logos, fonts, charts and data load without errors.
2. Select an available Indian fund and analyze it.
3. Select available international ETFs and analyze them; confirm USD and holdings dates.
4. Download/import the template, save/load a session, and check mobile layout.
5. Check browser console/network failures and Cloudflare logs.

Saved browser sessions are origin-specific. Existing sessions on fundlenz.com do not automatically appear on workers.dev. After moving the same domain, its existing browser storage remains associated with that domain.

## Validation completed before upload

- Production build and TypeScript check passed.
- Six existing suites passed: 620,894 counted assertions plus additional checks.
- Deploy and preview-upload dry runs passed; Worker gzip size about 416 KiB.
- All 1,114 public source files were copied byte-for-byte; 1,160 total built assets.
- The reviewed standalone snapshot is enforced by the current integrity manifest; historical snapshots remain in Git history.
- The local Wrangler server could not start in the restricted execution environment (`uv_interface_addresses`). Cloudflare deployment subsequently succeeded; the owner confirmed the live catalogue, analysis, download/session and mobile checks.

## Later steps

After preview validation, connect the custom domain and verify HTTPS and redirects. Keep the previous deployment available for rollback. Gemini scheduling and controlled data publication are separate, unfinished work; this deployment does not activate daily updates. Store future Gemini credentials in the updater's secret store, not in public application files.
