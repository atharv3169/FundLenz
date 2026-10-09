# FundLenz final acceptance, domain cutover and rollback plan

Date prepared: 9 October 2026. Owner approval **required** before DNS or
Cloudflare Custom Domain changes. This is a read-only checklist, not an
authorization to transfer a domain or modify third-party hosting.

## Known good baseline

- Production code branch: `main`, reviewed release at creation
  `a39a6a12e5d319bf804da4fa674053ec4a67311c`. Before cutover
  re-check `main` HEAD and Cloudflare's corresponding *completed deployment*;
  this baseline will evolve.
- Current public front: `https://fundlenz.com` on ChatGPT Sites.
- Cloudflare Worker preview: `https://fundlenz.atharvsahu711.workers.dev`.
- Password-protected staging Worker: `fundlenz-blog-staging.atharvsahu711.workers.dev`;
  staging **must not share** production D1, credentials, or rate-limit counters.
- Owner-observed successes: blog admin login/logout, private draft save/reload,
  article publish/update/unpublish/restore, homepage & article insight cards,
  newsletter signup and Drive record, contributor DOCX upload & Drive record,
  Turnstile widget, and the post-rate-limit newsletter submission.
- On `main` code review: exact-host single-user admin security, privacy and
  terms routes, Turnstile/consent on forms, and two distinct Worker form
  rate-limit bindings. Merging/compiling is not evidence that every browser
  interaction passed or that a release marker names the currently running Worker.

## Final visual + interactive acceptance before cutover (owner browser)

Use current Chrome on **desktop ~1440px**, mobile **~390px** and, if available,
small tablet **~768px**. Test the **Cloudflare Worker preview**, with comparison
to the current `fundlenz.com` ChatGPT Sites UI. Capture only safe screenshots;
never expose admin credentials, session tokens, private emails or documents.

| URL / area | Confirm |
| --- | --- |
| `/` | FundLenz logo/header, US sample portfolio, analysis controls, no missing charts or images; approved desktop layout and refined mobile header; footer disclaimer & privacy/terms links |
| `/catalogue-global` | International catalogue loads; search/filter/select 1 supported ETF; inspect source/date/currency; open holdings and link to portfolio lab |
| `/catalogue-india` | Indian fund search/filter; choose 1 supported fund; show correct plan, as-of disclosures and analysis link; no invented NAV or stale date claims |
| `/catalogue-securities` | Stocks/bonds results and identifiers render, search/filter works, source/provenance remains visible |
| Portfolio lab | CSV template download, import supported CSV, portfolio allocation/holdings/overlap and relevant stress/chart controls, session save/reload; mobile fields and close buttons accessible |
| `/blogpost` | Hero title, stacked full-width archive, search, side cards start at Articles row; desktop left/right slots and mobile cards after core content; newsletter success and back arrow; Add your own article |
| Public article | Normal non-test article when available: article layout, author/share controls, right Insight cards, `← Back to blog`, mobile sidebar below article |
| `/blogpost/admin` | Admin link visible on production blog; unauthenticated visitor gets login only, authenticated owner can edit; logout revokes session; draft not inadvertently published |
| `/privacy` and `/terms` | Both legible and linked in footer, reflect real retention/contact practices; no misleading claims about investment recommendations |
| Console/network | No failed key assets, uncaught errors, 404s on intended links or mixed-content warnings |

Run a single ordinary synthetic newsletter submission **only if desired**;
the owner has already verified a successful post-rate-limit flow. Never flood
live endpoints just to induce 429s. Contributor Drive storage has been tested
by the owner; another personal upload is not needed for this gate.

## Browser privacy checks

- From a **separate** private browser session, the draft and publication
  management API must reject unsigned users; admin sessions must not be
  shared between staging/production hostnames.
- The QA article `/blogpost/fundlenz-qa-private-draft-test` must be
  unpublished (404 or unavailable) and absent from the public archive.
- Browser sessions/localStorage are **origin-scoped**. Data saved on
  `workers.dev` will not automatically appear under `fundlenz.com`.
  Existing same-domain ChatGPT Site local storage may require compatibility
  confirmation after cutover; don't claim automatic migration of all sessions.
- No private visitor email, manuscript, session token, Google secret,
  Gemini credential or form body may appear in GitHub, public assets or logs.
- Run read-only smoke tests and review Cloudflare Observability for 4xx/5xx
  surges; don't log visitors' personal content.

## Domain readiness — collect facts before any changes

**Do not start domain cutover until all below are confirmed with the owner.**

