# FundLenz

A source-based Indian and international fund catalogue, with US ETF and Indian mutual-fund portfolio analysis, for Atharva Sahu's finance project.

## Current data release

The Indian catalogue contains every record in the refreshed AMFI NAV feed: **14,354 plan/option codes**, grouped into **3,372 fund-name records** across **55 fund houses**. The latest NAV date within this snapshot is **5 October 2026**. Older records remain visible with their actual dates. The 5 October refresh removed 12 plan codes and changed 3 NAV/date observations compared with the preceding release. These counts are not a registry of currently active or investible products.

The holdings release contains **803 matched portfolios**, **49,022 classified positions**, and **21 fund houses**, for the **August 2026** reporting month. SBI, Mirae Asset and UTI add 281 portfolios to the previous 522. The displayed month-end is 31 August 2026. Where a source specifies only the month, its provenance note states that the month-end date represents the reporting month. This is a versioned snapshot; no automatic daily refresh is currently configured.

NAV coverage and holdings coverage are separate. Indian funds without accepted holdings remain searchable, with plan codes, NAVs, ISINs, dates, categories and official document links. They cannot be selected for holdings analysis. Historical returns, Indian expense ratios, exit loads, managers, riskometer labels and derivative delta exposure have not been extracted. They are not estimated or inferred.

### International catalogue

`/catalogue-global` has **21,389 catalogue records**: **18,653 US registered series**, **1,239 unmatched US exchange listings**, and **1,497 issuer share-class records**. The registered series contain **39,138 classes**. Nasdaq confirms **5,755 ETF-flagged, non-test listings**, of which 4,516 are joined to registered series. These are overlapping counts, not a count of distinct active underlying portfolios.

The issuer records comprise **1,417 iShares UK-directory share classes** and **80 Vanguard Australia products**: 943 ETFs, 547 mutual-fund classes, 6 ETCs and 1 ETP. They include equity, fixed income, cash, multi-asset, real-estate, commodity and digital-asset source categories. iShares supplies 1,417 dated NAVs. Annual-fee fields are present for 1,495 issuer records and retain their specific labels (TER, ongoing charges or investment management costs). Currency-ambiguous and undated AUM figures are omitted.

The SEC registry is dated 1 June 2026, ticker mappings 5 October 2026 (HTTP Last-Modified, not per-record effective dates), and Nasdaq listing files 5 October 2026. Issuer values have their own dates. Registry records may include dormant or not-yet-launched products. The SEC data excludes insurance separate accounts; this is not comprehensive coverage of closed-end funds, private funds or worldwide products. The UK issuer directory also includes some non-UCITS exchange-traded products.

Only contemporary exact SEC ClassID/ticker joins connect US listings to series. Older registry tickers are preserved as historical observations in details. This prevents recycled symbols such as LEND from merging unrelated funds. Registrants are never presented as verified managers. Source-market labels identify a directory, not domicile, exposure or investor eligibility. Fund-name themes are explicit text filters; issuer asset/product types come from source fields.

International records support discovery, class inspection, official-document links and CSV export. The homepage now opens IVV, IWB and IWF in USD, using verified 2 October 2026 holdings; other international records remain catalogue-only. There is no cross-currency aggregation, live price feed or inferred performance. The index and 256 detail buckets load as static assets; details load only when opened.

## Using the site

- `/catalogue-india`: search fund names, AMCs, AMFI codes or ISINs; filter by category, plan, option, NAV date and holdings coverage; inspect every plan and the complete disclosed portfolio; export holdings with source percentages, market values, original labels, row numbers and checksum.
- `/catalogue-global`: search international names, current mapped tickers and ISINs; filter by source market, listing/registry/issuer records, name themes, or issuer-supplied categories; inspect classes, fees, dated NAVs and source records; export the filtered directory.
- Select up to 20 portfolios with available holdings, then open the portfolio lab and enter **current holding values**. Combine the values of plans sharing the same underlying portfolio.
- `/`: look-through stock and industry exposures, equity concentration, overlap, partial price-shock scenarios, constrained allocation comparison, reports and saved sessions. The initial three-fund example uses real disclosures and clearly labelled illustrative amounts.
- `/?demo=1`: the original fictional reference example remains available for hand verification.

