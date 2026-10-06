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
