# FundLenz securities reference catalogue

This package builds a source-linked directory of individual securities. It contains **31,664 reference records**, not 31,664 current trade recommendations or live quotes.

## Sources and coverage

- Official Nasdaq Trader nasdaqlisted/otherlisted directories: snapshot **5 October 2026**, checked approximately 15:09 UTC. Test issues and source-flagged ETFs excluded. Raw hashes match the independent refresh task's same-day downloads.
- Official iShares holdings CSVs for AGG, LQD, HYG, EMB and IAGG: holdings dated **2 October 2026**, downloaded **5 October 2026**. These contribute **24,167 distinct identified bonds** across **97 source locations**. Countries/locations are issuer-disclosed values; “Supranational” and similar entries are not sovereign countries.
- Stock-related counts: **5072 Stock**, **320 ADR**, **489 Preferred stock**. Additional separate categories: **294 Unit**, **472 Warrant**, **144 Right**, **201 Listed debt**, **270 Listed fund**, **141 Other listed security**, **94 Trust share**.

The stock universe covers US exchange listings, including foreign depositary receipts. It is not a global census of all exchanges. No issuer domicile or quote currency is inferred from US listing. “Listed fund” is based on explicit source names, not an independently verified closed-end legal structure. Explicit trust-share names are separated as Trust share; this includes REIT and investment-trust shares without guessing their legal fund category. A listing with insufficient name information remains “Other listed security”; this includes some familiar companies, deliberately avoiding unsupported type guesses. Units, rights, preferred shares and warrants are not counted as common stocks. Separate exchange share-class tickers remain separate listings.

The bond universe spans corporate investment grade/high yield, developed/emerging sovereigns, agencies, supranationals, covered bonds and securitized issues. It is a holdings-derived reference universe, **not an exchange listing, exhaustive bond-market directory or assurance of retail availability**. The bond source's sector taxonomy is preserved, including CMBS, ABS and MBS Pass-Through; these are individual identified fixed-income instruments but have different risks from plain corporate bonds.

## Data meaning

- `id`: listing exchange + symbol, or disclosed ISIN/CUSIP identity.
- `sourceIds`: raw source evidence; bond `heldBy` is the source ETF membership, never fund weight or a security price.
- `country`: the source's Location field. `currency`: the bond's Market Currency, not reporting currency or an inferred FX conversion.
- `coupon`: source-disclosed rounded coupon percentage as of the snapshot. Not yield or a guaranteed return; floating coupons can reset and full contractual precision is not supplied by this export.
- `maturity`: source-disclosed maturity. Legal final maturity may differ from expected redemption; two source positions with a maturity earlier than the snapshot are retained, not falsely presented as active new investments.
- `asOf`: record snapshot date. Top-level `asOf` is the latest source date; it does not overwrite each bond's 2 October date.
- Prices, portfolio market values, fund weights, yields, ratings and guessed FX conversions are intentionally absent from the user-facing securities records.

## Validation and exclusions

Every raw file is SHA-256 checked by `normalize.py` before parsing. All published ISINs and CUSIPs pass their identifier checksums. There are no duplicate record IDs, no duplicate bond CUSIPs and no metadata conflicts across repeated bond identities. Names can have source variants, which are retained as aliases. Source membership is merged without counting a bond again in every fund.

Only source `Fixed Income` rows enter the bond universe. Cash, fund units, equities, FX, forwards, collateral and money-market holdings are excluded. **28 TBA records are excluded** rather than presented as specific settled individual bonds. Three HYG positions lack a stable ISIN/CUSIP and are excluded; `audit.json` names these records. No missing identifier is invented. Metadata conflicts, if introduced by a later refresh, cause that field to be withheld and are recorded rather than silently picking one value.

Run `python normalize.py` in this directory to reproduce `securities.json` and `audit.json`. Raw inputs are under `raw/` and pinned source URLs/checksums are in `downloads.json`. `AGG-page.html` is contextual evidence only and is not a normalization input. The normalizer uses only Python's standard library.

## Separate US example refresh

`us-examples/` contains fresh IVV/IWB/IWF complete issuer CSVs and download manifest, all **2 October 2026**. These are inputs for the site's existing portfolio normalizer, not part of the bond-reference count. The disclosed rounded weight totals are 100.09%, 99.97%, and 99.95%, respectively. Preserve the original weights without rescaling; cross-fund identifiers, dates and classifications must also be validated during integration.
