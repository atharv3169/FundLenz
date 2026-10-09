# Task A — fresh authoritative-source catalogue scan

Apply `gemini-system-prompt.md` without modification. Set `task_type` to `fresh_scan`.

Inputs supplied by the runner: run ID, base dataset hash, approved source registry, due source packets and retrieval status, affected existing catalogue records, publication cadence, field/identity definitions and output budget. You are not responsible for inventing missing input packets or fetching the entire catalogue in one response.

1. Enumerate the supplied due sources and their actual retrieval outcomes. Distinguish unchanged content from unavailable/deferred/partially retrieved content. Record scope honestly.
2. Examine the real source dates and exact identities. Newer content does not automatically mean a newer reporting period. Distinguish monthly/fortnightly statements and listings/registries/holdings.
3. Compare only like-for-like fields, units, currencies and identities against the last verified records. If there is no supported change, return no proposal for that unit; include the source-check outcome.
4. For supported changes, return candidates grouped by the complete atomic unit requested by the adapter. Each includes prior and proposed values, source URL/hash supplied by the runner, exact row/page/sheet/JSON location, date and reason.
5. Preserve analytical scope. Reference-only stocks/bonds and international fund records do not become selectable portfolios merely because their records changed. No live quotes, yields or historical performance may be inferred from catalogue updates.
6. Escalate new/unmatched identities, apparent closures, conflicting dates and unfamiliar layouts for investigation. Do not remove a record solely because a source omitted it.
7. Return the strict candidate document. Keep false-positive/extraction investigation for the recovery task when there is a previous issue, while allowing newly discovered warnings to be reported here.

The runner, not this response, reconciles your output with Task B and computes final reports, production files, counts and issue states. A run finding no changes still requires evidence of what was actually checked.

## Practical response sequence (Task A)

- First enumerate **only** the actual sources in `inputs.sources` and echo
  their seven provided metadata fields into `source_checks`. This includes
  sources with outcome `unavailable`, `deferred` or `budget_exhausted`
  if they are present; an unsuccessful fetch never becomes `checked_unchanged`.
- Next review `inputs.sample_adapter_decisions` and any corresponding
  `actual_source_rows`. A 700-character excerpt is not full-source evidence.
  Only propose a value when the supplied record supports the exact identity,
  atomic unit, source date, source hash and field units.
- Every proposed `evidence[].source_url`, `source_sha256` and
  `retrieved_at` must match one of the supplied checked source packets.
  Distinguish `source_period` from retrieval time. Never construct a hash.
- A blocked proposal requires escalation, not manufactured correction. For
  an unchanged source or a source you cannot establish, use no proposal and
  summarize the limitation; do not list guessed unchanged values as discoveries.
- Count `source_checks` against `inputs.sources` *before* finalizing,
  then return a single exact candidate-schema JSON document. Never shrink
  the source ledger to save response tokens; reduce the number of proposals
  instead (zero is acceptable).

