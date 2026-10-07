# Agreement-to-file traceability

**Implementation update — 7 October 2026:** The version-1 agreement below is retained. The source runner, two Gemini tasks, deterministic NAV/international-holdings validator, persistent audit/state, protected publisher and deployment observer are now implemented. Scheduling is dry-run only; publication is disabled. See [the operating guide](../docs/migration/AUTOMATION.md) for exact coverage, tests, budgets and outstanding activation gates. Historical statements saying “not yet implemented” describe the bootstrap, not the current code.


These are requirements, not claims that the live automation exists. `OPERATING-SPEC.md` is authoritative; implementation is staged after this bootstrap.

| ID | Agreed rule | Location / verification |
|---|---|---|
| R01 | Preserve website appearance and functions | Baseline manifest, migration parity checks; existing finance/UI files retained |
| R02 | Separate data from application code | `public/data/`; data policy and protected paths |
| R03 | Two daily tasks | Master prompt plus daily-scan and re-investigation prompts |
| R04 | Authoritative evidence only | Master prompt, candidate evidence contract; runner source checks still to implement |
| R05 | Validator warning is not ground truth | Both master and re-investigation prompts |
| R06 | No fabricated correction to pass a test | Master prompt and specification sections 3–6 |
| R07 | Extraction error, false positive, unresolved outcomes | Candidate schema `finding`; recovery prompt |
| R08 | Model cannot alter rules or production | Policy and specification trust boundary; credential separation required at activation |
| R09 | Retain last verified values on failure | Specification sections 5 and 7; publisher/reconciler required |
| R10 | Independent valid funds can update | Atomic-group contract; shared-file rebuilding required |
| R11 | No mixed holdings periods within a fund | Atomic-group rule; retain common-date analysis restriction |
| R12 | Newest verified snapshot wins | Reconciliation requirement; conflicts block |
| R13 | Complete provenance and old/new values | Candidate schema and audit schema |
| R14 | Persistent unresolved queue | `audit/open-issues.json`, seeded with four existing inconclusive source checks |
| R15 | Count attempts, escalate repeated failures | Policy 1/3/7 thresholds with cadence-aware staleness |
| R16 | Latest report overwritten, history retained | Audit contract and Git versioning specification |
| R17 | Strict machine-readable output | JSON Schema and positive/negative contract checks |
| R18 | Sanitized updates alone reach auto-merge | Workflow specification; automatic publisher not yet enabled |
| R19 | Protect UI/calculations/configuration | Policy and CODEOWNERS; enforce with repository rules at activation |
| R20 | PASS/PARTIAL/FAIL/NO_CHANGE | Audit schema and explicit status semantics |
| R21 | Optional human review, no daily manual merge | Steady-state workflow; no conversational approval trigger |
| R22 | Keep secrets out of public files/model input | Master prompt and credential separation requirements |
| R23 | Rollback and exact deployed dataset | Deployment specification, manifest hashes |
| R24 | Check date is not snapshot date | Schema, prompts, retained source dates |
| R25 | Preserve every small instruction in version control | All specification/prompts/contracts are shipped in the same package |
| R26 | Handle skipped/failed checks honestly | Source-check states, audit scope and unresolved queue |
| R27 | No silent permanent stale-data retention | Escalation requirements and source-cadence tracking |
| R28 | No early overpromise about free plans | Activation gates and verified platform notes |

## Required end-to-end cases before activation

1. Two failures yesterday, one today: publish the newly verified unit; retain the still-blocked unit; preserve issue history.
2. Two failures yesterday, three today: only accepted independent units change; no blanks or unverified values enter production.
3. An old correction races a new snapshot: the newer independently verified snapshot wins.
4. Only one holding in an incomplete portfolio is recovered: retain the complete previous portfolio.
5. Strong evidence contradicts a threshold: open a rule review; no self-approved exception.
6. Same-date sources disagree: block the affected unit and retain evidence.
7. Request timeout, quota exhaustion, source layout change or malformed JSON: retain data and record actual incomplete scope.
8. A candidate attempts to change CSS, calculations, workflow, paths or validator rules: reject before execution.
9. A previous issue is skipped today: keep it without fabricating a new attempt.
10. Concurrent production change invalidates the base hash: re-reconcile and revalidate before publishing.
11. All candidates fail: store an honest audit without modifying production data.
12. Build/deploy fails: previous hosting deployment remains active; report says deployment failed.

These are acceptance cases for the future runner, not completed tests of a working daily updater.

## Implemented verification — 7 October 2026

- `scripts/automation/tests/test_pipeline.py`: 32 adversarial tests cover strict dates/JSON, exact source and identity rules, full-portfolio rejection, independent partial NAV updates, invented evidence and rule overrides, issue persistence/escalation, skipped/idempotent attempts, source recovery, quotas/service retry caps, protected paths, base races, hash tampering and byte-exact rollback overlays.
- Existing six finance/catalogue suites pass (620,894 counted checks plus directory checks), as do type checking and the 17 original contract checks.
- First live GitHub run collected actual source bytes and saved a failure audit when Gemini returned 503. No production data changed.
- Still outstanding: owner-configured protected main and dedicated publisher identity; activation of publishing; real PR/auto-merge/deployment/hosting-rollback trials; financial extraction adapters for monitoring-only catalogue sources. These are not represented as completed by the unit tests.
