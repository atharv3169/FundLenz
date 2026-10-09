# FundLenz — catalogue resilience and release contract

**Status:** reviewed code candidate in draft maintenance PR #9. This is an engineering fail-safe design, **not** a guarantee against all future upstream failures. Never grant Gemini GitHub access or bypass the independent exact-head gate.

## Objectives and non-negotiable invariants

1. Keep the last complete independently verified value if **any** component is unavailable or evidence is ambiguous.
2. Distinguish a trusted **retrieved source**, a **model observation**, an **independently accepted atomic update**, an **exact-head checked GitHub merge**, and a **confirmed Cloudflare deployment**. The statuses are not interchangeable.
3. Preserve unchanged plan values and whole fund snapshots; never delete a fund or portfolio because a source was missing.
4. A model, retrieved PDF/CSV, error body, previous model output and other remote data are untrusted and cannot authorize code changes or production updates.
5. Data must be independently reproduced from saved bytes, with exact hashes/paths, before code-protected publication.
6. Any real verified financial change must advance the **Last catalogue update** date to its India-local verification day in the same hashed release. Audit-only/no-op/failed runs must not move it. The visible date is not an individual fund's NAV, holdings or document date.
7. A release prepared on an older or future India-local day must not merge with that date pretending it is today's publication. Re-acquire and revalidate on a fresh baseline instead.
8. GitHub build success does not prove Cloudflare has served the new dataset. Confirm both the release marker and visible catalogue metadata from the exact deployed Worker, or mark deployment unconfirmed.
9. Maintain the protected main branch and release-manifest checks on code changes; never disable tests to produce a green build.

## Trust and data-flow diagram

```text
[Approved source registry]
          |
          v
[Read-only downloader: time, URL, SHA-256, raw bytes]
          |
          v
[Deterministic existing-plan NAV / entire issuer holdings adapters]
          |                           \
          |                  [Bounded Gemini Task A & B]
          |                    proposals + explanations only
          v                           /
[Strict cross-source validator, issue reconciliation, complete units]
          |
          +-- fail/partial with unresolved evidence --> Retain old production bytes and open issues
          |
          v (validated, source-derived atomic changes only)
[Build manifest + site update-date + dataset hash + audit marker]
          |
          v
[Trusted publisher replay, exact base check, protected paths and identity]
          |
          v
[Data-only PR; trusted base-branch source replay and required statuses]
          |
          v
[Merger: exact commit, actor, checks, protection, fresh date, no drift]
          |
          v
[Cloudflare Workers build + exact release marker + live metadata check]
          |
          +-- failure / 403 / stale cache --> Deployment NOT confirmed; preserve report
          v
[Confirmed deployed financial data]
```

## Failure matrix and automated recovery

| Failure | Detection | Automatic response | Escalation / no-go |
| --- | --- | --- | --- |
| Google API transient 500/502/503/504 | HTTP status in bounded model task | One capped service retry, then issue an honest FAIL | Do not publish. Keep audit, check service status |
| Google API 429 or credential 401/403 | HTTP status | Do not hammer quota or change billing | Human reviews AI Studio quotas/key permissions |
| Gemini JSON malformed/truncated | Strict JSON decoding and schema | One corrective prompt retry with reduced proposal count | Retain old data if still invalid |
| Missing model source checks | Exact seven-field ledger/ID equality | Same bounded corrective retry | Model's claim never replaces trusted downloader |
| Model source URL/hash/date manipulation | Independent exact ledger equality | Reject task without saving accepted candidate | Preserve source evidence |
| Model prompt injection from source | Source packet marked untrusted, no tools/keys | Ignore injected actions, return evidence only | Never provide Gemini publish/merge token |
| Source host 404, timeout, HTTP redirect or non-public destination | Exact allowlist, DNS IP checks, 15s deadline | Mark unavailable; don't follow unapproved redirect | Require human-reviewed allowlist change |
| Source encoding/header/schema drift | Deterministic parser checks | No speculative column shift; block that source | Reviewed parser update and offline test |
| Truncated official CSV/PDF | Byte length and parser/EOF checks | Retain last complete snapshot | Investigate source completeness |
| Source checksum mismatch | SHA-256 over exact downloaded bytes | Reject evidence or replay | Never use a model-provided hash |
| NAV null/zero/NaN/Infinity/outlier | Numeric, date and relative-change gates | Preserve existing NAV/date tuple | Source-backed exception requires reviewed rule |
| Holdings empty/truncated/inconsistent | Whole-portfolio parsing and row-count guard | Reject entire portfolio, not just a row | Human review issuer layout/corporate events |
| New scheme/share class/ISIN/ticker identity | Exact identity and no automatic lifecycle changes | Quarantine as unmatched | Separate reviewed adapter |
| Conflicting same-date valuation | Chronology and conflict rule | Keep previously verified value | Verify official correction independently |
| Older disclosure arrives late | Field date comparison | Keep newer complete published snapshot | Record correction for historical analysis only |
| Missing/duplicate source records | Strict ledger and duplicate-code rejection | No deletion or silent overwrite | Source/coverage incident |
| Unexpected country/currency/weight conversions | Full raw units, source classification checks | Block corresponding atomic change | Review parser and methodology |
| Unknown security identity across funds | Cross-portfolio identity check | Block conflicting complete candidate | Human source-level review |
| Missing persistent state | Durable artifact restoration | Fail closed; retain last reviewed release | Recover verified state; do not reset issue history |
| Large issue queue | Bounded source/issue scheduling | Rotate across days; preserve unselected issues | Human review on repeated unresolved checks |
| Model succeeds but validator fails | Independent contract and source comparison | No financial output; write failure audit | Review evidence and rules; do not weaken thresholds |
| Date-only/no-data release | Financial path diff detection | Preserve catalogue-update date | Never refresh date because a job ran |
| Valid one-record change | Accepted supported atomic unit | Build data, date metadata and hash in one release | Reject incomplete date bundle |
| Date from a previous/future India-local day | Merge-time check against current India-local day | Reject stale data PR | Re-run on fresh source/base |
| PR base changed while validation runs | Exact base/head check each merge attempt | Abort candidate | Re-run on current main |
| PR contains code/symlink/unlisted/delete | Allowlists, data-only byte comparison | Reject PR before merge | No broad rights or bypass |
| Required CI pending/failed or wrong actor | Protected gates, check IDs, publisher identity | Do not merge | Fix on new PR; never force push |
| Cloudflare build fails | Worker build check | Deployment not confirmed | Fix build; rollback if needed |
| Worker reports stale release/data or HTTP 403 | Cache-busted exact live release/metadata GET | Deployment not confirmed | Verify URL, auth, DNS, Worker settings; do not claim live |
| Rollback needed | Version history and recovery playbook | Restore last known good Worker version | Storage/D1 separate from Worker versions; validate compatibility |

