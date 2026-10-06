# FundLenz automation bootstrap

Start with `OPERATING-SPEC.md`, then the master prompt and both task prompts. `requirements-traceability.md` records every agreed rule and required end-to-end cases. `workflow-spec.md` describes the trust boundaries and outstanding implementation.

## Included contracts and state

- `schemas/candidate.schema.json`: untrusted Gemini output, Draft 7 JSON Schema. No approval field exists.
- `schemas/open-issues.schema.json`: persistent unresolved-source/validation issues.
- `schemas/bootstrap-audit.schema.json`: explicitly identifies the initial import, not an operational daily scan.
- `policy.json`: proposed file boundaries, last-good retention and escalation rules. Publication is disabled.
- `source-inventory.json`: 436 source URLs extracted from existing provenance. This is not a network allowlist or a new freshness check.
- `baseline-manifest.json`: hashes for the existing Site files, used to verify faithful transfer.
- `../audit/`: bootstrap state and four known inconclusive source-page checks.

## Checks available now

From the repository root:

```sh
python3 scripts/automation/verify-bootstrap.py
node scripts/automation/verify-contracts.mjs
node scripts/verify-all.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The Python integrity check needs only the standard library. The Node checks use the project's pinned dependencies, including the JSON Schema validator already installed with ESLint. See the root README for installation.

These checks establish transfer integrity, contract consistency and existing financial behavior. They do not verify fresh external financial data or demonstrate a working autonomous pipeline. The candidate JSON schema rejects malformed shape; independently source-backed semantic validation remains to implement.

## Order of implementation

Upload this prepared source; resolve GitHub permissions/plan; implement source adapters and typed candidate validation; implement two bounded Gemini tasks and trusted reconciliation; add persistent audits and dry runs; configure protected automatic publication; port/test hosting; enable the schedule after end-to-end verification. No daily manual merge should be required in the completed steady state.
