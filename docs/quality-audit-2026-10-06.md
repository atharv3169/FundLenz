# FundLenz quality audit — 6 October 2026

## Scope and outcome

Reviewed application code, calculation logic, the published data snapshots, loading and import failure cases, dependency advisories, responsive CSS, navigation, and initial server-rendered markup. The baseline was published version 8, commit `d1a7248a3c50adb064a80d6c79a72c550d511caa`.

The update preserves the stylesheet, visible wording, financial formulas, published catalogue values, and existing feature set. No portfolio recommendations or forecasts were introduced. Changes address internal performance, recovery from failed loads, input validation, development checks, and dependency vulnerabilities.

## Changes

- Cache normalized search text by immutable catalogue record, allowing obsolete records to be garbage-collected. Sort the international and securities lists when their source or ordering changes rather than after every search keystroke.
- Reuse date and currency formatters. Select the preferred Indian plan in a single pass while retaining the previous date/direct/growth priority and tie behavior.
- Reuse the portfolio overlap matrix between input changes. Replace repeated cross-fund holding scans with identifier lookups.
- Remove pagination-reset effects that caused a second render after new filter results appeared. Deduplicate Indian fund IDs supplied in selection URLs.
- Give JSON downloads a 30-second deadline. Failed cached requests are evicted; simultaneous readers still share one request. Existing retry controls and error wording are retained.
- Reject non-object/oversized session files and text after a closed CSV quote. Index CSV headers and holding identifiers once; preserve valid template round trips and duplicate checks. Extend spreadsheet-formula escaping to whitespace-prefixed formulas while retaining numeric negative exports.
- Use framework navigation for existing home links, with speculative prefetching disabled. Add a standard public `robots.txt` to resolve the two crawler 404s returned in the production-log sample.
- Add a repeatable verification runner and exclude the generated TypeScript build cache from source control.
- Apply targeted package patches; unchanged direct UI-library versions remain pinned by the lockfile. React, React DOM and the server-component transport are aligned at 19.2.8; Next and its lint configuration are 16.3.6; Vite is 8.0.16. The application's Vinext architecture is preserved.

## Verification

The final verification runner passes **580,275 counted assertions**, in addition to the international catalogue suite's uncounted assertions:

| Suite | Result |
| --- | --- |
| Financial calculations | 99 checks: exposures, HHI, overlap, shocks and constrained allocation invariants |
| Indian catalogue | 304,525 checks across 3,372 fund groups, 14,354 plans, 803 portfolios and 49,022 holdings |
| International catalogue | 21,389 records; identifier joins, 39,138 registered classes, 5,755 ETF listings, 1,497 issuer classes, lazy detail files, source hashes and dated values |
| Revision coverage | 245,105 checks: US snapshots, 31,664 securities, identifiers, source hashes, currencies, imports, legacy/current sessions and redirect query preservation |
| Reliability and equivalence | 30,546 checks: every Indian plan/filter choice against the prior implementation, representative international/securities searches, malformed inputs, formula escaping, aborted requests, failed-cache recovery and request deduplication |
| TypeScript | Strict type check passes |
| ESLint | Zero errors and zero warnings |
| UI preservation | Equivalent initial DOM structure, attributes and text for home, India, international and securities pages, allowing irrelevant HTML attribute-order differences; CSS unchanged |
| Internal static links | Eight distinct literal local destinations resolve to routes or public assets; generated portfolio/detail paths are also covered by the catalogue suites |

The finance module and all files under `public/data` are unchanged. Source checksum checks establish consistency with the stored source files; they do not independently prove every issuer's original disclosure is correct.

## Measured processing improvements

These are warm local Node benchmarks, using the actual published catalogue and 30 repetitions. They are **not** end-to-end page-load measurements or promises for every device.

| Operation | Before median | After median | Approximate speedup |
| --- | ---: | ---: | ---: |
| International search, “vanguard total” | 5.67 ms | 2.60 ms | 2.2× |
| Securities search, “united states treasury” | 15.52 ms | 4.68 ms | 3.3× |
| Format 1,000 snapshot dates | 43.09 ms | 0.95 ms | 45.5× |
| Select preferred plans across the Indian catalogue | 3.68 ms | 1.45 ms | 2.5× |

The allocation-search algorithm was left unchanged. Its sampled 10-fund run was already about 2 ms; small timing differences before/after are ordinary benchmark variation. Raw timings are in `audit-performance-2026-10-06.json`.

## Dependency findings and remaining work

The full dependency scan, including development packages, fell from **55 advisory findings to 2**. The final scan reports no critical, moderate or low findings. Two high-severity advisories remain; this is not a claim that the dependency tree is vulnerability-free.

1. **`source-map-js` 1.2.1** — the upstream patch is 1.2.2. Installing it was rejected by the project's existing seven-day `minimumReleaseAge` policy in `pnpm-workspace.yaml`. The release timestamp is 30 September 2026, 14:08:09 UTC; it becomes eligible on **7 October 2026, 14:08:09 UTC (19:38 IST)**. No policy was weakened. Apply that exact patch once eligible, refresh the lockfile, and rerun verification/build. The application does not accept user-supplied source maps; the observed dependency paths are compiler/build tooling. This reduces apparent exposure but does not remove the advisory.
2. **`braces` 3.0.3** — the advisory lists no upstream fixed version. It is reached through build/lint glob tooling. No public FundLenz feature passes user-supplied glob expressions to it. Keep builds restricted to the trusted project and monitor upstream; do not describe this as patched.

The package-level report and affected dependency paths are preserved in `audit-dependencies-2026-10-06.json`. Relevant upstream notices:

- https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
- https://github.com/advisories/GHSA-wx67-qw84-cm4g
- https://github.com/advisories/GHSA-fx2h-pf6j-xcff
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Limits and future maintenance

- Live browser/mobile interaction testing was unavailable because the required managed browser-control capability was not installed. Source inspection and server rendering do not replace real-device interaction, accessibility, or network-load testing.
- This was an integrity/performance audit, not a fresh download of every external issuer disclosure. Data retains its stated dates: US example holdings 2 October 2026, Indian monthly holdings 31 August 2026, and other catalogue records their individual source dates. Large catalogues still need an initial network download.
- Returned production error logs covered the requested last 24 hours, limited to 25 events. The two returned events were `robots.txt` 404s, not evidence that every user session was error-free.
- No system can be certified to remain fault-free indefinitely. Recheck after source-format changes, catalogue refreshes, or dependency updates. No new automatic schedule was created by this audit.

Run `pnpm verify`, `pnpm typecheck`, `pnpm lint`, and the normal production build before publishing future changes. Run `pnpm audit --json` to check advisories. Some existing catalogue tests deliberately pin the current source snapshot; when refreshing data, verify source identity/date/hash first and update the associated expected snapshot assertions together. Preserve saved-session snapshot checks rather than silently loading different historical data.
