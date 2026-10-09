# FundLenz Gemini/daily-catalogue reliability review — 9 October 2026

Status: **draft maintenance PR**. No financial data, approved source allowlists, production Worker, Gemini credential, D1 records or protected `main` modified by this review. Live integration still requires an explicit run.

## Observed failures (GitHub Actions)

- [37600951938](https://github.com/atharv3169/FundLenz/actions/runs/37600951938): Gemini Task A and Task B failed with HTTP 503. This was a provider/API availability problem, not permission to publish unreviewed values. The run saved a FAIL audit and retained production values.
- [37671244082](https://github.com/atharv3169/FundLenz/actions/runs/37671244082): both model calls completed, but Task B failed independent validation: `Model source coverage incomplete`. The honest FAIL audit retained production data.
- [37671876986](https://github.com/atharv3169/FundLenz/actions/runs/37671876986): Task A failed while Task B completed; a previously recorded oversized source URL in the issues queue caused a validation error. The downstream publisher ran but found nothing eligible.
- [37672720902](https://github.com/atharv3169/FundLenz/actions/runs/37672720902): both Gemini tasks completed and validated. The report was correctly marked PARTIAL because of unavailable sources, budget-limited source discovery and outstanding issues.
- [37766860766](https://github.com/atharv3169/FundLenz/actions/runs/37766860766): six stale adversarial tests failed before acquisition; the unconditional downstream publisher also failed trying to read a missing `work/result/release.json`. Not a Gemini failure. The preceding PR's test-fixture repair already addressed the evolving dates and queue assumptions.

**GitHub jobs versus model tasks:** A workflow has two jobs (`collect`, `publish`). Inside the first job Gemini performs two different model tasks (`fresh_scan`, `reinvestigation`). GitHub's 1-of-2-jobs failure message does not prove Gemini itself failed.

## Current reliability patch

1. Publishing job now depends on `needs.collect.result == 'success'`. It cannot run when validation failed and the required release artifact is absent.
2. Routine source/model pipeline runs are triggered by the scheduled GitHub Actions event or an explicit `workflow_dispatch`, not by commits to automation code and prompts. The daily schedule remains enabled.
3. Master and task-specific Gemini prompts now require complete, exact seven-field source-ledger echo, bounded proposals, honest interpretation of excerpts and self-checking against the strict schema.
4. Model response is rejected **before** storing an accepted candidate if its schema, run identity, timestamps, proposal count or source metadata is incomplete or altered. The independent validator retains its own checks.
5. One corrective Gemini retry is permitted on bad JSON/incomplete model output, with concrete validation feedback; one existing transient 5xx retry remains available. Total cap remains two calls per task (four per daily run). Neither failure is considered success.
6. Added regression tests for metadata fidelity, rejected fabricated metadata, bounded retries, downstream publish gating and scheduled-only execution.

## Gemini instructions and safety rules

Master: [`automation/gemini-system-prompt.md`](../../automation/gemini-system-prompt.md).

Task A: [`automation/gemini-daily-scan.md`](../../automation/gemini-daily-scan.md).

Task B: [`automation/gemini-reinvestigation.md`](../../automation/gemini-reinvestigation.md).

Gemini is a **read-only, untrusted candidate analyst**. It cannot fetch unspecified sources, certify its own source hashes, update code, bypass the protected publisher, rewrite audit history, change the displayed financial values or infer unsupported NAVs/holdings. The complete source ledger is a faithful echo of runner retrieval metadata, **not** a claim that Gemini checked every row in those files.

For every task, Gemini must return exactly one candidate-schema JSON object. It must copy every packet source's `source_id`, `source_url`, `checked_at`, `outcome`, `source_sha256`, `reason` and `scope`, with no omissions or substitutions. Proposals must be evidence-backed and limited to the packet. Missing evidence should yield no proposal, never an invented correction. For Task B, preserve the supplied issue IDs and report uncertainty truthfully.

## Outstanding integration checks (do not claim solved)

- Trigger one explicit manual daily run after merge. Verify that Gemini credentials and provider quota permit both bounded calls and that their JSON responses validate. Do **not** print keys or response bodies to Actions logs.
- Inspect the actual source ledger and any unavailable/oversized URLs through the retained private audit artifact. Never relax URL restrictions just to make a run green.
- If HTTP 503 or 429 persists, verify Google's service/quota status for the *configured project and model* before altering billing, model name or allowed retry budget. The local test cannot guarantee provider availability.
- Verify publication on a known valid, limited data change through the protected source-replay PR gate. Never force a merge or publish on a failed task.
- The deployment confirmation workflow has previously seen HTTP 403; an Actions build pass is not proof that the exact dataset reached the live domain.
- Keep `main` protected and obtain passing CI for this maintenance PR. A prompt cannot guarantee correct model output; the transport checks and independent validator remain mandatory.

## Interpreting future notifications

- **GitHub collect FAIL:** inspect the failing step and the `fundlenz-audit` artifact.
- **Gemini HTTP 503 or 429:** service/quota degradation, no data publication; prefer bounded retry and explicit alert, not fictitious `NO_CHANGE`.
- **Gemini invalid JSON/ledger:** exactly one corrective retry; if it still fails, retain the last verified values and preserve an incident report.
- **Source coverage PARTIAL with both models validated:** not inherently a failed build; report missing/unavailable source scope honestly.
- **Publish skipped after collector FAIL:** expected and safer; not an independent publisher outage.