1. Is `fundlenz.com` already an **Active** zone in Cloudflare DNS?
   If not, review the domain registrar, nameserver delegation, any DNSSEC/DS
   settings, and the required full setup before changes. Cloudflare Worker
   Custom Domains require an active Cloudflare zone; on Free/Pro, full
   Cloudflare DNS setup generally uses assigned authoritative nameservers.
2. Export/screenshot ALL existing DNS records, especially **MX/TXT
   (email), SPF/DKIM/DMARC**, apex and `www` records, plus the current
   ChatGPT Sites domain connection and its documented restore procedure.
   Do not delete email records or change registrar ownership.
3. Confirm canonical public host: **`fundlenz.com`** (apex). Plan an HTTPS
   redirect from `www` to apex if that host is currently used. The
   application currently enforces exact-host admin/security allowlists
   and does not implicitly accept `www.fundlenz.com`.
4. Ensure the existing Turnstile widget permits `fundlenz.com` and the
   site key still matches its encrypted secret.
5. Prepare Cloudflare **Production** text variables for cutover:
   - `BLOG_ADMIN_ALLOWED_HOSTNAMES`: include exact `fundlenz.com`
     alongside the reviewed production Worker hostname; retain the
     independent editor/password/session activation switches.
   - `FORMS_ALLOWED_HOSTNAMES`: include exact `fundlenz.com` and the
     Worker hostname, comma-separated; do not add wildcard hosts.
   - Keep `BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED=true` and
     `BLOG_ADMIN_PUBLICATION_ENABLED=true` ONLY with owner approval.
   - Keep Turnstile & Google OAuth secrets encrypted and unchanged;
     keep D1 production binding and rate limit bindings intact.
6. Verify Cloudflare Worker production deployment is healthy on workers.dev,
   the production D1 tables are present, and the owner retains independent
   access to GitHub, Cloudflare, Drive and domain registrar.
7. Confirm no blocking Cloudflare Access/Zero Trust/card authorization
   dependency; that paid-card approach was explicitly declined.

References (current docs):
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/dns/get-started/
- https://developers.cloudflare.com/dns/nameservers/update-nameservers/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Owner-approved cutover (future, NOT part of this review)

1. Record the current working Worker build/commit, current DNS/hosting
   settings, and rollback contacts. Verify the previous ChatGPT Site remains
   available independently until the new host is accepted.
2. Activate Cloudflare DNS zone if necessary **only after reviewing full
   DNS and DNSSEC consequences**; do not remove existing email records.
3. Set/verify nonsecret runtime hostname variables and Turnstile registered
   hostnames. No raw secrets in tickets, PRs or screenshots.
4. In Cloudflare Worker `fundlenz`, attach **Custom Domain `fundlenz.com`**
   after resolving conflicting apex CNAME records. Worker Custom Domains
   require an Active Cloudflare zone; don't manually invent target DNS
   records or attach the production domain to staging.
5. Verify HTTPS, main lab, catalogues, blog, anonymous form flow, login,
   D1 public home/article data, private contributor submissions, legal links,
   and optional `www` redirect on **the final hostname**; verify mobile.
6. Keep original host access available until all acceptance checks pass.
   Freeze discretionary code/financial data releases during cutover.
   Record successful owner signoff and then retire old ChatGPT Sites
   domain binding when safe (do not delete the prior project as rollback).

## Rollback: prepare BEFORE any cutover

- Preserve a source of truth for the original DNS records, nameservers,
  DNSSEC/DS settings and ChatGPT Sites binding (plus exact restore method).
- If new host causes 5xx, certificate issues, D1 errors or broken core
  lab/blog, stop publication and use the reviewed original DNS/host settings
  to reattach the original ChatGPT site; follow registrar/Cloudflare DNS
  guidance for the zone configuration in use.
- Restore only reviewed settings for the **same** host; expect DNS and
  certificate propagation delays. Recheck both apex and `www` and the
  email MX/TXT records. Do not assume rollback is immediate.
- Do not roll back D1 with destructive SQL. If code-only rollback is
  needed, use a known-good Worker deployment compatible with the current
  schema. Preserve private submission records and existing live data.

## Launch go/no-go

**GO** only after desktop/mobile owner validation, DNS/registrar facts,
production Worker/deployment and rate-limit verification, privacy/
security review, independent rollback path, and explicit owner consent.

**NO-GO** when login/public-data boundaries fail, 503 on ordinary form
submissions, financial calculation regressions, misreported data freshness,
missing private Drive writes, broken catalogue links, certificate errors,
unintended `www` behavior, missing DNS/email backups or absent rollback path.

Current state: **Pre-cutover acceptance in progress. No custom-domain
transfer authorized.**
