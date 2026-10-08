# FundLenz

FundLenz is a free educational portfolio lab and source-based fund, stock and bond catalogue created by Atharva Sahu. It does not provide investment advice or recommend investments.

This is the prepared GitHub migration package for the existing website. It preserves the application and its current data snapshots, and adds the operating specification for controlled catalogue updates. **Cloudflare hosting is active on the temporary workers.dev address. Daily Gemini checks are active in dry-run mode; automatic financial publication is still disabled.** See [migration status](docs/migration/STATUS.md).

## Included catalogue

| Dataset | Retained coverage | Location |
|---|---|---|
| Indian funds | 3,372 grouped records; 14,354 plan/option codes | `public/data/catalog.json` |
| Indian holdings | 803 portfolios; 49,022 positions; 21 fund houses | `public/data/holdings/` |
| International funds | 21,389 directory records | `public/data/global/` |
| International analysis | 38 selectable ETFs; 17,126 holdings | `public/data/global/holdings/` |
| Stocks, bonds and other securities | 31,664 reference records | `public/data/securities/` |
| US example | IVV, IWB and IWF; illustrative investment amounts | `public/data/us-example.json` |

These counts describe different, partly overlapping kinds of records; they are not a count of unique active investments. Retained source dates differ: Indian holdings are August 2026, US example holdings are 2 October 2026, some listing/NAV sources were checked on 5 October 2026, and the SEC series registry is dated June 2026. The preparation date is not a new financial-data date.

Source records, hashes and ingestion scripts are in `data/sources/` and `scripts/data/`. Original AMC workbooks that were never bundled remain referenced by URL/checksum. This package contains all files retained by the existing Site, not every remote document on the Internet. Detailed coverage and methodology remain in [the original Site README](docs/migration/original-site-readme.md).

## Website structure

- `/`: the existing portfolio lab and US example.
- `/catalogue-global`: default international catalogue.
- `/catalogue-india`: Indian catalogue and available holdings.
- `/catalogue-securities`: stocks, bonds and other reference securities.
- Existing legacy redirects, mobile layout, downloadable template, CSV import/export, saved sessions, exposure/overlap analysis and deterministic scenarios remain included.

UI code is in `app/` and `components/`, financial calculations in `lib/finance.ts`, and catalogue records in `public/data/`. The two source-check labels now read their date from a small JSON file; their current visible text is unchanged. The subsequent version 10 feature adds international portfolio selection without changing the financial formulas or theme. See [international analysis coverage and methods](docs/global-portfolio-lab.md).

## Agreed automation design

Read [the full operating specification](automation/OPERATING-SPEC.md).

1. Trusted adapters acquire approved authoritative sources; Gemini examines supplied evidence for due catalogue checks.
2. A separate Gemini task independently investigates persistent flagged items. A validator warning is not assumed to be true.
3. Trusted code reconciles candidates, verifies evidence and keeps complete last-verified units when an update fails. Newer verified snapshots take priority.
4. Only sanitized, validated data changes can enter automatic merge/deployment. Gemini cannot edit the application, rules or publishing configuration.
5. Latest reports and the persistent issue queue keep failures visible. Human review is optional and not a subscription-dependent gate.

The scheduled runner, two Gemini tasks, source-backed NAV and complete-portfolio validators, persistent issue state, protected publisher and deployment observer are implemented. Supported financial adapters cover existing AMFI plans and 38 iShares portfolios; other sources are monitoring-only. Live run 37672720902 passed the source/model/validation/audit path with an honest PARTIAL report. Protected main and a dedicated publishing identity still need owner setup. See [the current operating guide](docs/migration/AUTOMATION.md) for coverage, results and activation steps.

## Local checks

Use the versions declared in `package.json`: Node 22.13.0 or later and pnpm 11.25.0. Install the locked dependencies with that package manager:

```sh
pnpm install --frozen-lockfile
python3 -m pip install -r scripts/automation/requirements.txt
python3 -m unittest discover -s scripts/automation/tests -v
python3 scripts/automation/verify-bootstrap.py
node scripts/automation/verify-contracts.mjs
pnpm verify
pnpm typecheck
```

The integrity check verifies the reviewed standalone repository snapshot in `automation/baseline-manifest.json`. Earlier import and release manifests remain available in Git history. Approved evolving data paths are separately protected by deterministic source replay and the exact-commit PR data gate. Immutable application files and unrelated catalogue releases retain their baseline checks.

## Hosting and repository status

The GitHub copy now has a standalone Cloudflare Workers build using the existing pinned Vinext and Wrangler versions. See [Cloudflare setup](docs/migration/CLOUDFLARE.md) for the exact dashboard commands. The production build, deployment dry runs, type check and existing regression suites pass. Cloudflare deployment succeeded and the owner confirmed the live feature checks. The custom domain stays on the previous host until API integration and further testing are complete.

The repository is `atharv3169/FundLenz`, private during preparation. It contains the original import plus the international-analysis update published as Site version 10. GitHub visibility/plan and required merge checks must still be configured before enabling automatic catalogue publication.

There are no API keys in the package. Supply future credentials through the appropriate secret settings, never through public files or Gemini prompts. No open-source licence has been selected; third-party source material retains its applicable terms.

## Author and contact

Atharva Sahu · info@fundlenz.com
