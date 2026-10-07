# Daily workflow implementation contract

**Implementation update — 7 October 2026:** The version-1 agreement below is retained. The source runner, two Gemini tasks, deterministic NAV/international-holdings validator, persistent audit/state, protected publisher and deployment observer are now implemented. Scheduling is dry-run only; publication is disabled. See [the operating guide](../docs/migration/AUTOMATION.md) for exact coverage, tests, budgets and outstanding activation gates. Historical statements saying “not yet implemented” describe the bootstrap, not the current code.


This file describes the required runner. No daily workflow, Gemini request or automatic merge is active in this bootstrap.

## Jobs and credentials

1. **Acquire:** load trusted code/policy from the protected base commit. Read a bounded approved source list; fetch official bytes with timeouts/retries and source access rules. Hash the bytes. Persist a source packet with identity/date/units; reject redirects outside the reviewed policy. No repository write credential.
2. **Fresh scan:** supply the immutable master and Task A prompts plus due source packets. Gemini key only, no GitHub token. Strictly parse and validate candidate output as untrusted data.
3. **Re-investigate:** supply the immutable master and Task B prompts plus persistent issues and retrieved evidence. Gemini key only, no GitHub token. Queue entries remain until trusted resolution.
4. **Reconcile and validate:** run trusted adapters and rules from the base commit, not candidate code. Verify source evidence independently, choose consistent atomic updates and keep failed units intact. Produce a full sanitized candidate tree, audit and content hashes. Run schema/identity/financial regression/cross-file checks. No write/merge authority.
5. **Publish candidate:** a separate trusted job receives the verified output, verifies its digest and file allowlist, confirms the base still matches, and opens/updates a data-only branch/PR. Only this job receives narrowly scoped GitHub write credentials. Never stage an entire writable working directory or commit a model-created file list unchecked.
6. **Gate and merge:** enforce required checks on the exact latest PR head and current base. Check expected publisher identity plus the full allowed diff; identity/branch name alone is insufficient. Auto-merge only sanitized changes. Rule/code/prompt modifications take a separate reviewed path.
7. **Deploy and observe:** the connected host builds the merged commit. Confirm deployment and dataset identity; record build/deploy failure distinctly. Keep the old successful deployment until the new one succeeds.

Acquire/model tasks may overlap if they read the same immutable base. Publication is serialized per repository. Retries must be idempotent; same run/proposal IDs cannot duplicate updates or inflate issue attempt counts. A model task can run in bounded batches rather than sending the entire catalogue on each request.

## Audit-only and no-change runs

Write a truthful completed-run audit even when there are no accepted data changes. Audit-only changes use a separate trusted allowlist and validation; a PARTIAL/FAIL report is not transformed into PASS merely because its JSON is valid. Keep the complete unresolved queue, resolution history and per-source check scope.

Root `audit/` is not automatically exposed by the current website. At hosting setup, publish a sanitized read-only audit endpoint or static copy without credentials. Do not invent a working `fundlenz.com/audit/latest.json` link before it exists.

## Required setup still outstanding

- Repository created and this initial source/data import uploaded. Operational source adapters and publishing configuration remain outstanding.
- Decision on private staging versus public free protected-main operation (or an eligible private-repository plan).
- Implement approved source adapters, model runner, production validator/reconciler and publisher; no placeholder success path.
- Gemini API key/project/model/quota and per-run budgets; secrets entered securely, never committed.
- GitHub App/runner identity and actual branch protection, required checks and auto-merge capability; test unattended PR checks.
- Adapt the Sites/Vinext build to the chosen external host and prove route/function parity before changing DNS.
- Separate existing release-specific tests from evergreen validation. Current tests deliberately pin some counts and dates; blindly rerunning them against newer data will fail. Never simply delete those checks or let Gemini rewrite expected counts.
- Extend the audit contract from bootstrap to actual daily/deployment reports as part of the runner implementation.
- End-to-end cases in `requirements-traceability.md`, first real source-backed dry run and rollback trial.

## Official platform references checked 6 October 2026

- GitHub token triggers and approval-required PR runs: https://docs.github.com/en/actions/concepts/security/github_token
- Protected branch availability and required checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Scheduled workflow inactivity: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow

Recheck platform limits when activating. API response format support does not establish semantic accuracy or free/unlimited operation.
