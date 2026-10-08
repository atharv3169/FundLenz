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


## Newspaper-style rich editor milestone (8 October 2026)

The owner supplied the SSRN academic article layout as a **visual reference** (not a request to copy trademarks/content): broad serif article column on the left, related reading and social-sharing sections on the right, clean editorial masthead, generous page typography, structured media/captions, and reduced unused space. The article editor in staging was too narrow and the old "Preview text" tab just displayed source text.

Implementation on this staging branch:

- \`components/blog/blog-paper.tsx\` + CSS implement a responsive, reusable published-article **layout renderer**. The private admin preview is a simulation of the eventual published article; it has the left article column, right related-reading/share sidebar, editorial byline, educational footer, and supported images/videos/thumbnails. No published article route exists yet.
- \`components/blog/blog-rich-editor.tsx\` + CSS implement a larger block editor with text controls (bold, italic, underline, color, serif/sans/mono font, three text sizes, HTTPS links), paragraph/heading/subheading/quote blocks, image and video URL blocks, and clickable external-video thumbnails. Add and remove blocks, drag by handles or use arrow buttons to reorder. These controls use browser rich editing commands as a compatibility baseline. Test caret preservation and pasted text in Chrome before release. Not a full Word/Tiptap equivalent.
- The **Preview article** mode uses \`BlogPaper\`, not a source-text box, so it closely mirrors the intended published layout. It uses other staging drafts as example related-reading cards but **never makes drafts public**. Social share links will activate when a real public URL exists; sharing an unpublished private URL would be misleading and unsafe.
- Any user-specified category label up to 80 characters is supported (e.g., Geopolitics, Opinion, Art, Technology), even though the original \`blog_article_drafts.category\` SQL column has a four-value CHECK constraint. To avoid rebuilding or losing the owner's existing D1 data, the true custom category is stored in the strict \`FLRICH1:\` JSON article body envelope, while the legacy column retains one of the four original safe labels. GET endpoints unpack and return the actual category. The old Markdown drafts are mapped into rich text blocks on first edit; saving migrates them to the versioned envelope. This is a compatibility design, not a general SQL category migration.
- \`lib/blog-rich-document.ts\` validates the exact rich schema: only supported block kinds and style properties, no raw HTML, capped field counts/sizes, strict HTTPS media/link URLs with no credentials, no arbitrary CSS or JavaScript, unique block IDs. The article renderer uses React text nodes and validated URLs, not \`dangerouslySetInnerHTML\`.
- **Media is URL-only at this milestone.** Images require an HTTPS image URL, video embeds support whitelisted YouTube/Vimeo URL parsing or direct MP4/WebM/Ogg; clickable thumbnail blocks support an HTTPS poster URL. The editing UI allows dragging/reordering entire media/text blocks. Dragging a local image file does **not** upload it and explains that private media storage is still required. Never claim local file upload or private media hosting is finished.
- All article changes still save through existing administrator-authenticated, staging-host-only D1 APIs with origin checks, optimistic revision checks and draft-only status. Published article routes, GitHub publishing, actual related article permalink navigation, file uploads, media library and social shares are not live yet. The public \`fundlenz.com\` portfolio lab remains unchanged.

**Owner acceptance test after CI and successful staging Cloudflare deployment:**
1. Log in to the staging admin, open the existing draft and confirm its legacy text migrated to visible editor blocks.
2. Change category to a custom value not in the previous four presets. Select a phrase, apply bold/color/font and insert an HTTPS inline hyperlink.
3. Add a heading between paragraphs, an HTTPS image with caption, a YouTube/Vimeo video, and a clickable video thumbnail with HTTPS poster. Drag the handles to rearrange blocks.
4. Open **Preview article** and inspect the newspaper layout and sidebar on desktop and mobile.
5. Save the private draft, reload, reopen it, confirm custom category, media order, styling and links persisted. Never expose its private URL through social sharing.
6. Test invalid \`javascript:\` URLs; the editor/API must reject these. Validate stale-tab save conflict and logout still block editing.
7. Keep draft PR open until browser tests succeed. Plan public article publication and optional safe R2/media-storage setup as separate reviewed tasks.
