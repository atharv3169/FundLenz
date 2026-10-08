# Blog refinement and integrity audit — 9 October 2026

## Scope and release status

Reviewed and refined the existing blog development branch, starting at
`246653731abbae0dce2961af40bb1a595f0d3df2`. The verified implementation is
`e5a2a174f4253f810ca74ad512333f15c8eb351d`.

Changes remain in draft PR #4. They have not been merged into `main` or published
as public articles. No portfolio lab components, catalogue data, financial
calculations, production configuration, dependencies, secrets or D1 schema were
changed. Existing drafts were not edited or deleted during this audit.

## Corrections

- Replaced silent truncation of heavily formatted DOM content with explicit
  validation. All 300 supported text runs are preserved; excessive content leaves
  the last valid model intact and blocks saving.
- Commit typing and plain-text paste to the draft model immediately, without
  repainting browser-owned contentEditable DOM or moving the typing caret.
- Count line breaks consistently when remembering selections across native
  paragraph and BR nodes. Formatting preserves the selected substring.
- Track invalid paragraphs separately so editing another valid paragraph cannot
  incorrectly re-enable saving. Removing the affected block clears its error.
- Preserve article edits across homepage-tab visits; warn before discarding
  homepage edits, reloading drafts, leaving the page or signing out.
- Reload closes the old article only after fetching the new list successfully,
  avoiding an editor left on a stale revision. Save conflicts retain user edits.
- Decode an opened draft before changing either its title or body. A damaged draft
  cannot inherit the previously open article's text. One damaged row no longer
  prevents listing the remaining drafts; strict decoding still prevents editing it.
- Block edits during pending saves/image processing, ignore disabled drag/drop,
  and insert dropped images after the actual target block.
- Clear an optional thumbnail URL correctly, reject impossible calendar dates,
  and validate unsaved media/link URLs before rendering a preview.
- Release obsolete editable-node callback references and merge equivalent text
  formatting regardless of property insertion order.

## Editor and presentation improvements

- Undo/redo with a bounded 40-step history of article-body edits, including block
  changes. Consecutive typing in one focused block is grouped. Ctrl/Cmd+Z and redo
  shortcuts work in text blocks. History is in memory, not a persistent backup.
- Clear formatting, unlink, live word/block counts and estimated reading time.
- Search drafts by title/category and save an article with Ctrl/Cmd+S.
- More legible blog headline typography, consistent cards and spacing, mobile
  controls, visible keyboard focus, and article section navigation.
- Show the entire article summary rather than silently clipping it to four lines.
- Keep existing structured rich-document storage, fonts, media controls, author
  metadata, private preview and staging-only saves.

## Verification evidence

The final implementation passed [GitHub Actions run 37784451338](https://github.com/atharv3169/FundLenz/actions/runs/37784451338):

- Scoped blog ESLint and full TypeScript checks.
- Origin, validation, upload-size, Turnstile and private-response unit tests.
- Admin password verification, session/logout, attempt-limit and staging-gate tests.
- Homepage validation and staging-only presentation checks.
- Rich-document round trips, unsafe URL rejection, calendar dates and damaged drafts.
- 1,625 seeded formatting operations preserving text, including Unicode.
- Real Chromium interaction regressions covering font/size changes, typing,
  paste, newline selections, cross-block rejection, long paragraphs, 300 runs,
  invalid-block isolation, undo/redo, navigation guards and failed-save recovery.
- Browser draft save/conflict and damaged-draft tests using an isolated mock API.
  These tests do not authenticate against or write to the owner's D1 database.
- Responsive editor/article overflow checks at 320, 390, 768 and 1440 pixels.
- D1 schema checks, production compilation and isolated staging compilation.

The existing six portfolio/catalogue regression suites also passed locally via
`node scripts/verify-all.mjs`; source-backed data and reviewed-release checks
passed on GitHub. Fixture screenshots of the editor and article preview were
visually reviewed. The deployed branch-preview homepage and contribution dialog
were inspected in the browser; no application-origin console errors were observed.

Cloudflare reported a successful staging build for this exact implementation:
build `fcb45155-c648-4d15-9c88-5f1c30847a8e`, Worker version
`80c7527d-6d74-4272-83a3-5ae0c84d8798`.

## Remaining integration and launch work

- Real newsletter and contributor submissions still need an end-to-end test of
  Turnstile and Google Drive storage in the configured environment. Mock and unit
  tests are not evidence that the owner's live OAuth configuration works.
- The authenticated live admin save/reopen flow was not rerun using the owner's
  private credentials in this audit. No default or test account was enabled.
- Public article publication, permanent article URLs, archive/search, editorial
  inbox and direct media uploads remain separate unfinished roadmap features.
- Security-event notification transport remains pending; durable database events
  are not proof that an email notification was delivered.
- This is a tested staging refinement, not a claim of complete production
  readiness or an assurance that every possible future bug has been eliminated.