Source data is served as static, versioned assets. Fund holdings are loaded individually rather than downloading every portfolio when the site opens. User amounts remain in browser memory. JSON session exports preserve official source identities and checksums; restoration rejects a different source snapshot. Imported CSV sessions remain explicitly unverified.

## Data provenance and ingestion

Primary sources:

- AMFI NAV feed: https://portal.amfiindia.com/spages/NAVAll.txt
- AMFI fund-house disclosure directory: https://www.amfiindia.com/online-center/portfolio-disclosure
- Individual AMC workbooks listed in `data/sources/portfolio-sources.json`.

The exact NAV text and directory records are retained in `data/sources`. Monthly workbooks are referenced by their original URL and SHA-256 rather than redistributed as originals. The source manifest, sheet audit, explicitly reviewed abbreviation aliases and unmatched titles are retained alongside the processed output. `public/data/coverage.json` exposes a compact source and coverage ledger.

The extraction pipeline:

1. Parse all eight columns of the official NAV feed and retain every unique AMFI code, including older dates and missing values.
2. Group only by fund house and normalized reported scheme name. Match AMC directory records; do not conflate plans' NAVs.
3. Discover public, dated portfolio files from official AMC pages. A filename alone does not establish the snapshot date.
4. Require explicit instrument, ISIN, weight and market-value columns, disclosed units, a supported date, positive reported net assets and leaf-row reconciliation within **0.10 percentage points** of net assets. Preserve any residual difference; do not rescale it away.
5. Match a unique normalized fund title within the same AMC, or an explicit reviewed alias. Ambiguous and unmatched statements are excluded from analytical coverage.
6. Use disclosed market values divided by net assets for analytical weights, while retaining original published percentage weights. Preserve signed net balances. Indian mutual-fund unit ISINs are not treated as individual stocks. Fund-of-fund units are not recursively looked through.
7. Harmonize equity names and industry labels by exact ISIN, retaining original source labels. No fuzzy security matching is performed.

Rebuild the retained release using Python with pandas, openpyxl and xlrd already available:

```sh
python scripts/data/restore_sources.py /absolute/path/to/source-cache
python scripts/data/build_catalog.py data/sources/navall.txt data/sources/amc-directory.json
python scripts/data/parse_portfolios.py /absolute/path/to/source-cache
python scripts/data/finalize_catalog.py
```

Source restoration accepts only the recorded checksum. A changed or unavailable remote file is reported instead of silently substituted. A complete rebuild requires all the original source files; the audit records reduced coverage when files cannot be restored. For new reporting periods, update and validate the date rules, discovery and scheme mappings deliberately before publishing a new release.

UTI's consolidated workbook is split only at explicit scheme-start markers. Each block requires its stated date, scheme title, market-value units and scheme-specific total. Calculated weights must agree with available source percentages within 0.02 percentage points, and the usual whole-portfolio reconciliation still applies. Exported row numbers retain their offsets in the original worksheet.

Global source files are retained in `data/sources/global`. Rebuild them without network requests:

```sh
python scripts/data/normalize_us_funds.py --input-dir data/sources/global/us --output-dir /absolute/path/to/us-normalized-cache
python scripts/data/normalize_issuer.py data/sources/global/issuer
python scripts/data/build_global_catalog.py --us /absolute/path/to/us-normalized-cache/us-funds-normalized.json --issuer data/sources/global/issuer/issuer-records.json --manifest data/sources/global/issuer/issuer-manifest.json
```

Normalizers check retained raw-file SHA-256 values. The global builder rejects duplicate issuer identities and requires explicit dates and currencies for reported NAV and AUM. Source snapshots remain separate from normalized UI records. Refreshing the sources requires a newly reviewed manifest and coverage expectations in the validation script.

## Calculations and scope

With current fund values V_i and total V, allocation a_i = V_i/V. A stock's exposure is e_j = sum_i a_i h_ij, where h_ij is its percentage-of-fund-NAV holding expressed as a fraction. Equity exposure E = sum_j e_j. Equity HHI = sum_j (e_j/E)^2; effective holdings = 1/HHI. Cash and other assets are excluded from equity concentration.

For overlap, normalize each fund's disclosed equities separately, then sum the smaller weight in each shared ISIN. It is a holdings measure, not return correlation.

