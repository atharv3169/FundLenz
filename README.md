# FundLenz

FundLenz is a free educational portfolio lab and source-based fund, stock and bond catalogue created by Atharva Sahu. It does not provide investment advice or recommend investments.

**Production is https://fundlenz.com on Cloudflare Workers.** GitHub contains the standalone application and reviewed data; scheduled Gemini-assisted checks and protected automatic financial publication are active for supported sources. WWW redirects to the apex while preserving paths and query strings. See [current operations and final audit](docs/maintenance/final-audit-2026-10-13.md) and [migration history](docs/migration/STATUS.md).

## Included catalogue

| Dataset | Retained coverage | Location |
|---|---|---|
| Indian funds | 3,387 grouped records; 14,409 plan/option codes at this release | `public/data/catalog.json` |
| Indian holdings | 1,445 portfolios; 83,133 positions; 33 fund houses | `public/data/holdings/` |
| International funds | 28,280 directory records, including 6,891 Irish registry entries | `public/data/global/` |
| International analysis | 744 selectable portfolios: 706 Irish issuer classes and 38 US ETFs | `public/data/global/holdings/` |
| Stocks, bonds and other securities | 31,664 reference records | `public/data/securities/` |
| US example | IVV, IWB and IWF; illustrative investment amounts | `public/data/us-example.json` |

These counts describe different, partly overlapping kinds of records; they are not a count of unique active investments. Indian holdings include 1,218 September 2026 statements and 227 retained August statements. The Irish register is dated 16 October 2026; issuer portfolio and NAV dates vary by record. The US example remains dated 2 October 2026 and the SEC series registry June 2026. The preparation date is not a new financial-data date. See [expansion coverage, sources and limitations](docs/catalogue-expansion-2026-10.md).

Source records, hashes and ingestion scripts are in `data/sources/` and `scripts/data/`. The expansion retains 85 official Indian source files in seven ZIP bundles, all 706 accepted Irish CSVs and the CBI register PDF for offline replay. Older AMC workbooks that were never bundled remain referenced by URL/checksum. Detailed original coverage and methodology remain in [the original Site README](docs/migration/original-site-readme.md).

## Website structure

- `/`: the existing portfolio lab and US example.
- `/catalogue-global`: default international catalogue.
- `/catalogue-india`: Indian catalogue and available holdings.
- `/catalogue-securities`: stocks, bonds and other reference securities.
- Existing legacy redirects, mobile layout, downloadable template, CSV import/export, saved sessions, exposure/overlap analysis and deterministic scenarios remain included.

UI code is in `app/` and `components/`, financial calculations in `lib/finance.ts`, and catalogue records in `public/data/`. Catalogue labels read verified update metadata from `public/data/site-metadata.json`; a source-check date, an individual snapshot date and a financial publication date have different meanings. The subsequent version 10 feature adds international portfolio selection without changing the financial formulas or theme. See [international analysis coverage and methods](docs/global-portfolio-lab.md).

## Agreed automation design

Read [the full operating specification](automation/OPERATING-SPEC.md).

1. Trusted adapters acquire approved authoritative sources; Gemini examines supplied evidence for due catalogue checks.
2. A separate Gemini task independently investigates persistent flagged items. A validator warning is not assumed to be true.
3. Trusted code reconciles candidates, verifies evidence and keeps complete last-verified units when an update fails. Newer verified snapshots take priority.
4. Only sanitized, validated data changes can enter automatic merge/deployment. Gemini cannot edit the application, rules or publishing configuration.
5. Latest reports and the persistent issue queue keep failures visible. Human review is optional and not a subscription-dependent gate.

The scheduled runner, two Gemini tasks, source-backed NAV and complete-portfolio validators, persistent issue state, protected publisher and deployment observer are implemented. Financial adapters cover existing AMFI NAVs, conservatively admitted new AMFI identities, 38 daily US iShares endpoints and 706 weekly Irish iShares endpoints. Monthly Indian workbook imports and CBI register refreshes still require reviewed imports; other sources are monitoring-only. Protected main and a dedicated publishing identity are configured. External scheduler runs on 23 and 24 October 2026 successfully completed the publication path. See [the expansion operating details](docs/catalogue-expansion-2026-10.md) and [the operating guide](docs/migration/AUTOMATION.md).

## Local checks

Use the versions declared in `package.json`: Node 22.13.0 or later and pnpm 11.25.0. Install the locked dependencies with that package manager:

```sh
pnpm install --frozen-lockfile
python3 -m pip install -r scripts/automation/requirements.txt
python3 -m pip install -r scripts/data/requirements.txt
python3 scripts/data/verify_expansion_sources.py
python3 -m unittest discover -s scripts/automation/tests -v
python3 scripts/automation/verify-bootstrap.py
node scripts/automation/verify-contracts.mjs
pnpm verify
pnpm typecheck
```

The integrity check verifies the reviewed standalone repository snapshot in `automation/baseline-manifest.json`. Earlier import and release manifests remain available in Git history. Approved evolving data paths are separately protected by deterministic source replay and the exact-commit PR data gate. Immutable application files and unrelated catalogue releases retain their baseline checks.

## Hosting and repository status

The GitHub copy now has a standalone Cloudflare Workers build using the existing pinned Vinext and Wrangler versions. See [Cloudflare setup](docs/migration/CLOUDFLARE.md) for the exact dashboard commands. The production build, deployment dry runs, type check and existing regression suites pass. Cloudflare deployment succeeded and the owner confirmed the live feature checks. The apex custom domain was migrated on 12 October 2026. The original Site and exported DNS records are retained for recovery; they are not the active production source.

The repository is `atharv3169/FundLenz`, now public. It contains the original import, the international-analysis update, the production blog/editor and the reviewed automation. Financial updates require the exact-head FundLenz data gate and protected merge checks.

There are no API keys in the package. Supply future credentials through the appropriate secret settings, never through public files or Gemini prompts. No open-source licence has been selected; third-party source material retains its applicable terms.

## Author and contact

Atharva Sahu · info@fundlenz.com
