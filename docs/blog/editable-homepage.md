# FundLenz staging editorial drafts — owner instructions

**Current state:** The administrator login, session persistence, and logout have been verified by the owner in the isolated staging Worker. Draft editor code lives in draft PR #4. It is **not merged to main** and must not publish to `fundlenz.com` without a separate review. The UI and endpoints are subject to the next Cloudflare deployment and real integration tests.

## Safe staging scope

- Private dashboard appears at `/blogpost/admin` only when the existing admin session endpoint confirms a valid signed-in session.
- `GET/PUT /api/blog/admin/homepage-draft` reads and stores a strictly validated homepage **draft** with optimistic version checking; it does **not** change `content/blog-homepage.json`, static public blog output, or GitHub.
- `GET/POST/PUT/DELETE /api/blog/admin/article-drafts` lists/creates/updates/deletes private article drafts only. Stored fields: title, summary, plain Markdown, fixed category, monotonically increasing version, timestamps. No publish action or untrusted HTML rendering.
- All endpoints independently check session authentication, exact staging hostname and HTTPS; PUT/POST/DELETE also enforce the exact origin. Draft APIs are deliberately unavailable on the production host even after a hypothetical merge.
- SQL guards enforce `status='draft'`; version checks reject stale concurrent writes instead of silently overwriting.
- All draft writes are stored only in the **existing isolated staging D1** database, never in visitor Google Drive, financial data, or GitHub. No new paid service.
- Existing admin session cookie and password, private staging gate, GitHub branch protection and financial release gates remain unchanged.

## One-time manual staging database migration (after CI and staging deploy)

1. Open Cloudflare → Storage & databases → D1 → `fundlenz-blog-admin-staging` → Console.
2. In the FundLenz GitHub development branch, open `db/blog-admin/0002_editor_drafts.sql` and copy its SQL (not your secret keys).
3. Paste the script into the D1 Console and execute it. It uses `CREATE TABLE IF NOT EXISTS` and is safe to rerun. It **adds** two tables and one index; it does not alter your three verified login/security tables.
4. Run `/tables` and confirm `blog_homepage_draft` and `blog_article_drafts` appear alongside `blog_admin_sessions`, `blog_admin_attempts`, and `blog_admin_security_events`.
5. Sign in at staging `/blogpost/admin`, create one sample private draft, edit and save it, reload and confirm persistence. Repeat for homepage text. Verify the public `fundlenz.com` page did NOT change.
6. Test conflict behavior by opening the same draft in two separate tabs, saving a change in one, then trying to save stale content in the other; it should be rejected with 409.
7. Test logout and try the admin draft API without a valid session: it must return 401.

**Important:** If the migration hasn't run, dashboard requests fail closed with "Draft storage is temporarily unavailable. Verify the staging database migration." This should not affect administrator login/logout.

## Publication is a separate later milestone

Public articles must be versioned in the public `atharv3169/FundLenz` GitHub repo and reviewed through a controlled publishing workflow. Homepage `content/blog-homepage.json` also remains in GitHub. Do not create a direct unreviewed production publisher, expose GitHub API credentials to the browser, or claim that D1 draft saves publish content. The current dashboard explicitly labels every save **private staging draft, not published**.

Future work: GitHub publish integration with approved paths, revisions and preview, article archive/search, image/media upload handling, editor typography, contribution-review workflow, and eventual release from staging after integration and authorization tests.