Scenarios apply one price shock per stock: stock override, then industry override, then broad equity shock. Cash is assumed unchanged. **All official-data scenarios are partial equity impacts**, since debt, derivatives, currency effects, other assets and portfolio changes are not modeled. Positive and negative unmodeled balances cannot cancel this partial flag. The interface does not present these results as whole-fund returns.

Allocation search uses deterministic pair and three-fund directions within the same category. It preserves total value, category weights and equity exposure while respecting long-only allocations and the turnover cap. Step sizes are 4, 1 and 0.25 percentage points in maximum per-fund change, with at most 150 improvement rounds per step. It accepts HHI improvements and retains the baseline. This restricted local search does not establish a global optimum, and other-asset exposure can change.

The project does not forecast returns, estimate realized liquidation costs, create a composite risk score or recommend investments.

## Validation

```sh
node --experimental-strip-types scripts/verify-finance.mjs
node --experimental-strip-types scripts/verify-catalog.mjs
node --experimental-strip-types scripts/verify-global.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The reference suite checks hand-calculated exposures, HHI, overlap, shock precedence, allocation invariants, import validation and input bounds. The catalogue suite checks every retained plan code and holding, unique identities, source metadata, weight denominators, reconciliation, asset classifications, coverage counts and real-data allocation invariants. These checks establish internal consistency; they do not replace an audit of every original document.

The global suite checks source checksums, exact identities, all listing/class counts, currency/date requirements, familiar fund identities, historical ticker reuse, record filtering and lazy-loaded detail access. No international directory record can enter the verified Indian holdings path.

The fictional A/B reference uses A ₹40,000 and B ₹60,000, producing X 6.8%, Y 31.2%, Z 16%, W 36%, cash 10%, equity HHI 0.3174913580 and A–B overlap 33.3333333333%. A −20% Sector 1 shock gives −7.60%; an X-only −50% override changes that to −9.64%.

Browser UI testing was unavailable in the current managed environment. Type checking, source-data validation, server rendering and the production build are the available verification paths.

## Architecture

React, TypeScript, Vinext/Vite, Shadcn/Radix and Recharts. Catalogue access is in `lib/catalog.ts` and `lib/global-catalog.ts`, calculations in `lib/finance.ts`, CSV handling in `lib/import.ts`, and reproducible ingestion in `scripts/data`. The source repository is the authority for the published read-only snapshot. No database, paid data feed, generative-AI API or financial-account connection is needed.

Historical hosting configuration has been retired. Use `wrangler.jsonc` and the Cloudflare setup guide for current deployment instructions; retain the pinned package manager.

## October 5 revision

Branding is FundLenz, credited to Atharva Sahu; the logo graphic and theme are retained. `/catalogue` opens `/catalogue-global`. Old `/global` and `/funds` links redirect, preserving query parameters. `/catalogue-india` retains the Indian selection workflow.

The left input panel now includes a downloadable, explicitly fictional CSV template. New CSV exports include USD/INR currency; legacy CSVs without currency use INR. Mixed currencies are rejected. Official sessions use version 3 with currency, source hash/date and the example-amount label; version 1 and version 2 sessions remain supported.

`/catalogue-securities` contains 31,664 reference records: 24,167 bonds, 5,072 stocks, 320 ADRs and separately classified preferred shares, trust shares, warrants, units, rights, listed debt/funds and other listings. Stocks use the October 5 Nasdaq directories. Bonds use October 2 AGG/LQD/HYG/EMB/IAGG disclosures, cover 97 source locations (including supranationals), and are deduplicated by valid ISIN/CUSIP. They are reference records, not live quotes or selectable direct-security portfolios. Coupon is not yield; country/currency are not guessed.

Securities inputs, normalizer, exclusions and checksums are retained in `data/sources/securities`; the public validation ledger is `/data/securities/audit.json`. Run `python data/sources/securities/normalize.py` to reproduce the source package. US examples similarly retain their raw CSVs and normalizer under `data/sources/us-example`.

`/data/freshness.json` records seven core source checks and 21 Indian disclosure-page checks. AMFI, Nasdaq, SEC tickers and iShares changed; Vanguard values and SEC annual series/classes did not. Indian holdings remain August 31: no complete September monthly replacement was verified in these page checks, and four dynamic pages were inconclusive. This is not a live feed. See `/data/quality-review.md` for the scope and limits of verification.
