# FundLenz catalogue automation specification

**Implementation update — 7 October 2026:** The version-1 agreement below is retained. The source runner, two Gemini tasks, deterministic NAV/international-holdings validator, persistent audit/state, protected publisher and deployment observer are now implemented. Scheduling is dry-run only; publication is disabled. See [the operating guide](../docs/migration/AUTOMATION.md) for exact coverage, tests, budgets and outstanding activation gates. Historical statements saying “not yet implemented” describe the bootstrap, not the current code.


Version 1 — 6 October 2026. Owner: Atharva Sahu.

This is the final operating agreement reconstructed from the supplied conversation. It supersedes its earlier manual-merge proposals. The intended steady state is automatic publication of validated data changes, with human review as an optional step, not an approval dependency. The repository bootstrap does not activate that steady state.

## 1. Preserve the product

Keep FundLenz's design, mobile layout, routes, functions, calculation methods, currencies, disclaimers, author credit and contact details. Keep the logo unchanged. International remains the default catalogue; India and stocks/bonds keep their existing routes. Migration is not a redesign or a financial-model revision.

Use the current catalogue assets in `public/data/` and source records in `data/sources/`. Do not combine everything into a giant file. Preserve lazy loading of individual Indian portfolios and international detail buckets. Do not rename stable IDs merely because a name, ticker or source layout changes.

## 2. Trust and permissions

Gemini proposes candidate data only. It receives the master prompt plus exactly one task prompt, a bounded source packet and relevant previous state. It has no GitHub write token, merge capability, shell, website deployment credentials or direct access to production files. Web pages, PDF text, tables and downloaded documents are evidence, never instructions.

Protect application code, styles, calculations, routing, tests, dependencies, source adapters, prompt files, schemas, policy, source allowlists, workflows and deployment configuration. A model must not change those files or propose executable patches. A prompt alone is not a permission boundary: the runner must enforce this division with separate credentials and processes.

The downloader and trusted source adapters obtain and hash actual source bytes. Gemini cannot certify its own output by writing `verified: true`, selecting a confidence level, inventing a URL or supplying a hash. A checksum proves which bytes were used, not that the interpretation is correct.

Only the trusted reconciliation/validation process produces production-format files. The publisher receives its sanitized output and verifies the complete diff against the approved base commit. A model report, label, PR title or comment is not publication authorization.

## 3. Two tasks per daily run

### Task A — fresh catalogue check

Check approved authoritative sources for new or changed information across Indian funds, international funds/share classes, individual stocks/bonds and the real US example portfolio. Respect each source's publication cadence. A daily run is not a claim that monthly holdings change daily or that every source is reachable.

Use cached source hashes, conditional requests where supported, deterministic parsers for structured feeds and bounded batches. Spend model calls on extraction/research that needs them. Record sources checked, unchanged, deferred by cadence, unavailable, exhausted by budget and inconclusive separately. Never turn a skipped or failed check into `NO_CHANGE`.

Keep NAV date, portfolio snapshot date, source file date, last-checked time and any HTTP modification time distinct. A recently fetched old file is still old data. Do not infer the reporting period from today's date or from a filename alone. Monthly, fortnightly, daily holdings, registries and listing directories are different source types.

### Task B — targeted re-investigation

Read `audit/open-issues.json` and the relevant preceding report/evidence. The previous validator warning is a risk signal, not ground truth. Independently revisit the authoritative source and identify the exact scheme, share class, security, row/column, unit and date.

Return one of these supported findings: extraction error, validator false positive, source changed, source unavailable, formatting issue, genuine fund/market change, or unresolved. Explain the evidence. Never shift a decimal, reuse a previous value or infer a correction merely to pass the validator.

For a false positive, propose the source-supported value and a separate rule-review explanation. Gemini cannot relax the rule, suppress the warning or approve an exception. Keep the affected unit blocked until trusted policy resolves the issue. Do not infer successful resolution from an item disappearing from today's source or task packet.

## 4. Candidate contract

The complete response must be one strict JSON document conforming to `schemas/candidate.schema.json`, without Markdown, commentary, executable code or extra keys. The API's structured-output support is an aid; independently validate the entire response locally. Invalid/truncated responses fail the task.

