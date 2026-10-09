# Financial deployment confirmation — audit-only vs genuine releases

Date: 9 October 2026. Do not re-label source snapshots or simulate fund changes.

## Diagnosed incident (run 37920898919)

The scheduled run **37920608356** published `public/automation-audit/release.json`
on `main`, but the release declared `financial_data_changed: false` and its
`dataset_sha256` was unchanged. The separate confirmation workflow attempted
a strict public-Worker release probe regardless and failed with
`No approved production origin served the exact financial release`.

This is a classification bug: a checked source, Gemini investigation and new
audit record are not proof that even one fund value was validated and published.

The October 9 public audit distinguishes **monitoring-only** registry sources
from 39 trusted numeric adapters (AMFI and 38 iShares). The numeric adapters
were `deferred` by their daily IST cadence on that particular run, while the
43 `checked_changed` sources were monitoring-only. No verified financial units
were accepted, so **no new catalogue update date** was warranted.

## Fixed contract

- The deployment observer first checks that release schema, run ID and dataset
  digest agree with the exact checked-out `public/data/*.json` bytes.
- `financial_data_changed=false`: emit a durable deployment report with
  `status=audit_only_no_financial_changes`,
  `deployment_complete=false`, and exit successfully. Do not claim a live
  financial release and do not modify `lastCatalogueUpdateDate`.
- `financial_data_changed=true`: wait for the exact Cloudflare build to
  succeed, then verify the exact publicly served release marker AND visible
  `lastCatalogueUpdateDate` + run ID. Retry boundedly for up to 10 minutes
  after transient network errors, 404s or stale caching. Never turn a build
  success into a false deployment success.
- Genuine releases remain **failed or unconfirmed** if the approved origin is
  inaccessible, returns a stale marker/date, or no build succeeds. Diagnostic
  categories are safe, bounded (no sensitive response bodies).
- The workflow also triggers when the confirmation script itself changes, so
  the repaired audit-only behavior can be checked in CI without publishing
  synthetic financial data.

## Monitoring and next checks

Verify future scheduled source runs against `audit/latest.json` source
outcomes and atomic-unit decisions. Only when at least **one real source-backed
financial change** reaches the protected merged release should the shared
catalogue-update date advance (India local date of verified run); individual
fund holdings snapshot dates remain separate.

The previous red run is a historical record and is not retroactively
rewritten. The succeeding confirmation job proves correct classification
of the current audit-only marker. It does **not** prove an as-yet-absent
future financial release is deployable from external runners. When such a
financial change occurs, its dedicated strict check must pass.

Cloudflare Worker preview is not yet the apex domain. Do not change DNS,
Turnstile, D1, Google Drive, finance data, or secrets for this repair.
