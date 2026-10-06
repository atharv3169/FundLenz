# FundLenz — website and catalogue review

Release: 5 October 2026. Project by Atharva Sahu.

## Changes delivered

- FundLenz branding and Atharva Sahu attribution throughout the interface, metadata, downloads and report. The existing logo graphic, colours and visual layout are retained.
- International catalogue first in navigation: `/catalogue-global`; India: `/catalogue-india`; securities: `/catalogue-securities`. `/catalogue` opens international. Old `/global` and `/funds` addresses redirect with their query parameters intact.
- Homepage example: IVV, IWB and IWF, with official 2 October 2026 holdings and explicitly illustrative USD amounts. Indian selections remain INR. No currency conversion or mixing is implied.
- Downloadable CSV template next to import/save; filled fictional rows and a currency column. CSV imports reject mixed/unsupported currencies. Older CSVs default explicitly to INR.
- Official saved sessions preserve currency, source snapshot/hash and the example-amount label. Older session formats remain readable; mismatched source snapshots are rejected.

## Catalogue inventory

| Dataset | Included records | Scope/date |
| --- | ---: | --- |
| Indian NAV plans/options | 14,354 | Full downloaded AMFI snapshot; newest observation 5 October, with older dates retained |
| Indian fund-name groups | 3,372 | Grouped scheme names across 55 houses; not a census of active products |
| Indian analytical portfolios | 803 | 49,022 positions, 21 houses, 31 August 2026 |
| International fund records | 21,389 | 18,653 registered series, 1,239 unmatched listings, 1,497 issuer records |
| US ETF-flagged listings | 5,755 | 5 October Nasdaq directories; overlapping with the international record count |
| Securities reference records | 31,664 | Includes all categories below, not all common stocks |
| Individual identified bonds | 24,167 | Five issuer fund disclosures, 2 October 2026 |
| Source-labelled stocks | 5,072 | US exchange listings, 5 October 2026 |
| ADRs | 320 | Separate from common-stock labels |
| Preferred shares | 489 | Separately labelled |
| Other securities | 1,616 | Trust shares, units, warrants, rights, listed debt/funds and unclassified listings |

Bond diversity includes corporate investment grade/high yield, sovereigns, agencies, supranationals, covered bonds and securitized instruments. The issuer lists 97 source locations, including supranational entries. This is a holdings-derived sample, not the complete global bond market. The stock listings include foreign ADRs on US exchanges; this is not coverage of every world exchange.

## Freshness findings

Core sources were checked on 5 October around 15:08 UTC. AMFI NAV, Nasdaq listings, current SEC ticker mappings and iShares issuer data changed and were rebuilt. Vanguard's values were unchanged; differences were only array ordering. The SEC annual series/classes file was unchanged and remains dated 1 June 2026. Detailed check evidence: `/data/freshness.json`.

Twenty-one Indian disclosure pages were checked. Seventeen exposed existing August monthly files without a verified September monthly replacement. Mirae, SBI, Tata and UTI were inconclusive because of dynamic disclosure controls. New September weekly/fortnightly links did not establish complete September monthly coverage. August dates therefore remain visible. Neither every monthly source nor every financial field is claimed to be current to the minute.

US example and bond files were retrieved on 5 October and disclose 2 October holdings. Each security and fund value retains its own as-of date. No automatic live-price service is configured by this revision.

## Verification and fixes

- Finance reference cases: exposures, HHI, effective holdings, symmetric overlap, scenario override priority, zero values, partial modelling and constrained allocation search.
- Full Indian catalogue validation: unique plan IDs, scheme matching, dated portfolios, leaf-value reconciliation, signed balances and source links; over 304,000 data assertions.
- International validation: registry/class joins, current versus historical ticker separation, source checksums, fee/NAV currency and dates, filters, known fund searches and lazy detail loading.
- New release validation: US weights and hashes, consistent stock identities, USD totals/scenarios, CSV currency round trips and rejection cases, legacy session restoration, snapshot rejection and query-preserving redirects.
- Securities validation: all retained raw hashes, unique record IDs, checksum-valid ISIN/CUSIP identities, deduplication, dates, source membership, coupon fields and search/filter results. Excluded 28 TBA entries and three unidentified bond positions. Detailed evidence: `/data/securities/audit.json`.
- All four principal pages passed server rendering with the new branding and navigation. Type checking and production build are required publication gates.
- Fixed currency-specific report/export labels, official US session restoration, lost illustrative-amount labels on saved examples, and input actions racing initial data loading. Imports/restores are temporarily disabled while a dataset is loading.

## Interpretation and remaining limits

The portfolio lab models disclosed equity exposures and hypothetical price shocks. It does not estimate expected returns, volatility, liquidity, probability, derivative delta, or suitability. Allocation search preserves its stated constraints and is not a global optimum. US source weights retain published rounding; totals can differ slightly from 100%. Cash/other signed balances are retained. Missing values are not guessed.

Stock/bond reference records support discovery, filters, source inspection and CSV export; they cannot yet be added directly to the fund portfolio lab. Bonds have no live prices, yield estimates or inferred ratings. Coupon is the source's rounded observed rate, not yield or guaranteed return. Legal final maturity may differ from expected redemption. Two disclosed positions with maturity before the snapshot remain labelled source observations, not assertions of current trading availability.

There is no cross-currency portfolio aggregation. Many international records are registry entries without analytical holdings. Indian historical returns, expense ratios, managers and riskometer classifications remain unavailable. Listing-name classifications are explicitly text-based; ambiguous types remain separate.

Interactive browser and visual-device testing was unavailable in this environment. Source, numerical, data, type, server-render and production-build checks passed or are publication gates; these do not prove that every browser interaction and viewport is bug-free.