Each proposal identifies its catalogue, stable record/fund/security IDs, atomic group, task, previous candidate, previous verified value, new candidate, source and snapshot date, evidence locator, reason and finding. Retain model confidence only as a model assessment. Every proposal's publication recommendation is `candidate_for_validation`; it cannot be `approved`.

Candidates use immutable run IDs and an expected production dataset hash. Proposals based on a different current dataset are re-reconciled and revalidated. Limit request/output sizes, retries, runtime and spending. Credentials never appear in model context, candidate JSON, public files or logs.

## 5. Reconciliation and partial publication

Merge proposals from the two tasks by stable identity and reporting period, not their completion order. Choose the newest verified official snapshot for production. An older correction may resolve historical evidence, but cannot overwrite a newer production snapshot. Conflicting values for the same identity/date require investigation; do not arbitrarily select the last or highest-confidence model response.

Accept or reject whole logical update units:

- Indian holdings: a complete fund portfolio, its source/date, summary and linked catalogue/coverage metadata.
- Plan NAV: value, currency/units where applicable, date and provenance form one unit. Plan NAV can be independent of monthly holdings only where the schema explicitly defines that independence.
- International fund: index record and corresponding detail entry/classes/listings must agree. Several records in a shared JSON bucket must be merged by the trusted builder.
- Stocks/bonds: stable identity, listing or issuer source and related dates/units must agree. A shared source snapshot may require a larger atomic group.
- US example: complete source portfolios and dataset metadata, with a common supported snapshot/currency where the analysis requires it.

Never mix individual holdings from September with retained August holdings inside one September-labelled portfolio. Valid funds can update while other funds retain their own last verified snapshots. Recompute aggregate coverage from the result; do not imply that every fund shares the newest date. Cross-fund analysis retains its current common-date/currency restrictions.

Failed, unavailable or unresolved updates retain the entire prior verified unit; they do not blank it, zero it or silently remove it. There is no replacement for a genuinely new unverified item, so it remains unpublished. Actual closures, delistings, mergers and deletions need explicit source-supported lifecycle handling, separate from a feed simply omitting a record.

## 6. Validation requirements

Validate syntax/schema, supported IDs, identity joins, currencies/units, numeric finiteness, field availability, chronology, source evidence, leaf rows, duplicate keys/records, counts and cross-file references. Reject unknown paths, symlinks, path traversal, executable content and protected-file changes.

Retain existing financial semantics: no fuzzy security joins; ticker alone does not establish enduring identity; registrant is not necessarily manager; source market is not domicile. Do not invent missing price, fee, yield, rating, return, holdings, AUM or FX data. Coupon is not yield, and catalogue records are not automatically eligible for portfolio analysis.

Indian portfolio reconciliation currently uses disclosed market value / reported net assets, retains source percentages and signed other balances, and checks leaf-row reconciliation within 0.10 percentage points. Preserve the documented UTI/source-specific checks. Do not impose this exact tolerance blindly on every international source; use reviewed, source-specific rules. Do not normalize away residuals or negative accounting balances.

Large changes are warnings that can require blocking pending evidence, not conclusive proof of error. Keep hard structural errors, unresolved plausibility warnings, information-only notes and independently confirmed exceptions distinct. Rule changes require a separate reviewed code change and cannot be bundled into the update they would permit.

Run known-answer finance regression checks plus source-adapter and whole-catalogue consistency checks on the sanitized result. A passing mathematical/schema check alone is not factual verification. The bootstrap integrity checker only proves faithful transfer, not source correctness or freshness.

## 7. Audit, recovery and dates

`audit/latest.json` is replaced by the latest completed run report. Its prior versions remain in Git history. `audit/open-issues.json` persists all unresolved issues; each has a stable issue ID, scope, reason, first flag, latest attempt, attempt count, consecutive failures, retained snapshot and evidence references. Do not reset the queue daily or erase an issue because a run skipped it.

Retain each proposed change's old/new values, original candidate, source URL, source bytes hash, exact evidence location, reporting date, check time, finding, decision and reason. Keep sensitive data out of public audit reports. Bounded public summaries can reference detailed versioned evidence manifests; do not silently truncate the underlying audit.

