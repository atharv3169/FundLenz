# FundLenz homepage copy editor — integration plan

**Status: component and content model implemented, NOT yet exposed as a usable admin feature.** This work lives in draft PR #4. There is **no admin authentication or article publishing implementation** in the current branch; do not add an insecure public content-editing endpoint.

## Current implementation

- `content/blog-homepage.json` contains the public copy displayed by `app/blogpost/page.tsx`.
- `lib/blog-homepage-content.ts` exports a typed schema, allowed editable fields, character-length rules and server-side validation.
- `components/blog/blog-homepage-editor.tsx` contains a reusable admin text-editing panel with grouping, live draft state, preview, unsaved-change detection, Reset/Discard and Save controls.
- `components/blog/visitor-forms.tsx` accepts editable newsletter heading/description/placeholder/button wording and article contribution button wording.
- `scripts/verify-blog-homepage-copy.mjs` exercises the schema and its invalid-input protections.
- Future search placeholder is included in the copy model but no article search exists yet.

## Editable content fields

| Section | Properties |
|---|---|
| Introduction | eyebrow, heroHeading, heroDescription |
| Article list | articlesHeading, articlesStatus, articlesEmpty, articleSearchPlaceholder |
| Newsletter | newsletterHeading, newsletterDescription, newsletterPlaceholder, newsletterSubmitLabel |
| Footer | contributionButtonLabel, footerDescription, instagramLead |

The Instagram URL, email-consent statements, privacy/terms links, and actual submission targets remain controlled by application code so an admin copy edit cannot replace a legal disclosure or redirect form data. The footer disclaimer validator preserves "not investment advice".

## Connection to the future secure administrator

**Never render this editor to an unauthenticated user and never grant API write access based on frontend state alone.**

1. Complete the single-admin password-hash verification and secure session cookies described in the master project requirements.
2. In the authenticated blog admin menu add **Edit homepage text**; mount `BlogHomepageEditor` with the current content and a protected `onSave` callback.
3. Implement `GET/PUT /api/blog/admin/homepage` with independent server-side authentication and CSRF/origin checks, strict JSON and body limits.
4. The server must call `validateBlogHomepageContent` before GitHub writes. The only approved content path for these updates is `content/blog-homepage.json`. Do not expose the GitHub access token to the browser.
5. Use a least-privilege GitHub publishing workflow with protection compatible with the existing financial release integrity controls. Handle stale SHAs and concurrent changes, require content validation, and avoid unrelated edits.
6. Mark the Save operation successful only when the GitHub write is confirmed. Clearly show a pending deployment state until Cloudflare publishes and verifies the new content. Do **not** falsely promise immediate public visibility.
7. During final staging validation: change the hero and newsletter wording, save, verify a GitHub update, verify the public preview after deployment, reload to confirm persistence, reject unauthorized writes, then restore defaults.
8. Preserve this component on the draft branch until the secure backend and staging environment are available.

The admin can later change the visible homepage wording without editing source code, but actual persistence must be delivered by the secure admin publisher. No visitor submissions or Google Drive secrets are involved in the copy-editor storage.
