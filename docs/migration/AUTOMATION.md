# FundLenz catalogue automation

Implementation date: 7 October 2026. Owner: Atharva Sahu.

## Current operating mode

The daily runner is **scheduled dry-run**. It collects official source bytes, runs
two bounded Gemini tasks, validates supported data, saves a complete audit and
carries unresolved issues into the next run. It does **not** publish financial
changes while `publication_enabled` is false. The current domain is unchanged.

The separate data-only publisher, trusted PR gate, automatic merger and
Cloudflare confirmation workflow are implemented but require the activation
steps below. Having a Gemini key alone does not activate publication.

## What is covered

| Source/data | Current behavior |
|---|---|
| Existing Indian AMFI plans | Parse the complete official eight-column NAV feed. Verify scheme code, fund/AMC, plan/option and ISIN. Validate each NAV/date/provenance tuple independently. New identities need a reviewed adapter change. |
| 38 selectable iShares portfolios | Parse complete official CSV bytes, exact fund identity, reporting date, USD currency, every leaf row, duplicate identity rules and unscaled weights. Update each accepted portfolio, its index, coverage and retained CSV together. |
| Other Indian holdings | Monitor approved disclosure URLs and carry discovery failures forward. New monthly workbooks are not automatically converted by this first live runner. |
| Global fund/share-class directories, stocks and bonds | Monitor approved official URLs. No automatic new listings, delistings, security identity changes, inferred prices, yields or ratings. |
| Existing US homepage example | Retain its previous common-period file. Individually selectable global ETF portfolios have their own supported update path. |

The registry contains 478 exact source URLs: 39 supported acquisition/validation
adapters and 439 monitoring-only entries. Historical URLs are explicitly labelled
integrity checks: fetching an August workbook again does not discover September.
New URLs, redirects or formats require a reviewed code change. Unsupported
sources never receive a fabricated “verified financial update.”

## Daily schedule and budgets

- GitHub schedule: **03:47 UTC / 09:17 India time**, best effort, not an exact-time SLA.
- Supported feeds: daily; discovery/registry monitoring: weekly; explicitly dated
  historical documents: every 30 days. The four pre-existing discovery issues are
  retried daily. Other pending sources rotate by their last actual attempt.
- Up to 64 source requests, four workers, one request at a time per host, 15-second
  request timeout, 12 MiB per file and 32 MiB of retained source bytes per run.
- No automatic source retries. A blocked/redirected source is recorded honestly.
- At most two Gemini requests, one fresh scan and one independent investigation.
  Model: `gemini-3.1-flash-lite`; 100,000 input bytes/task, 8,192 output tokens/task,
  60-second timeout, no retry. No grounding/search tools or executable tools.
- Gemini gets labelled excerpts and sample units. Deterministic adapters inspect
  complete supported files. Neither process claims universal factual certainty.

Budget-deferred and failed sources remain distinct from successfully checked
sources. Limits do not guarantee free quota. Keep spending controls at zero if
free-only operation is required. No billing or paid services are activated here.

## Gemini rules

The immutable instructions are `automation/gemini-system-prompt.md`,
`gemini-daily-scan.md` and `gemini-reinvestigation.md`. The candidate schema is
validated locally with duplicate-key, finite-number and calendar-date checks.

Gemini cannot edit UI, calculations, code, configuration, prompts, rules or source
allowlists. It has no GitHub write token and no tool that executes its output.
Source documents are untrusted evidence, never instructions. Source hashes come
from downloaded bytes. Confidence is not verification.

A previous warning may reflect an extraction mistake, changed source, formatting
problem or validator false positive. The investigation must return to source
evidence. It cannot move decimals, reuse old values or adjust thresholds simply
to pass. False positives remain blocked for rule review. Unresolved/null model
values never erase a previous value.

## Deterministic acceptance rules

1. Exact approved HTTPS URL, public network address, approved redirect, bounded
   complete body and matching SHA-256. Credentials never follow redirects.
2. Valid complete source layout and exact stable identity. No fuzzy name joins or
   treating ticker alone as an enduring security identity.
3. Finite positive NAV and actual source field date. Newer verified dates can
   update; same-date conflicts and older replacements are held for review.
4. A NAV movement over 50% triggers review. This threshold is a warning, not proof
   of an error. Source-supported exceptions need a separate reviewed rule change.
5. Complete international holdings snapshots, preserved signed non-equity rows,
   no negative long equity, USD reporting, source row provenance and weight sum
   within the existing issuer tolerance of 99.5–100.5%. No weight rescaling.
6. Missing end-of-file separator, malformed rows, a row-count fall over 50% or
   conflicting cross-fund classifications block the complete portfolio. These
   checks reduce truncation risk; they cannot prove an issuer's own data correct.
7. Independent units can pass while other units retain the complete prior
   snapshot. Index, portfolio, CSV provenance and coverage update atomically.
8. A malformed/missing required Gemini task stops all financial emission for
   that run. Independently computed decisions still appear in the saved report.
9. Only explicit adapter-owned paths enter a sanitized release. No deletion,
   symlink, executable path, unknown file or unlisted output can pass publication.
