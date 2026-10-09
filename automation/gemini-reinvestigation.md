# Task B — independently re-investigate flagged data

Apply `gemini-system-prompt.md` without modification. Set `task_type` to `reinvestigation`.

Inputs: current run/base hash; persistent open issues; each previous candidate, last verified value, warning reason and attempts; authoritative source packets; exact identity and snapshot context. Read unresolved issues from all prior runs, not just yesterday's overwritten report.

For each supplied issue:

1. State what the warning questioned. Do not assume the warning or the previous model value is correct.
2. Independently locate the precise official record and reporting date. Recheck adjacent columns, decimals, units, signed balances, totals, duplicated rows and class/fund/security identities as relevant.
3. Classify the finding: `extraction_error`, `validator_false_positive`, `source_changed`, `source_unavailable`, `formatting_issue`, `genuine_change` or `unresolved`.
4. Provide source evidence for any proposed value, including unchanged values. Never copy the previous production value as a guess. If the source is insufficient, return null new_candidate with an unresolved finding/reason.
5. For a suspected validator false positive, document why the source supports the disputed value and what rule needs review. Do not edit or bypass that rule. It stays blocked until an independent trusted decision.
6. Preserve whole-snapshot consistency. If only one row can be verified in an otherwise incomplete portfolio, the portfolio remains unpublishable. If a newer complete snapshot exists, report it separately from the historical correction; the newest verified snapshot has production priority.
7. Reference the persistent issue ID. Explain the resolution evidence, but never delete the issue or declare production updated. The trusted runner records attempted/resolved/superseded outcomes and updates the queue after verification.

Example principle: a flagged 67.20% and previous 6.72% do not justify proposing 6.72%. Return to the source; it might say 6.82%, or it might genuinely support 67.20%. Those are explanations, not values to reuse.

If the queue is empty, return an empty proposals array and an honest task summary. Do not create fictitious corrections. If quota or a source blocks investigation, preserve the unresolved issue for later rather than pretending it was fixed.

## Practical response sequence (Task B)

- The packet may contain up to eight selected issues, but the persistent
  queue can be much larger. Review only `inputs.issues`; don't invent
  results for unselected issues or imply the entire backlog is resolved.
- Echo **every** source in `inputs.sources` as exact seven-field metadata
  in `source_checks`. This ledger must have exactly the same set of source
  IDs as the packet even if no correction can be proposed. The trusted runner
  intentionally excludes failed/unavailable downloads from Gemini's source
  packet; those failures and associated issues remain in persistent audit
  state for retrieval on a later day. Do not reintroduce them, invent source
  hashes, or claim to have investigated omitted sources.
- Use only the supplied official source rows/excerpts. If a referenced
  issue has no checked, corroborating source or only a shortened excerpt,
  emit no speculative correction. The independent queue retains it.
- For a supported proposal, retain `issue_id` exactly as provided, use
  the source period and original numeric units, and distinguish
  `extraction_error` from `validator_false_positive`. A possible false
  positive means a **manual rule review**, never permission to force a merge.
- When zero issues are selected, return `proposals: []` and an accurate
  empty-investigation summary. When one issue cannot be resolved, keep it
  unresolved; do not repeat earlier values merely to satisfy the schema.
- Self-check that the JSON includes **all required fields** and all source
  checks, not just the sources mentioned by proposals. Never omit a source
  ledger entry in order to shorten an answer.


- **No verified source bytes means no verified source hash.** An unavailable
  source may have `source_sha256: null` in acquisition state. Never fabricate
  a digest (especially `0000...`) to populate `evidence`. The evidence
  schema requires a real SHA-256 from downloaded bytes. If a future packet
  includes such a failure, report the uncertainty with `new_candidate: null`
  and `evidence: []`, or make no proposal. The existing issue persists.