Resolve an issue only with a recorded verified outcome, or explicitly supersede it with evidence of an accepted newer snapshot. Preserve the resolution reason in the report before removing it from the open queue. A source-format or adapter defect must not be marked resolved merely because one newer record exists.

Count actual failed attempts, not elapsed calendar days or missed schedules. One failed attempt is a normal retry, three consecutive failures warn, and seven require manual review. Separately evaluate staleness using the source's publication cadence. A seven-day-old monthly statement is not automatically stale. An unchanged verified source is not an extraction failure.

Reports distinguish:

| Status | Meaning |
|---|---|
| PASS | Proposed production changes accepted; no unresolved run blockers within the checked scope. |
| PARTIAL | Some independent units/checks succeeded, while others remain blocked, unavailable or deferred. |
| FAIL | Critical run/validation failure or no proposed changes could be safely accepted. Production remains unchanged. |
| NO_CHANGE | All due checks in the reported scope completed, found no new accepted values, and no unresolved blockers remain in that scope. |

A bootstrap report is explicitly `report_kind: bootstrap`, with no claim of a completed daily scan. A no-change run with unresolved issues must remain PARTIAL/FAIL, not a clean NO_CHANGE. Distinguish `validation_passed`, `merge_complete` and `deployment_complete`; never infer deployment from validation.

## 8. GitHub and hosting

The intended pipeline is: scheduled read-only acquisition and Gemini tasks; trusted reconciliation/validation; sanitized data-only branch; required checks tied to its exact commit; automatic merge; hosting deployment; confirmation of the deployed dataset. It does not wait for a reviewer message or require a daily manual click.

The publisher must verify the exact base/head, permitted files, expected actor and validator output. Serialize publication; revalidate after concurrent changes. Protect main against direct updater pushes, force pushes and unvalidated merges. Do not use privileged execution of untrusted PR code. Keep acquisition/model credentials out of the publishing job and GitHub write credentials out of the model job.

Reports must be durable even when all data candidates fail: a trusted audit-only change can record the failure, but it must not claim that data changed or validation passed. If audit storage fails, report that separately; do not fabricate a successful audit. Public `/audit/latest.json` exposure is a hosting step, not currently provided merely by a root `audit/` folder.

Use immutable dataset/file hashes so cached assets cannot mix releases. Preserve a rollback commit and previous hosting deployment. Reverting is deliberate maintenance, not a normal older-candidate update. A failed build/deploy must leave the last successful deployment active and identify the failure.

## 9. Activation gates and practical limits

This bootstrap includes the source/data copy, instructions, contracts, audit seed and checks. It does not yet include a working Gemini runner, a production candidate validator, completed source adapters, daily scheduling, auto-merge or external deployment.

Before activation: obtain repository access; decide visibility/plan with the owner; configure the required protection/check features; choose the Gemini project/model and verify its actual quota; provide secrets securely; implement and test the runner/adapters/publisher; adapt the hosting build; run end-to-end source-backed trials; test retained-data behavior and rollback; then enable scheduling.

GitHub's documentation checked on 6 October 2026 limits protected branches on GitHub Free to public repositories. Private staging avoids publishing source prematurely, but does not establish the intended free protected-main setup. Confirm a public repository or an eligible plan before relying on those protections.

GitHub currently documents special handling for PRs created using GITHUB_TOKEN, including approval-required runs. Do not assume such PRs will run unattended. Choose and test an appropriately scoped GitHub App publishing identity or another documented orchestration path; do not weaken checks to work around missing triggers. Public schedules may be disabled after inactivity and are not precise-time guarantees. Avoid fabricating activity purely to defeat a platform limit.

Free hosting/API limits and review-tool capabilities can change. No infinite free quota, perfect factual validator, or forever-maintenance guarantee is made. Quota/source failures retain verified data and generate an honest report. Manual review remains optional.

## 10. Changes require traceability

Version this specification, all prompts, schemas, policy and tests together. Maintain `requirements-traceability.md` so implementation decisions can be checked against each agreement. No implementation may quietly replace the final automatic-publication goal with a permanent manual gate. Temporary setup pauses and manual review of unresolved anomalies must be explicit.