10. The trusted PR job replays source validation and compares the entire proposed
    Git diff byte-for-byte. It then runs existing finance/catalogue regression
    tests on the reproduced data. PR code is never checked out or executed by
    that privileged workflow.

The historical baseline manifest remains in version control. Immutable files
still must match it. The small set of evolving data paths is instead protected by
source replay, current dataset identity and financial regressions. Existing
release-specific checks for unchanged directories remain in place.

## Audits and recovery

Open **GitHub → Actions → FundLenz daily catalogue → latest run**.

- The run summary distinguishes `PASS`, `PARTIAL`, `FAIL` and `NO_CHANGE`.
- **fundlenz-audit** contains original retrieved bytes, model inputs and outputs,
  validation decisions with old/proposed values, resolutions and sanitized files.
  Retention is seven days to limit storage use; download a run if it needs a
  permanent offline record before automatic publishing is activated.
- **fundlenz-state** contains persistent source cadence and unresolved issues,
  retained for 90 days. The next run restores it, including from a failed run.
  Missing/expired prior state stops the runner; it cannot silently reset history.
- Failure counters count real attempted checks, not missed days. Three consecutive
  failures warn; seven require manual review. Replaying the same run is idempotent.
- Once publishing is activated, audit/state updates are also versioned in Git.
  Full source evidence artifacts still expire; accepted source bytes remain in
  the repository, and rejected evidence needed long term should be archived.
- A fatal crash produces a separate `runner_failure` record. It does not pretend
  a full daily validation completed. GitHub failed-run notifications are the
  default alert mechanism; PARTIAL runs produce a visible Actions warning.

Root `audit/` is not a public website route. After an activated release actually
deploys, `/automation-audit/latest.json` will expose a sanitized summary and
`/automation-audit/release.json` the dataset marker. No link is advertised before
those files have been deployed. Check and snapshot dates remain separate. The
existing site-wide date is not advanced for a partial scan.

## Activation: owner setup still required

1. **Choose protected-repository access.** This repository is currently private
   and `main` is unprotected. GitHub Free supports protected branches on public
   repositories; private protection requires an eligible plan. Do not change
   visibility or purchase a plan without the owner's choice.
2. Protect `main`: require a pull request; require **FundLenz data gate** and the
   release-integrity check; require branches up to date; enforce for administrators;
   disallow force pushes and deletions. Do not require a daily human approval if
   unattended data publication is wanted. Configure a pull-request requirement
   with zero required approvals where supported. If the chosen protection plan
   cannot enforce this arrangement, leave publication disabled.
3. Configure a **dedicated publisher identity**. A separate bot/service account or
   GitHub App is preferred. Current runner consumes a short-lived or rotated
   token in `FUNDLENZ_PUBLISH_TOKEN`, and its exact login in repository variable
   `FUNDLENZ_PUBLISHER_LOGIN`. Scope it only to this repository: contents and pull
   requests read/write, administration read (to inspect protection), checks read.
   It does not need Actions/workflow write, billing or account-wide permissions.
   An App installation token needs a reviewed minting/rotation integration before
   use; an expiring token pasted as a secret is not permanent App automation.
4. Keep `GEMINI_API_KEY` only in Actions secrets. It is passed exclusively to the
   model step. Never add it to source, browser code or Cloudflare client variables.
5. Run the workflow manually and inspect its actual source and model results.
   Confirm required checks attach to the candidate's exact head and the dedicated
   publisher can open a PR without approval-required workflow deadlock.
6. In a reviewed change, set publication flags in **both** `automation/runtime.json`
   and `automation/policy.json` to true and the mode to `automatic_publication`.
   Run an end-to-end data PR, auto-merge and Cloudflare dataset confirmation trial.
   The switch alone cannot bypass protection or identity checks.
7. Validate a real hosting rollback while the temporary workers.dev host is still
   the deployment target. Only then consider the custom-domain migration.

Automated publication is the intended steady state. These are one-time setup and
validation gates, not a request to manually approve every daily update. Source
anomalies and policy changes remain reviewable exceptions.

## Deployment and rollback

Merging triggers the existing connected Cloudflare build. The confirmation job
checks `Workers Builds: fundlenz` on that exact commit, then compares the live
release marker with the expected dataset hash. A validation pass or a merged PR
is not reported as a confirmed deployment. Failure/timeouts save a distinct
deployment artifact; the previous successful worker must remain active.

For rollback, use Cloudflare **Workers & Pages → fundlenz → Deployments → previous
successful version → Rollback**, then revert the corresponding Git data release
through the protected PR process so the next build does not reintroduce it.
Preserve the failed run/audit. Do not “fix” an old snapshot by changing its date.
The local overlay test confirms byte-exact dataset restoration; a real Cloudflare
rollback is an outstanding activation trial, not claimed as completed.

## Maintenance and limitations

Schedules may be delayed, disabled after repository inactivity, or exhausted by
account quotas. Enable GitHub Actions notifications and occasionally inspect
the last successful run. API formats, source URLs and identities can change;
those changes require maintained adapters, not model permission to rewrite code.

Official references used for activation rules:

- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/actions/concepts/security/github_token
- https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow

No claim of indefinite free operation, perfect source accuracy or a fully
automated refresh of unsupported financial fields is made.
