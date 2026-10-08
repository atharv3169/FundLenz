# FundLenz editor reliability audit — 8 October 2026

**Scope:** staging draft editor, existing saved draft compatibility, preview-rendering safety and administrator persistence constraints. No production publication or user secret changes. Changes reside only on \`feature/drive-private-submissions-20261008\`, PR #4.

## Findings and changes

1. **Primary selection issue: editing React-managed DOM directly.** The prior implementation used \`document.execCommand\`, \`Range.extractContents\`, and \`Range.insertNode\` to apply selected-text font/size/bold/color. React independently maintained a rich-run model and re-rendered the same editable DOM. This introduces selection/caret instability, unexpected nested markup, and possible duplicated/missing text. Replaced formatting operations with pure, immutable \`applyRunStyle\` / \`toggleRunStyle\` functions. They split only the selected run segments by UTF-16 DOM offsets, never touch the editable DOM to apply formatting, and verify original text is preserved. Links remain restricted to HTTPS.
2. **Selection lost when switching to toolbars.** The editor now preserves selection offsets tied to a text block, so an ordinary HTML select or size input can lose focus without forgetting the selected substring. Attempted styling across two different text blocks is now rejected visibly rather than applying a stale range to the wrong block.
3. **Premature save-disable / stale content.** Previously a contentEditable mutation didn't mark the parent dirty until blur; the Save button could stay disabled until a second click. The editor now reports unsaved text immediately through \`onInput\`. When saving would require an oversized or otherwise unparseable block, \`onValidityChange\` disables Save until the content is corrected instead of allowing the old draft state to masquerade as a successful save.
4. **Paste from web/Word.** Paste converts to plain text, preventing uncontrolled third-party HTML/style markup from being injected into the contentEditable React tree. Unsupported long paragraphs are rejected with an explanatory message. No HTML is stored.
5. **Legacy style compatibility.** Relative font-size markers from existing saved drafts are recognized on normalization. Very large old Markdown articles with more than 120 distinct paragraphs now fail clearly rather than being silently truncated.
6. **Media and draft boundaries.** The existing server-side allowlist still validates media/link HTTPS URLs, width percentages and alignment; data serialization only accepts draft status. Staging D1 keeps version-checked updates and admin-session/host/origin guards. No change to production website or automatic public publishing.

## Automated checks

- \`scripts/verify-blog-rich-format.mjs\` runs deterministic selected-substring styling tests, Unicode preservation and 1,625 seeded random multi-style edits. It rejects invalid ranges and verifies text and original run arrays are unchanged.
- \`scripts/verify-blog-rich-document.mjs\` tests schema validation, custom categories, legacy media widths, media URLs, invalid styles/URLs, and preview/editor wiring.
- \`scripts/verify-blog-editor-browser.mjs\` runs a **real headless Chrome/Chromium** with the actual React editor in a small Vite fixture (no third-party browser-testing dependency). It highlights a substring, switches font through the HTML selector, applies bold and numeric text size, enters further text, blurs and checks persisted model text/formatting, and rejects cross-block selection. Browser profile is isolated and cleaned up.
- Existing blog visitor-form/security, admin-authentication, D1 schema, staging-gate, TypeScript, production-build and isolated staging Worker tests remain in CI.

## Important limits / manual acceptance

A successful CI run does not prove zero bugs. The browser fixture does not exercise the **actual Cloudflare staging login or D1-backed save/reload**, because those credentials and private state cannot be accessed from the public CI runner. After an updated staging deployment:
1. Sign in to \`/blogpost/admin\`, open an **existing** saved draft and copy any valuable text elsewhere before editing.
2. Select several middle words in one paragraph. Apply Garamond, 28 px, bold, color and an HTTPS link; confirm other words are unchanged.
3. Type before and after the formatted text, switch paragraphs, save, reload, reopen and compare article text/formatting and the newspaper preview.
4. Copy-paste from Word and a webpage. It should insert text, not third-party HTML.
5. Insert/resize/align video and image blocks, save and reload; verify responsive preview.
6. Open the same draft in two tabs and confirm stale-version save returns conflict; logout and confirm unauthorized editing fails.
7. Confirm old drafts and \`fundlenz.com\` are untouched.

No guarantee of a completely bug-free editor is possible. If any error remains, capture the exact browser console message and steps to reproduce. Direct local file uploads and live publishing remain out of scope for this audit.
