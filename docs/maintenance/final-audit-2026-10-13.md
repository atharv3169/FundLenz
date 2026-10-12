# FundLenz operations and final audit — 13 October 2026 IST

## Current production

- Canonical URL: https://fundlenz.com, Cloudflare Worker `fundlenz`, production branch `main` in `atharv3169/FundLenz`.
- HTTP and HTTPS `www.fundlenz.com` redirect to the HTTPS apex, preserving the path and query string. The apex custom domain migrated on 12 October; earlier migration documents retain historical preparation notes.
- Native blog administration, public article/homepage publication and visitor forms are deployed. The owner confirmed their use. Private submissions go to Google Drive; drafts and revisioned publications use the production D1 database. Newsletter collection does not send newsletters.
- The old Site and exported DNS records are retained as recovery material. Do not delete production/staging databases, source evidence or staging safety tests as temporary files.

## Daily timing and scope

The catalogue cron is `47 3 * * *`: **09:17 IST**, best effort. GitHub queues the runner; trusted acquisition downloads approved sources before the two bounded Gemini tasks. Gemini is not continuously running and does not search arbitrary websites. Actual scheduled starts on 10–12 October were 15:38, 15:50 and 16:51 IST, so the configured time is not a delivery guarantee.

The source registry has 476 approved exact URLs: 39 supported adapters (AMFI plus 38 iShares portfolios) and 437 monitoring-only entries. Two malformed legacy entries are quarantined. Existing AMFI NAV tuples and complete supported holdings snapshots can update automatically. Other directories, Indian portfolio disclosures and securities references do not become automatically refreshable just because they appear in the catalogue.

The read-only production health cron is `23 7,19 * * *`: **12:53 and 00:53 IST**. It checks the latest scheduled catalogue run, the served financial release/date, public routes and both WWW redirects. A missing run beyond 36 hours, failed latest run, or run stuck beyond one hour fails the check. The workflow uses no Gemini calls or write permissions. GitHub scheduling remains a shared dependency; an independent external watchdog is not configured.

## Safe publication and recovery

Source acquisition is URL-allowlisted, size/time bounded and hash recorded. Gemini returns proposals from supplied evidence. Independent deterministic code validates source identity, complete atomic units and protected field/path rules. The publisher creates a data-only PR with a dedicated identity; trusted base code replays the producer artifact, records the required check on the exact head, and rechecks branch/head/protections before merge. Gemini has no repository write credential.

Bad or missing sources retain previous verified complete values and persistent issues. Unsupported sources cannot replace financial data. Manual workflow dispatch defaults to audit-only; financial publication is an explicit opt-in. An audit-only release must not advance the financial date or falsely claim deployment of new financial bytes.

Cloudflare builds `main` with `pnpm run build` and deploys the generated `dist/server/wrangler.json` through `pnpm run deploy`. The deploy wrapper retries recognized transient 500/502/503/504/network failures at most twice, waiting 15/30 seconds and keeping the same built artifact. Permanent auth/quota/configuration failures and killed processes stop. It does not perform a database rollback.

Read-only GitHub API calls have bounded retries; writes are not blindly replayed. Gemini retries stay within two attempts per task/four calls per daily run. Quota/authentication failures do not cause an unlimited retry loop. Exhausted credentials, provider outages and changed source formats still need intervention.

## Verification and audit corrections

The audit began at production commit `af5da8f65bd90ac3334b62489bb0af3e91b4bcdb` (PR #45). The exact baseline passed 75 Python automation tests, deployment retry tests, financial/catalogue verification, TypeScript, blog security/editor/publication checks, production and isolated staging builds. GitHub run [38285178407](https://github.com/atharv3169/FundLenz/actions/runs/38285178407) includes a successful real Chromium editor/responsive check. Local Chromium installation was unavailable; do not describe that local attempt as a pass.

Broad repository lint found six errors and generated-output warnings missed by the narrower blog-only lint step. This maintenance change fixes JSX escaping, uses the existing router Link for the legal Back control, moves synchronous holdings error resets out of effects into user events/results, cleans unused test variables and ignores generated `.checks` bundles. CI now runs full repository lint and includes shared-library/hook/verification changes. Financial formulas, data and infrastructure credentials are unchanged.

Current operating documentation now supersedes stale statements that publication was inactive, the repository private or the domain migration pending. Historical records remain clearly marked because they explain earlier decisions.

Before this maintenance change, [production health 38285418610](https://github.com/atharv3169/FundLenz/actions/runs/38285418610), [deployment confirmation 38285418520](https://github.com/atharv3169/FundLenz/actions/runs/38285418520) and [release integrity 38285418500](https://github.com/atharv3169/FundLenz/actions/runs/38285418500) passed. Live read-only checks returned 200 for seven public pages, 401 for unauthenticated article drafts, and 301 for both WWW schemes preserving path/query. One repeat local exact-marker probe encountered a network error; the successful GitHub deployment/health runs are the independent confirmation evidence.

## Failure response

1. Inspect the failing Actions job and its retained artifact. Distinguish collection/model/validation, PR checks, deployment and health failures.
2. For unavailable or rejected source units, inspect the persistent issue and exact source/hash. Never relax validation merely to get green.
3. For Gemini auth/quota failures, review the GitHub `GEMINI_API_KEY` secret and Google project quota privately. Do not paste keys into chat, source, logs or model prompts.
4. For publication failures, check publisher identity/token expiry, required exact-head check, current base/head and branch protection. Do not bypass protection.
5. For deployment failure, inspect Cloudflare's build check. Retry a transient transport failure using the same artifact; resolve configuration/authentication failures explicitly.
6. For an outage, confirm the main domain, release marker, WWW redirects and Worker bindings. A successful build is not enough to prove the served release.
7. If rollback is needed, preserve/export D1 and Drive data first and choose a compatible known-good Worker build. A code/DNS rollback does not roll back D1 or Drive. The old Site lacks later features; no destructive database rollback is automated or rehearsed.

The owner reports enabling Actions failure notifications. Actual email delivery has not been independently tested. The user does not need to inspect the site every day, but alerts and credential/provider changes can still require attention.

## Maintenance boundaries

Local cleanup moved an interrupted catalogue temporary file, obsolete bundled checks and Python bytecode to recoverable trash (24 files, 3,551,743 bytes). No tracked financial source/data or active staging feature was deleted. Public source evidence and retained audit fixtures are necessary for deterministic replay and are not redundant copies to discard.

Keep `keep_vars: true` and the separate production/staging D1 IDs. Preserve mail MX/SPF/DKIM when editing DNS. The owner rejected Cloudflare Access/Zero Trust flows requiring payment-card setup; native single-admin authentication is the selected architecture. Future assistants should read this record, current code and the owner's detailed private handoff before proposing reactivation or migration work already completed.
