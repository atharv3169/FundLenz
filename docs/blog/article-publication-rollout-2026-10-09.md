# Article publication rollout (Cloudflare Worker preview, 9 October 2026)

The existing five private D1 tables remain untouched. This adds separate public-only snapshots and append-only revision history. Saving a private draft cannot publish.

## Operator preparation
1. Verify production Worker fundlenz has BLOG_ADMIN_DB bound to fundlenz-blog-admin-production.
2. In that production database's D1 Console, apply db/blog-admin/0003_publications.sql statement by statement. The existing database and old tables must never be dropped or replaced. Cloudflare SQL Console previously mishandled scripts pasted after same-line SQL comments, so paste each CREATE statement separately.
3. Read-only verify: SELECT name FROM sqlite_master WHERE type='table' AND name IN ('blog_publications','blog_publication_revisions','blog_homepage_publication','blog_homepage_publication_revisions') ORDER BY name;
4. Verify native admin on the production Worker preview through real anonymous and authenticated requests. Then explicitly set Cloudflare Production Text variable BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED=true if the owner approves.
5. Separately enable Cloudflare Production Text variable BLOG_ADMIN_PUBLICATION_ENABLED=true only for owner-approved publishing acceptance. Neither activation flag is committed to the repo; keep_vars preserves dashboard settings.
6. Save a harmless *synthetic test article* privately, choose a new unique slug and explicitly Publish. Verify the anonymous reader route and archive search on the Worker preview. Update, verify revision and content; unpublish and verify 404; restore an earlier published revision. Verify stale-version and bad-origin rejection.
7. Test newsletter/contributor forms using valid Turnstile and harmless synthetic input. Check files are privately present in the intended owner Google Drive before claiming storage success.
8. Unpublish or remove the test article using the reviewed flow; preserve history for audit. Do not substitute CI for a browser-level test.

## Isolation and rollback
- Remove publication activation Text variable and redeploy to freeze publication writes. This does not unpublish previously live articles. Use authenticated Unpublish first if needed.
- Preserve D1 drafts, histories and backups. Worker code rollback is not a database rollback.
- Staging and production databases remain separate. Keep fundlenz.com on ChatGPT Sites until deliberate cutover.
- No Cloudflare Access, Zero Trust, payment card or extra paid service is required.
- Without migration the public archive remains empty; admin publishing fails rather than exposing drafts.
