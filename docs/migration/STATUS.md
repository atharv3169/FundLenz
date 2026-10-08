# FundLenz migration status

## Current status — 8 October 2026

Automatic publication is enabled on protected `main`. Run [37731471235](https://github.com/atharv3169/FundLenz/actions/runs/37731471235) completed acquisition and both bounded Gemini tasks. Independent source replay and finance/catalogue regression checks passed; [data PR #7](https://github.com/atharv3169/FundLenz/pull/7) merged automatically as `0680837876d2c3fe8899e2c1bf7684bcd8798eb8`.

The run reported PARTIAL coverage: 8,582 accepted units, 5,486 unchanged, 192 blocked and 133 retained unsupported; 285 issues remain tracked. Supported refreshes cover existing AMFI NAV tuples and 38 complete iShares portfolios. Other directories, Indian holdings and securities reference records remain monitoring-only. Invalid or unsupported updates retain earlier values.

Deployment confirmation is tracked separately in [run 37731794240](https://github.com/atharv3169/FundLenz/actions/runs/37731794240): require a successful Cloudflare build and the exact live release marker. The pre-merge audit's completion flags describe its creation time, not subsequent deployment status. A real hosting rollback trial remains outstanding because Cloudflare dashboard sign-in is unavailable in this session. The custom domain has not been moved.

Daily scheduling is 03:47 UTC (09:17 India), subject to GitHub scheduling delays. The repository is public; the dedicated publisher credential and required main-branch checks are configured. Forty automation tests pass. The interface and financial formulas are unchanged by this activation.

## Historical preparation notes

The dated notes below describe earlier stages; this current-status section supersedes their statements that hosting, Gemini calls or publication are inactive.

# Migration status — 6 October 2026

## Prepared

- Source copied from the existing FundLenz Site, version 9, commit `0889a225ee1f8c5131635b8f6fba6dea8a3f743e`.
- All existing catalogue and retained source-data files copied without altering their values or dates.
- Master operating agreement, two Gemini task prompts, candidate and bootstrap-audit contracts, source inventory and persistent issue queue added.
- Four inconclusive source-page checks imported from the existing freshness ledger. These are source-discovery warnings, not assertions of incorrect holdings.
- Two hard-coded source-check labels now read the same date from `public/data/site-metadata.json`; current displayed wording remains **5 October 2026**. Theme, layout, financial calculations and catalogue records are unchanged.
- The previous hosting bindings and unused authentication/connector code have been removed from the Cloudflare repository.
- Original README retained as `docs/migration/original-site-readme.md`. Bootstrap integrity checker distinguishes the deliberate metadata extraction from unchanged original bytes.

## GitHub repository

The private repository `atharv3169/FundLenz` was created on 6 October 2026. Repository integration access is restricted to the selected FundLenz repository. This source commit contains the prepared code, data and automation specification.

## Not completed

No Gemini API has been called; no automatic catalogue scan, production validator, scheduler, auto-merge, external hosting or DNS migration is active. Existing source values were not freshly re-downloaded during this preparation. The requested international-analysis feature was subsequently published to the existing Site as version 10; external hosting and automation remain inactive.

## Important design work for the next stage

Indian and CSV-import workflows retain their existing date rules. The international feature supports explicitly disclosed comparisons of dated issuer snapshots in USD: the lab and report show a date range when disclosures differ. Never present those comparisons as a simultaneous historical portfolio or mix input currencies.

Several current test expectations and ingestion scripts are release-specific. Preserve them as evidence of this release, and add adapter-specific evolving-data validation before enabling updates. Automatic merging must not rely on a test suite that either rejects every valid new date or has had those checks casually removed.

The GitHub export is now configured for Cloudflare Workers using the existing pinned Vinext build. Build, deploy/preview dry runs, TypeScript and all six existing regression suites pass. All 1,114 public assets match the source byte for byte. A local Wrangler runtime check was blocked by this execution environment (`uv_interface_addresses`); live browser and runtime validation must occur on the first workers.dev deployment before moving the domain. See [Cloudflare setup](CLOUDFLARE.md).

The existing dependency audit is retained in `docs/quality-audit-2026-10-06.md`; this transfer does not claim that every upstream advisory is resolved.

## International portfolio feature — Site version 10

Published source: `fda0ed5f341c80f8c0afb9557f073f6a3e481dee`. The global catalogue now has selection checkboxes, an available-holdings filter, issuer holdings detail and a link into the portfolio lab. Coverage is 38 verified iShares ETFs and 17,126 positions. The original Indian catalogue and homepage example are retained.

All six verification suites passed (620,894 counted assertions plus additional identity and exception checks), as did TypeScript checking and the production build. Browser preview infrastructure was unavailable. The original version 9 baseline is retained, with exact authorized changes recorded in the manual-release manifest. `audit/latest.json` remains a historical bootstrap report, not a new daily scan. See `docs/global-portfolio-lab.md` for source dates and modeling limits.

## Standalone repository cleanup — 7 October 2026

Cloudflare deployment succeeded and the owner confirmed the catalogue, portfolio, download/session and mobile checks. The custom domain remains on the previous host until API integration and further tests are complete. Unused hosting adapters, sign-in helpers and connector code have been removed; developer documentation now describes the standalone project. The current integrity manifest is rebased to the reviewed repository snapshot, retaining the unchanged financial dataset digest. Previous manifests remain recoverable in Git history. Gemini scheduling and data publication are still inactive.


## Catalogue automation — 8 October 2026

The daily dry-run workflow is active at 03:47 UTC / 09:17 India time. Two bounded
Gemini tasks, trusted source adapters, independent validation, persistent issue
state and audit artifacts are implemented. Live run 37672720902 completed with
both model tasks validated and a PARTIAL coverage report. The latest connected
Cloudflare build succeeded; the existing financial catalogue and interface are
unchanged.

Supported financial refreshes currently cover existing AMFI NAV tuples and 38
complete iShares portfolios. Other catalogue sources are monitored, not
automatically re-extracted. Automatic publication remains off pending protected
main, a dedicated publisher credential and a real merge/deployment/rollback
trial. See [the operating guide](AUTOMATION.md) for exact scope and owner setup.
