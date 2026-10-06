# Migration status — 6 October 2026

## Prepared

- Source copied from the existing FundLenz Site, version 9, commit `0889a225ee1f8c5131635b8f6fba6dea8a3f743e`.
- All existing catalogue and retained source-data files copied without altering their values or dates.
- Master operating agreement, two Gemini task prompts, candidate and bootstrap-audit contracts, source inventory and persistent issue queue added.
- Four inconclusive source-page checks imported from the existing freshness ledger. These are source-discovery warnings, not assertions of incorrect holdings.
- Two hard-coded source-check labels now read the same date from `public/data/site-metadata.json`; current displayed wording remains **5 October 2026**. Theme, layout, financial calculations and catalogue records are unchanged.
- Existing live Site binding removed only from the separate export's `.openai/hosting.json`. Null D1/R2 configuration remains so the existing build imports are valid.
- Original README retained as `docs/migration/original-site-readme.md`. Bootstrap integrity checker distinguishes the deliberate metadata extraction from unchanged original bytes.

## GitHub repository

The private repository `atharv3169/FundLenz` was created on 6 October 2026. Repository access is restricted to the selected FundLenz repository for the ChatGPT Codex Connector. This source commit contains the prepared code, data and automation specification.

## Not completed

No Gemini API has been called; no automatic catalogue scan, production validator, scheduler, auto-merge, external hosting or DNS migration is active. Existing source values were not freshly re-downloaded during this preparation. The existing public FundLenz Site has not been changed.

## Important design work for the next stage

The application already enforces a common holdings snapshot/currency for selected analysis. Keep that behavior. Partial updates may leave different funds on different months in the catalogue, but must not permit mixed-period calculations or falsify aggregate dates.

Several current test expectations and ingestion scripts are release-specific. Preserve them as evidence of this release, and add adapter-specific evolving-data validation before enabling updates. Automatic merging must not rely on a test suite that either rejects every valid new date or has had those checks casually removed.

The existing Vinext/Sites build is preserved in the export. A GitHub upload by itself does not port that build to Cloudflare Pages. Port and test the hosting adapter separately before connecting the live domain.

The existing dependency audit is retained in `docs/quality-audit-2026-10-06.md`; this transfer does not claim that every upstream advisory is resolved.
