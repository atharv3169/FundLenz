# Daily timing investigation and independent dispatch timer

Status: implementation prepared for review on 15 October 2026. The new timer is
disabled by default and is not activated by merging this change. Production still
uses the original GitHub schedule until the separate activation below is completed.

## Reconstructed checkpoint

The pasted interrupted chat ended during final lint/documentation maintenance.
The newer handoff and merged PR #46 (`8150537`) establish that those changes were
subsequently completed. PR #45 added bounded provider/deployment retries and a
read-only health workflow; neither PR replaced GitHub's schedule service.

The application/data architecture was reviewed before this change: browser-local
portfolio calculations consume verified public JSON, GitHub/Python/Gemini produce
protected data releases, Cloudflare serves the Worker, D1 stores editorial drafts
and revisioned publications, and private visitor submissions go to Drive. This
change concerns only the automation trigger and duplicate protection.

At investigation time, current main was `cfb4854e4332b66d96a82f77a757979eecb8ea53`
(PR #49). The 14 October scheduled run `38539562047` was successful:

- Workflow created: 09:03:29 UTC / **14:33:29 IST**, against a target of 09:17 IST.
- Source collection began: 14:33:44 IST.
- Gemini tasks: 14:34:02–14:34:20 IST, one validated attempt per task.
- Accepted units: 8,559; unchanged: 5,507; blocked: 194; retained unsupported: 133.
- No critical errors; 308 open issues; overall coverage remains `PARTIAL`.
- The data PR merged at approximately 14:37 IST. The later deployment observer,
  release-integrity and health workflows succeeded.

Scheduled starts on 10–13 October were 15:38, 15:50, 16:51 and 16:40 IST. The
delay is before GitHub creates the run, not hours spent in Gemini. The cron
`47 3 * * *` is already the correct UTC expression for 09:17 IST. Moving that
expression a few minutes cannot guarantee timely execution.

GitHub documents that scheduled events may be delayed or dropped under load:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## Design

An isolated Cloudflare Worker, `fundlenz-catalogue-scheduler`, uses two cron events:
03:47 UTC (09:17 IST) and 03:57 UTC (09:27 IST). It inspects today's existing main
workflow runs. If an automatic run is already queued, running, completed or
failed, it does not dispatch another. The second event recovers a missing dispatch;
it does not retry a failed collector or silently issue a new Gemini budget.

When needed it calls only the fixed FundLenz `catalogue-daily.yml` dispatch
endpoint, with `ref: main`, `automated_daily: true`,
`publish_validated_data: true`, and `force_supported_sources: false`.
It does not call Gemini or obtain the publishing token. Its HTTP handler always
returns 404; it has no public domain, D1, Drive, KV or website asset binding.

The existing GitHub cron remains a fallback. The existing workflow concurrency
group serializes native and external triggers. A new guard job runs before
collection or dependency installation. It checks the actual collector job's
India-local start date in recent native/external run history:

- A successful automatic collector today causes later automatic triggers to skip
  source collection, model requests and publication.
- A failed, cancelled or incomplete automatic collector today stops automatic
  recovery with an error. Inspect the failure before an explicit manual dispatch.
- A guard-only skipped run is not evidence that collection occurred.
- An ordinary manual audit does not consume the automatic daily slot.
- Automatic runs require main, disallow forced source fetching, reject direct
  reruns of automatic attempts, and fail closed on ambiguous/incomplete history.
- The guard rejects a trigger before 09:17 IST, including a previous-day native
  event delayed into the early morning. It never consumes that day's model
  budget before the collection window.

The health workflow accepts both native schedule events and the fixed external
automatic run title. It still excludes ordinary manual audits. Its existing
36-hour missing-run and one-hour stuck-run checks remain in force. It remains
GitHub-scheduled; this change does not turn it into an independent external uptime
monitor or impose a new exact-time availability guarantee.

The Cloudflare dispatcher rejects redirects, uses a fixed GitHub host, times out
requests, fails closed on incomplete run history, and does not automatically retry
POST. An ambiguous dispatch response can mean GitHub already accepted the request.
The later timer rechecks history, and the workflow guard is the final protection
if duplicate dispatch events nonetheless arrive. Source/model validators, their
per-run budgets, publisher permissions, exact-head checks and protected merges
remain unchanged. No financial source or production data files are changed here.

Cloudflare cron documentation:
https://developers.cloudflare.com/workers/configuration/cron-triggers/

GitHub dispatch API and required token permissions:
https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event

## Review and activation

1. Review/merge the workflow guard and scheduler files through normal protected
   maintenance checks. Do not activate the external Worker against an older
   workflow that lacks the new input and duplicate guard.
2. Create a dedicated fine-grained GitHub token restricted to
   `atharv3169/FundLenz`, with **Actions: read and write** and the mandatory
   metadata access. No Contents write or administration permission is needed.
   GitHub does not offer a dispatch-only token permission: Actions write has
   broader Actions capabilities, so keep this credential separate, review its
   expiry and rotate it privately. Never reuse the publishing token or paste
   credential values into chat, code, logs or the handoff.
3. In the owner's authenticated Cloudflare environment, add the secret to the
   separate Worker. These commands have not been executed against production:

   ```bash
   pnpm exec wrangler secret put FUNDLENZ_DISPATCH_TOKEN --config wrangler.catalogue-scheduler.jsonc
   pnpm exec wrangler deploy --config wrangler.catalogue-scheduler.jsonc --var SCHEDULER_ENABLED:true
   ```

   If the Worker must be created before adding its secret, deploy it first with
   the default disabled configuration. Check that the target name is exactly
   `fundlenz-catalogue-scheduler`, never `fundlenz` or the blog staging Worker.
4. Confirm the two cron expressions, disabled public URL and secret binding in
   Cloudflare. Cron changes can take up to 15 minutes to propagate. The checked-in
   configuration deliberately says `SCHEDULER_ENABLED: false`; subsequent
   deployments must explicitly opt into activation again.
5. Observe the next real 09:17 IST event. Match the Worker result, external GitHub
   run, source/model steps, protected data PR and live release. Verify the 09:27
   event and late native GitHub run do not cause another automatic collector.
   Do not claim activation or on-time execution based only on unit tests or a
   dry-run build.

This removes dependence on GitHub's **cron-event creation** for the primary
trigger. GitHub runner queues, Cloudflare/provider outages and source publication
times can still affect the start, completion or financial freshness. No exact
minute or same-day market-value guarantee is made.

## Failure and rollback

- If history lookup, authentication or dispatch fails, inspect Worker logs and
  GitHub run history without copying credentials. Fix expired credentials or
  permissions; do not broaden access indiscriminately.
- If a collector fails, inspect its retained audit first. For a deliberate recovery,
  dispatch manually with `automated_daily: false`; publication remains false by
  default and requires an explicit opt-in. Force source acquisition only when
  necessary to revalidate feeds already attempted that day. This is an additional
  operator-authorized request budget, not an automatic retry loop.
- Do not use GitHub's rerun button on an automatic run. Its guard rejects attempts
  after the first to prevent silently repeating model expenditure.
- To disable the new timer, deploy its checked-in disabled configuration or remove
  its cron triggers. The original GitHub cron continues as a fallback. This needs
  no website deployment, DNS edit, database change or financial rollback.
- Reverting code should include the workflow, guard and health integration
  together. Never leave an enabled external timer targeting an incompatible
  workflow.

## Validation and remaining data limits

The new test coverage exercises same-day duplicates, India-local day boundaries,
ordinary manual audits, current runs, guard-only skips, failed/cancelled/incomplete
collectors, invalid automatic inputs, stale events, provider failures, no POST
retry, secret-safe diagnostics and isolation/disabled defaults. Tests use fictional
tokens and mocked network responses; they do not invoke the real model or publish
data. The full Python automation suite and existing release-contract checks are
also run, followed by the scheduler's Wrangler dry-run bundle validation.

The broad review's other findings are deliberately separate work: 437 of 476
registered sources are monitoring-only; only existing AMFI NAV units and 38
iShares portfolios have automatic financial adapters. The nominal cadence demand
is about 67.70 checks/day against a limit of 64, before issue retries. This change
does not raise source/model budgets or claim those coverage gaps are solved.
Indian holdings remain a dated disclosure snapshot. A new run date does not imply
that every catalogue record was refreshed. D1/Drive recovery and broader CI-trigger
coverage also remain separate from this timing repair.
