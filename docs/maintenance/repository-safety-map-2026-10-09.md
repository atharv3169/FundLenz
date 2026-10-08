# FundLenz repository safety map — 9 October 2026

**Status: first-pass maintenance audit, not approval for file deletion.**
Starting main commit: `143a8a1f305674ecc8349a756b870ff5f3240f54`.

## Preservation boundaries

- **Protected financial data:** `public/data/` is the website's published read-only catalogue; `data/sources/` contains reproducible source evidence. Never delete either side of a source/output pair merely because their current bytes are equal.
- **Automation provenance:** `audit/`, `public/automation-audit/`, `automation/baseline-manifest.json`, and `automation/source-registry.json` are part of the validation, reconciliation, or release history. These are not disposable log files.
- **Portfolio calculations:** `lib/finance.ts`, `lib/import.ts`, `lib/session.ts`, `lib/portfolios.ts` and the existing catalogue adapters must remain behaviorally stable.
- **Private editorial state:** Cloudflare D1 administrator sessions and drafts, Worker secrets and private Google Drive submissions are external to the GitHub tree; a GitHub cleanup must never reset or migrate them incidentally.
- **Deployment isolation:** `wrangler.jsonc` targets the production lab Worker; `wrangler.blog-staging.jsonc` and `scripts/build-blog-staging.mjs` target isolated blog staging. Do not merge staging configuration into the production Worker definition.

## Connections and ownership of each subsystem

| Entry point / component | Main dependencies | Storage / output |
| --- | --- | --- |
| `app/page.tsx` + `components/fundlens.tsx` | `lib/finance.ts`, `lib/import.ts`, `lib/session.ts`, portfolio loaders | Browser session and published `public/data/` |
| `app/catalogue-*/`, `app/catalogue-securities/` | Catalogue components and `lib/catalog.ts`, `lib/global-catalog.ts`, `lib/securities.ts` | Indexed and lazily loaded files under `public/data/` |
| `app/blogpost/page.tsx` | `components/blog/blog-article-archive.tsx`, blog chrome, `lib/blog-publications.ts` | Reviewed, source-controlled **public** articles only |
| `app/blogpost/[slug]/page.tsx` | `lib/blog-publications.ts`, `components/blog/blog-paper.tsx` | Public article render; no private D1 read |
| `app/blogpost/admin/` and `app/api/blog/admin/` | Editor/dashboard, `lib/blog-editor-auth.ts`, `lib/blog-admin-*`, `lib/blog-rich-*` | Staging-only D1 drafts and sessions |
| `lib/blog-staging-homepage.ts` | Homepage draft validation and the staging host restriction | Read-only staging homepage preview from D1 |
| `app/api/blog/subscribe/`, `app/api/blog/contribute/` | `lib/blog-private-form-security.ts`, `lib/blog-private-drive.ts`, Turnstile/OAuth runtime secrets | Intended private Google Drive records; live end-to-end verification still required |
| `.github/workflows/catalogue-daily.yml` | `scripts/automation/acquire.py`, `model_tasks.py`, `validate.py`, `publish.py` | Source evidence and protected data-only publication |
| `.github/workflows/catalogue-data-gate.yml` | `scripts/automation/pr_gate.py`, `merge.py`, reviewed release checks | Independent exact-commit acceptance before any automatic catalogue merge |

The public article publication list is currently empty; the private blog editor is not a production article publisher.

## Current inventory findings

A recursive GitHub tree inventory of this commit reports **1,472 tracked files** and about **158 MB** of file contents (excluding Git history). It reports **nine groups** of byte-identical blobs:

1. `app/catalogue/page.tsx` and `app/global/page.tsx` (possibly deliberate route aliases).
2. `data/sources/freshness.json` and `public/data/freshness.json`.
3. `data/sources/global/coverage.json` and `public/data/global/coverage.json`.
4. `data/sources/global/holdings/AGG.csv` and `data/sources/securities/raw/AGG-holdings.csv`.
5. `data/sources/global/holdings/IWB.csv` and `data/sources/us-example/IWB-holdings.csv`.
6. `data/sources/global/us/nasdaqlisted.txt` and `data/sources/securities/raw/nasdaqlisted.txt`.
7. `data/sources/global/us/otherlisted.txt` and `data/sources/securities/raw/otherlisted.txt`.
8. `data/sources/securities/audit.json` and `public/data/securities/audit.json`.
9. `data/sources/us-example/us-example-data.json` and `public/data/us-example.json`.

**Do not delete these** without tracing independent consumers, provenance and checksum assumptions. Identical current content does not imply redundant roles.

Low-risk cleanup *candidates for later investigation only*: `examples/d1/` tutorial files, starter SVG assets `public/file.svg`, `public/globe.svg`, `public/window.svg`, and unused `components/ui/` primitives. These are **not confirmed unreferenced**. A source import search, build/reference tests, and a size/performance comparison are required before removal. CSS consolidation should be treated as a separate appearance-sensitive change, not bundled with data maintenance.

## Reliability issues discovered

The 8 October 2026 scheduled catalogue run (GitHub Actions `37766860766`) failed six adversarial tests before normal acquisition. Its tests coupled fictional date mutations to a real, moving published NAV baseline, assumed a specific older issuer CSV date, and required every unresolved real audit issue to fit a fixed 64-source test budget. The publisher's subsequent missing release file was a **downstream effect**, not evidence of an unsafe data merge.

Maintenance branch `maintenance/reliability-audit-20261009` separates fictional test expectations from evolving production records and adds pull-request automation regression coverage. This must pass in GitHub before any merge.

A previous deployment-observer run (`37731794240`) also reported HTTP 403 while attempting live deployment verification. A successful build is not a substitute for confirming the exact live dataset on the domain. Keep this on the integration checklist.

## Safe cleanup process

1. Confirm clean protected `main`, a recoverable commit, and green finance/data checks.
2. Measure the current file inventory and document each candidate's imports, URLs, generated build usage, and test/automation references.
3. Change one low-risk file family on a maintenance branch; **never** bulk-delete by name, size, similarity or age.
4. Run Python adversarial/automation tests, six portfolio/catalogue suites, source provenance checks, scoped blog tests, TypeScript, lint, and isolated production/staging build validation.
5. Compare generated data hashes, catalogues, stable fund/security IDs, app routing and responsive appearance against the baseline.
6. Require review and safe rollback before merging, then verify the exact Cloudflare deployment and public routes.
7. Leave private D1 records, Drive files and secrets untouched. Database migrations require their own backup and review.

**Stage 1 does not modify or remove financial data, production code, live deployments, credentials, or D1 rows.**