## Catalogue update date contract

**Before a verified change:** existing `public/data/site-metadata.json` preserves `catalogueSourceCheckDate=2026-10-05`. This is a historical source-check baseline, not a promise of current market prices. If `lastCatalogueUpdateDate` has not yet been recorded, the UI does not fabricate one.

**On the first accepted updated NAV or complete holdings snapshot:** the validator stages `lastCatalogueUpdateDate` and `lastCatalogueUpdateRunId` in that same source-backed `public/data/site-metadata.json` overlay; includes the new label in `public/build-info.json`; updates `public/automation-audit/release.json` with `lastCatalogueUpdateDate` and `financial_data_changed=true`; computes one dataset hash over all data files, including the date. The Indian and international catalogue headers then display the new date after the Worker serves the new release.

**Audit-only/no-op/failed Gemini:** the value remains unchanged. The website must never imply a new NAV date or full-source-refresh date based solely on this label.

**At merge:** `scripts/automation/merge.py` fetches the marker and site metadata from the exact checked Git head and rejects any data release that was prepared for a different India-local day. This prevents a validated-but-delayed PR from displaying yesterday as today's publication.

**After deployment:** `scripts/automation/deployment.py` verifies both the exact public release marker and the public metadata's date/run ID. A 403, invalid response, outdated Worker or wrong domain keeps deployment status unconfirmed, even if GitHub merging succeeded.

## Validation layers

- **Layer 1:** immutable source identity, trusted downloader IP/URL restrictions, size/time caps, cryptographic raw-source evidence.
- **Layer 2:** deterministic financial parsing: identity, date, currency, complete atomic NAV tuple or complete fund holdings, no inferred normalization.
- **Layer 3:** Gemini schema/ledger check and bounded corrective retry; observations are never direct financial updates.
- **Layer 4:** issue ledger and independent validation of candidate against actual source-derived units; changes with unresolved conflicts are blocked.
- **Layer 5:** protected `publish.verify_release` confirms manifest paths, exact bytes, candidate/base dataset SHA-256, data-change truthfulness, unchanged original source baseline and matching site-date markers.
- **Layer 6:** `pr_gate.py` permits publication only from a **successful** known scheduled/manual trusted collection run and replays validation on main.
- **Layer 7:** `merge.py` rechecks publisher identity, branch protection, exact main/head, required checks and the release date.
- **Layer 8:** Cloudflare deployment observer independently reads real live assets. Storage/D1 changes are not rolled back with Worker code.

## Before shipping this maintenance PR

1. Pass the Python adversarial test suite including new producer-success, one-record date, no-op date, tampering, stale-merge, and live deployment-date cases.
2. Pass data gate, exact reviewed release integrity and TypeScript/blog build regression jobs on the **same** commit.
3. Review the two exact catalogue UI changes against the frozen release manifest. Do not rebaseline financial files.
4. Verify the Gemini model is still supported, the configured project has quota, and the JSON contract works in an isolated real request. Do not alter billing/key without explicit owner approval.
5. Merge only through GitHub's protected reviewed PR route.
6. Trigger a controlled subsequent daily run with known small change when safe. Verify `collect`, Gemini A/B, source data PR, trusted exact-head merge, Worker build, and live date match. This remains outstanding until observed; CI mocks alone do not prove external service availability.
7. Keep the audited last-good commit and previous Cloudflare version; make rollback a separate recorded operation if needed.

## Official references

- Google Gemini 3.1 Flash-Lite model (supported ID and JSON output): https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite.md
- Gemini API troubleshooting and bounded backoff: https://ai.google.dev/gemini-api/docs/troubleshooting
- Gemini structured output JSON schema support and limits: https://ai.google.dev/gemini-api/docs/structured-output
- GitHub privileged `pull_request_target` security: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- GitHub protected required checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Cloudflare Worker version/deployment separation: https://developers.cloudflare.com/workers/versions-and-deployments/
- Cloudflare Worker rollback (D1 storage not versioned): https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
