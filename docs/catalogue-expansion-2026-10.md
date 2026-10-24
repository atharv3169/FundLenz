# October 2026 catalogue expansion

This release expands usable official holdings while preserving the last verified snapshot when a new disclosure cannot be reconciled. Registration, a recent NAV and holdings availability are separate facts. None establishes that a class is currently open to every investor.

| Coverage | Before | This release |
| --- | ---: | ---: |
| Indian fund-name groups | 3,372 | 3,387 |
| Indian plans/options | 14,354 | 14,409 |
| Indian portfolios selectable for analysis | 803 | 1,445 |
| Indian houses with verified holdings | 21 | 33 |
| International directory records | 21,389 | 28,280 |
| Irish issuer portfolios selectable for analysis | 0 | 706 |
| All international portfolios selectable for analysis | 38 | 744 |

## India

The official AMFI feed supplies scheme codes, names, plan/option identity, ISINs and dated NAVs. Newly discovered codes are admitted only for an existing reviewed AMC, a checksum-valid and unambiguous ISIN, and a positive finite NAV dated within 14 days of acquisition. Exact existing identities are retained; omissions do not imply closure or justify deletion. The 22 October discovery added 55 plans across 15 new name groups. Previously published groups can contain older or renamed schemes, so the group count is not an active-fund count.

Official September workbooks added 642 portfolios and updated 576 existing ones. There are 1,218 September statements and 227 retained August statements. The importer checks the reporting month, declared units, net assets, instrument identities, classifications and reconciliation within 0.10 percentage points. It matches AMC and normalized scheme name or a reviewed explicit alias; it does not use fuzzy matching. Canonical security labels retain original source labels alongside them. The mixed-date selection warning makes clear that comparisons are not a single-date portfolio.

Sources cover 360 ONE, Abakkus, Aditya Birla Sun Life, Angel One, Axis, Bajaj Finserv, Bank of India, Baroda BNP Paribas, Capitalmind, DSP, Edelweiss, Franklin Templeton, HDFC, Helios, ICICI Prudential, ITI, Kotak, Mirae Asset, Nippon India, NJ, Old Bridge, PPFAS, quant, Quantum, Samco, SBI, Shriram, Tata, The Wealth Company, Trust, Unifi, UTI and Zerodha. Coverage within each house is partial. Complete financial disclosures for the remaining houses or schemes are still needed; an inaccessible page, ambiguous title or unreconciled statement cannot enable analysis.

`data/sources/india-disclosures/` retains 85 distinct original workbook/archive files inside seven ZIP bundles, individual source hashes and URLs, acquisition/discovery metadata, and the import report. A third-party directory was used to locate some links; every imported financial statement came from its recorded official AMC document URL. The complete AMFI discovery bytes and receipt are retained separately. The importer's `--reparse` option permits same-date label reparsing only when the source hash and all financial positions remain identical.

## Ireland

The 16 October Central Bank of Ireland UCITS register contributes 6,891 dated entries: 557 registered entities and 6,334 sub-funds. The PDF separately reports 6,349 funds including sub-funds. These totals describe different populations; the site explicitly shows entities and sub-funds separately, not 6,891 unique active investments. The source PDF, checksum, authorization dates and PDF page locators are retained. Registry rows and issuer share classes may overlap and are not joined by guessed names.

A domicile filter, Ireland quick search and Irish-holdings quick filter make the existing issuer classes and new register entries accessible. Registry entries correctly link to the official register instead of being labeled SEC filings.

The iShares European adapter checked 1,163 Irish product endpoints from the issuer directory. It admitted 706 complete disclosures at an exact reviewed product URL and share-class ISIN; 457 endpoints or files remain excluded. Reasons include no complete CSV, ambiguous identities, unsupported short positions, malformed tables, source errors and weights outside the existing 99.5–100.5% tolerance. No weights were rescaled, incomplete files patched or missing positions invented. Each accepted CSV is retained with its checksum and retrieval time. The 38 US portfolios remain available, including the newer automatic release published on 24 October through PR #60. Existing Indian NAV tuples from that release are also preserved.

European CSVs provide portfolio weights but do not explicitly identify their reporting currency. Unlabeled market values are therefore omitted. USD is the currency for the user's entered holding values, not an inferred currency of the source's market-value column. Equity overlap uses the exact issuer identity tuple or an explicit ISIN. Bonds, derivatives and currency hedges remain in totals but are outside the equity scenario model. Several share classes can disclose closely related portfolios; share-class counts are not unique strategies.

## Refresh and publication

The daily source job continues to check AMFI and the original 38 US issuer endpoints. The 706 reviewed Irish endpoints use a seven-day cadence and rotate by actual attempt time. Daily sources precede the weekly queue. The request cap is 192 sources, 12 MiB per file and 128 MiB per run, with four workers and no source retry. Workflow timeouts accommodate the larger bounded queue. Failed or deferred sources retain their last verified data. Cadence is a target, not a promise that every source succeeds each week.

Gemini still has two bounded review tasks and at most four calls including retries. It cannot invent schemes or holdings, add arbitrary source URLs, change validation rules or write repository code. Deterministic adapters inspect complete supported files; Gemini sees bounded excerpts and sample units. The trusted PR gate independently replays data changes before publication. Data-only updater permissions remain restricted to exact reviewed files.

New Indian identities can now enter through the daily AMFI adapter. Indian monthly workbook discovery and CBI registry refresh still require a reviewed import; source monitoring alone does not extract new monthly holdings. Broader Irish issuer coverage, more Indian AMC formats, confirmed dealing status and automated monthly source discovery remain future work. No Cloudflare secret, Gemini credential or scheduler redeployment is required for this catalogue release.

The separate Cloudflare scheduler ran successfully on 23 October: GitHub run 39896886155 started at 03:47:32 UTC (09:17:32 IST) and completed successfully. The primary schedule is 09:17 IST and the missing-dispatch backup is 09:27 IST; GitHub execution remains best effort.

## Reproduction and checks

Install the locked JavaScript dependencies with `pnpm install --frozen-lockfile`, the validator dependencies with `python -m pip install -r scripts/automation/requirements.txt`, and workbook dependencies with `python -m pip install -r scripts/data/requirements.txt`.

Run:

```sh
python scripts/data/verify_expansion_sources.py
python -m unittest discover -s scripts/automation/tests -v
python scripts/automation/verify-bootstrap.py
node scripts/automation/verify-contracts.mjs
pnpm verify
pnpm typecheck
pnpm lint
pnpm build
```

The source replay reconstructs all 1,218 expanded Indian statements from the original retained bytes and compares financial positions, dates, units, row provenance and original names; it also reproduces all 706 Irish portfolios exactly. CI runs this replay when the data adapters or retained import sources change. Application checks verify search/domicile filtering, mixed dates, source hashes, weights, session restoration, selection limits and analysis arithmetic. The manual release record and updated baseline identify this deliberate expansion separately from daily automation audits.
