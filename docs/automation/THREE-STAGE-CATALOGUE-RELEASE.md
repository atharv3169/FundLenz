# FundLenz catalogue automation: three focused release stages

This document describes the **automatic financial-data update** pipeline. It does not authorize an AI model to edit repository code, change schema, add new funds, or bypass published-source limits.

## 1. Validate actual official financial data

Scheduled `.github/workflows/catalogue-daily.yml` runs approved-source acquisition, the two bounded Gemini review tasks and `scripts/automation/validate.py`. The independent deterministic source adapters make the final accept/reject decisions; Gemini cannot approve its own suggestions. Verified NAV tuples and complete supported ETF holdings can update independently. Any rejected unit retains its last verified value.

A malformed/missing required model task or critical source-contract error prevents emitting financial update files. An ordinary `PARTIAL` report can still contain independently accepted values.

The **70-test adversarial regression suite** is run on automation-code pull requests in `automation-regression-check.yml` (and can be manually dispatched). It is **not** repeated for each daily data scan. Source/financial validation still happens on every actual run.

## 2. Publish precisely the approved bytes

The isolated publisher checks its validated artifact's explicit permission, allowed file paths, checksums, old/new dataset hashes, real financial change versus audit-only classification, update-date linkage, authorized publishing identity, and current protected `main` base. It proposes a data-only GitHub PR. It does **not** repeat the complete validator inside the publisher.

Before automatic merge, the independent trusted `catalogue-data-gate.yml` runs the authoritative replay of the original official source bytes through the same validator, compares the exact output manifest, checks the PR's files and their complete byte contents, and performs portfolio-data/finance regressions against the proposed dataset. The required GitHub checks and strict protected-`main` settings must pass; a stale or altered base/head fails closed.

This is not a second set of competing financial rules. It proves that the **bytes proposed for publication** are exactly those that the validator approved.

## 3. Confirm the actual Cloudflare deployment

After merge, `catalogue-deployment.yml` confirms a real financial change against the exact approved dataset marker and `lastCatalogueUpdateDate` served by Cloudflare. A green build alone is insufficient. Audit-only releases do not claim any new financial publication and do not advance the site's date.

The website displays only the verified date, e.g. **Last catalogue update · 9 October 2026**. It does not display accepted/rejected-value counts. Individual fund NAV and holdings as-of dates remain separate.

## Non-negotiable safeguards retained

- The model has **no repository write access** and cannot change validation rules.
- The publisher can write only allowlisted data/audit paths and cannot modify application code.
- Source hashes, identities, dates, data types, complete ETF holdings and source provenance are checked.
- An unsuccessful collection, malformed Gemini response, failed trusted gate, unauthorized actor, changed PR, stale release date or unavailable exact deployment blocks the relevant publication/confirmation stage.
- Manual test dispatches remain audit-only by default; scheduling and model/data limits are unchanged.
- User-facing domain, privacy, blog, D1, visitor data, all fund values and Cloudflare configuration are unaffected by this refactor.

## Failure investigation

The daily run retains a durable source-cadence/state artifact and a time-limited detailed audit artifact. A validator issue appears in the audit rather than silently deleting an existing fund value. A failed publishing gate leaves an unmerged PR for inspection. A failed deployment check reports **unconfirmed**, never pretends financial data are live.

This change removes **redundant expensive work**, not the independent evidence chain needed to trust automatically published finance data.
