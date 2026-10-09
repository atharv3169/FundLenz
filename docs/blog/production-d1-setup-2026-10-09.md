# Production blog D1 provisioning — 9 October 2026

## Confirmed owner-created empty database

- Cloudflare database name: `fundlenz-blog-admin-production`
- Cloudflare database UUID: `cfdfc32d-5833-4102-889a-37889bbbb7b1`
- New database at creation: **0 tables, 0 rows read, 0 rows written** (screenshot from owner)
- Worker target: **`fundlenz`**, not `fundlenz-blog-staging`
- Required D1 binding in deployed `wrangler.jsonc`: **`BLOG_ADMIN_DB`**
- Staging database remains separate: `fundlenz-blog-admin-staging`, UUID `7849f805-0efa-49d3-b5bb-26c2527e4cfd`.

Database IDs are public resource identifiers, **not passwords**. Do not disclose Worker secret contents, bearer tokens, passwords, Google OAuth refresh tokens or session keys.

## Scope of this change

This draft PR adds one exact production D1 binding and `keep_vars: true` to **reviewed** `wrangler.jsonc` and its frozen integrity manifest. It updates the isolated staging build guard to assert that production has a *different* exact D1 ID before rewriting only generated staging output. It adds CI checks before and after production Vinext build.

- **No database access or D1 table creation from GitHub CI.**
- **No domain routing, DNS, custom domain, Cloudflare secret or production deployment performed by this PR.**
- **No production editor write permissions granted:** `lib/blog-editor-auth.ts` still denies any hostname except the private staging Worker.
- The staging-only private homepage and separate password gate remain unchanged.
- Changes to production credentials, admin host access, public article publishing and visitor forms need their own reviewed stages. The public article publication list is still empty.
- None of the registered financial sources, data files, Gemini tasks, issue history, publisher/merger logic or portfolio UI are touched.

The owner explicitly intends to keep `fundlenz.com` pointing to ChatGPT Sites until the entire Cloudflare-hosted app is ready. **Do not connect a Worker Custom Domain or modify DNS under this issue.**

## Required schema bootstrap — operator-controlled, only after reviewing the D1 database identity

The D1 screenshot is initially empty. The following existing, reviewed SQL files contain five tables and necessary indexes:

1. [`db/blog-admin/0001_auth.sql`](../../db/blog-admin/0001_auth.sql): `blog_admin_sessions`, `blog_admin_attempts`, `blog_admin_security_events`.
2. [`db/blog-admin/0002_editor_drafts.sql`](../../db/blog-admin/0002_editor_drafts.sql): `blog_homepage_draft`, `blog_article_drafts`.

### Safe manual dashboard procedure

1. Cloudflare → **D1 SQL Database** → **`fundlenz-blog-admin-production`** (confirm UUID `cfdfc32d-5833-4102-889a-37889bbbb7b1`) → **Console**.
2. Inspect the complete GitHub SQL text on the reviewed PR, then run the full `0001_auth.sql` statements **against this newly created production database only**. Do not point the console at staging.
3. Run `0002_editor_drafts.sql` against the same reviewed production DB.
4. Use the Cloudflare Overview to confirm exactly **five application tables**. D1 system metadata may have its own tables; it should not be counted as an application table. Sample non-sensitive read-only diagnostic:
   ```sql
   SELECT name FROM sqlite_master
   WHERE type='table' AND name LIKE 'blog_%'
   ORDER BY name;
   ```
5. Preserve a screenshot of the read-only table list and notify the reviewer. Avoid inserting any real visitor data or administrator tokens during schema verification.

These SQL statements are `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, tested locally for schema idempotency. They are a **manual bootstrap**, not registered Cloudflare `d1 migrations` history; future changes should adopt a tracked migration ledger rather than assuming the console operations were applied through Wrangler. Do not delete or recreate a database to fix a failed query.

## Secrets, runtime and rollout

- Production Worker secrets already visible **by name** in owner's screenshot: Google OAuth client ID, client secret, refresh token; Turnstile secret.
- Do **not** copy staging passwords, session signing secrets or existing staging D1 data to production.
- Before enabling the production editor, provision independent production `FUNDLENZ_ADMIN_PASSWORD_HASH`, `FUNDLENZ_ADMIN_SESSION_SECRET`, and the explicit `BLOG_ADMIN_ALLOWED_HOSTNAMES` variable. Do not add them to public source files. The editor must separately be modified/tested to allow a reviewed production host; this PR does **not** do that.
- `keep_vars: true` preserves Cloudflare dashboard **nonsecret** environment variables across Wrangler deployments; encrypted Worker secrets remain separate. This matters for nonsecret `FORMS_ALLOWED_HOSTNAMES` and `TURNSTILE_SITE_KEY` when configured. Verify in Cloudflare after deployment; never assume secrets or bindings just because CI passed.
- Production `wrangler.jsonc` remains named `fundlenz` and retains `workers_dev: true`. The user's domain remains on ChatGPT Sites until explicit cutover approval.

## Go/no-go checklist

- [ ] SQL bootstrap executed only by owner against exact newly created production D1
- [ ] Five blog tables confirmed and no data accidentally inserted
- [ ] GitHub PR protected data/financial integrity checks all pass
- [ ] GitHub blog CI verifies production/staging D1 are distinct and exact, with production build carrying D1 and `keep_vars`
- [ ] Any Cloudflare build triggered by merging inspected for unexpected variable/binding changes
- [ ] Production code remains unable to write drafts without deliberately reviewed auth/cutover work
- [ ] Domain not moved; old Sites website continues serving `fundlenz.com`

Official documentation:
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/workers/configuration/secrets/
