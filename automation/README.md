# FundLenz catalogue automation

The daily source-and-model workflow is active in **dry-run mode**. Start with
[the operating guide](../docs/migration/AUTOMATION.md) for current coverage,
schedule, budgets, live trial results and publication setup. The interface,
calculations and live financial data are unchanged.

## Runtime and trust boundaries

- `runtime.json`: daily cadence, acquisition/model budgets, deployment target
  and disabled publication switch.
- `source-registry.json`: 476 approved exact URLs, including 39 supported
  source adapters and 437 monitoring-only entries.
- `source-quarantine.json`: two malformed legacy inventory entries excluded
  from acquisition, with hashes retained for traceability.
- `gemini-system-prompt.md`, `gemini-daily-scan.md` and
  `gemini-reinvestigation.md`: fixed instructions for the two untrusted model tasks.
- `schemas/`: candidate, issue and audit contracts.
- `reviewed-resolutions.json`: protected manual rule-review records. A record
  alone cannot approve data; independent exact-source validation is still required.
- `../scripts/automation/`: acquisition, deterministic adapters, validation,
  issue reconciliation, publication gates and deployment confirmation.
- `../.github/workflows/catalogue-*.yml`: scheduled runner, trusted PR review,
  separate merge credentials and deployment observation.

The original `source-inventory.json` is an inventory, not a network allowlist.
`OPERATING-SPEC.md`, `workflow-spec.md` and `requirements-traceability.md`
retain the version-1 agreement and distinguish implementation from outstanding
activation gates. Root `audit/` remains the committed bootstrap until protected
publishing is enabled; current dry-run results are in Actions artifacts.

## Local checks

From the repository root:

```sh
python3 -m pip install -r scripts/automation/requirements.txt
python3 -m unittest discover -s scripts/automation/tests -v
python3 scripts/automation/verify-bootstrap.py
node scripts/automation/verify-contracts.mjs
pnpm run typecheck
pnpm run verify
```

The current automation suite has 37 adversarial tests. The existing six finance
and catalogue suites remain in place. Live run
[37672720902](https://github.com/atharv3169/FundLenz/actions/runs/37672720902)
verified the source/model/validator/audit path with a truthful PARTIAL result.
Publication, automatic merge and real hosting rollback still require the
one-time setup and end-to-end trial in the operating guide.

Gemini has no repository write credential and cannot edit rules, code, UI or
calculations. Approved independent units can update only through deterministic
validation, a protected data-only PR and checks on that exact proposed commit.
Failures retain previous complete values and unresolved issue history.
