# International portfolio analysis

The global catalogue now links exact catalogue IDs to separately loaded official holdings. Tick a supported fund and choose **Analyse selected funds**. The lab accepts up to 20 portfolios and holding values in USD. Selected funds can be reopened from the lab, and sessions retain source dates and SHA-256 fingerprints.

## Coverage and dates

The first release supports 38 US-listed iShares ETFs, including international equity exposures, sector and factor funds, Treasuries and corporate bonds. These are holdings snapshots dated 2 or 5 October 2026, not live prices. The international catalogue itself remains broader than the subset with validated holdings. The coverage filter and disabled checkboxes distinguish the two. The original Indian selection flow and US homepage example are unchanged.

The exact current list is `public/data/global/holdings-index.json`. The downloadable audit in `public/data/global/holdings-coverage.json` lists both accepted and rejected sources. Issuer product URLs were matched from the official iShares product directory. Full downloaded CSVs and retrieval metadata are retained in `data/sources/global/holdings/`; their SHA-256 digests are checked before normalization.

## What the lab measures

Stock overlap, stock and sector concentration, and hypothetical equity price changes use disclosed equity positions. Published cash, bond, collateral and derivative balances remain classified separately in portfolio totals. **Bond prices, duration, derivative payoffs and currency movements are not modeled.** A bond portfolio's absent equity response is not a prediction of zero investment risk. Every official scenario is labeled partial.

All entered fund holding values must use USD. No conversion from a fund's listing or underlying security currency is inferred. Mixed disclosure dates are displayed as a range and disclosed explicitly. They do not form a simultaneous historical portfolio.

Security matching uses a supplied ISIN, or an exact issuer tuple of ticker, name, exchange and market currency. A ticker alone never establishes identity across countries. Different names, listings, share classes or depositary receipts remain separate; this conservative method can understate economic overlap. Exact repeated security rows are aggregated with the original row numbers retained.

Published two-decimal weights are not rescaled. A 99.5–100.5% total is accepted as a rounding tolerance, not proof of reconciliation to accounting NAV. Some broad portfolios and large bond files fail this threshold because of numerous rounded weights. They remain unavailable rather than receiving invented residual positions. Failed/HTML source responses are also excluded. Catalogue NAVs and share-class metadata have their own dates and are not replaced by this holdings release.

## Rebuilding and checking

Run `python scripts/data/fetch_global_holdings.py` only for an intentional source refresh, then `python scripts/data/build_global_holdings.py`. Review every change in the coverage audit before publication; a transient source failure can reduce coverage. Offline rebuilding does not access the network. Run `pnpm verify` and `pnpm typecheck`, then use the project's normal production build.

The global-portfolio verification suite checks source hashes, identities, weight totals, classifications, selection bounds, cache recovery, mixed-market rejection, saved sessions, equity stress arithmetic and real cross-fund overlap. Existing suites cover the original catalogue and portfolio behavior. All files are static and require neither an API key nor an AI service at runtime.
