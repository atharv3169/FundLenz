import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const compiled = await build({
  entryPoints: ["lib/blog-rich-document.ts"], bundle: true,
  platform: "node", format: "esm", write: false, target: "node22",
});
const mod = await import("data:text/javascript;base64," +
  Buffer.from(compiled.outputFiles[0].text, "utf8").toString("base64"));

const valid = {
  format: "fundlenz-rich-1",
  category: "Corporate Governance & M&A",
  blocks: [
    { id: "intro", type: "heading", runs: [
      { text: "New research", font: "baskerville", color: "#174467", bold: true, sizePx: 28 },
      { text: " read more", href: "https://fundlenz.com/blogpost", underline: true },
    ] },
    { id: "photo", type: "image", src: "https://images.example.org/photo.jpg",
      alt: "Fund manager", caption: "Image caption", widthPct: 45, align: "right" },
    { id: "video", type: "video", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      widthPct: 60, align: "center" },
    { id: "video-link", type: "video-thumbnail", src: "https://vimeo.com/12345678",
      thumbnail: "https://images.example.org/poster.jpg", caption: "Watch interview" },
  ],
};
const serialized = mod.encodeRichDocument(valid);
assert.ok(serialized.startsWith("FLRICH1:"));
assert.deepEqual(mod.decodeRichDocument(serialized, "Research"), valid);
const authorDraft = structuredClone(valid);
authorDraft.author = {
  name:"Guest Researcher", socialLabel:"LinkedIn", socialUrl:"https://www.linkedin.com/in/researcher",
  avatarDataUrl: "data:image/jpeg;base64," + "AAAA".repeat(64),
  displayDate:"2026-10-08", readingMinutes:7,
};
assert.deepEqual(mod.decodeRichDocument(mod.encodeRichDocument(authorDraft)).author, authorDraft.author);
assert.equal(mod.validateRichDocument(valid).author, undefined, "Legacy drafts should remain valid");
assert.throws(() => mod.validateRichDocument({...authorDraft,author:{...authorDraft.author,socialUrl:"javascript:alert(1)"}}), /HTTPS/);
assert.throws(() => mod.validateRichDocument({...authorDraft,author:{...authorDraft.author,avatarDataUrl:"data:image/svg+xml;base64,AAAA"}}), /JPEG/);
assert.throws(() => mod.validateRichDocument({...authorDraft,author:{...authorDraft.author,readingMinutes:200}}), /Reading/);
assert.throws(() => mod.validateRichDocument({...authorDraft,author:{...authorDraft.author,name:"<script>"}}), /author name/);
const articleView = readFileSync("components/blog/blog-paper.tsx", "utf8");
assert.ok(articleView.includes("branding.eyebrow"));
assert.ok(articleView.includes("authorProfile?.socialUrl"));
const adminView = readFileSync("components/blog/blog-editor-dashboard.tsx", "utf8");
assert.ok(adminView.includes("uploadAuthorAvatar"));
assert.ok(adminView.includes("branding={homepage?.content}"));

assert.equal(mod.storedDraftCategory(serialized, "Research"), valid.category);
assert.equal(mod.BLOG_FONTS.length, 22, "All font choices must be whitelisted");
assert.equal(mod.blogFontFamily("baskerville"), "Baskerville, Georgia, serif");
assert.equal(mod.mediaWidth(undefined, "video"), 72, "Older video embeds should default narrower");
assert.equal(mod.mediaWidth(undefined, "image"), 85, "Older images should default narrower");
assert.equal(mod.mediaWidth(35, "video"), 35, "Explicit sizing must override defaults");
assert.deepEqual(mod.decodeRichDocument(serialized).blocks[2], valid.blocks[2]);
assert.ok(mod.legacyArticleDocument("# Introduction\n\nBody paragraph", "Research").blocks.length === 2);
assert.equal(mod.safeEmbedUrl("https://youtu.be/dQw4w9WgXcQ"),
  "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
assert.equal(mod.safeEmbedUrl("https://vimeo.com/12345678"),
  "https://player.vimeo.com/video/12345678");
for (const url of ["javascript:alert(1)", "data:image/svg+xml,...", "http://example.com",
  "https://user:pass@example.com/image.png", "/relative/url"]) {
  assert.equal(mod.safeHttpUrl(url), false, "Unsafe media URL should be rejected: " + url);
}
const clone = value => structuredClone(value);
const wrongLink = clone(valid);
wrongLink.blocks[0].runs[1].href = "javascript:alert(1)";
assert.throws(() => mod.validateRichDocument(wrongLink), /unsafe link/);
const wrongImage = clone(valid);
wrongImage.blocks[1].src = "data:image/svg+xml,<script>...";
assert.throws(() => mod.validateRichDocument(wrongImage), /unsafe media URL/);
const extraKey = clone(valid);
extraKey.blocks[0].runs[0].style = "position:fixed";
assert.throws(() => mod.validateRichDocument(extraKey));
const invalidMediaWidth = clone(valid);
invalidMediaWidth.blocks[2].widthPct = 9;
assert.throws(() => mod.validateRichDocument(invalidMediaWidth), /unsafe media URL/);
const fractionalMediaWidth = clone(valid);
fractionalMediaWidth.blocks[2].widthPct = 63.5;
assert.throws(() => mod.validateRichDocument(fractionalMediaWidth));
const invalidAlignment = clone(valid);
invalidAlignment.blocks[1].align = "position:fixed";
assert.throws(() => mod.validateRichDocument(invalidAlignment));
const invalidTextSize = clone(valid);
invalidTextSize.blocks[0].runs[0].sizePx = 150;
assert.throws(() => mod.validateRichDocument(invalidTextSize));
const invalidFont = clone(valid);
invalidFont.blocks[0].runs[0].font = "evil-font()";
assert.throws(() => mod.validateRichDocument(invalidFont));
const legacyMedia = clone(valid);
delete legacyMedia.blocks[1].widthPct;
delete legacyMedia.blocks[1].align;
assert.equal(mod.validateRichDocument(legacyMedia).blocks[1].widthPct, undefined);
const duplicateIds = clone(valid);
duplicateIds.blocks[1].id = "intro";
assert.throws(() => mod.validateRichDocument(duplicateIds));
assert.throws(() => mod.validateRichDocument({ ...valid, category: "X".repeat(81) }));
assert.throws(() => mod.validateRichDocument({ ...valid, blocks: Array.from({ length: 121 },
  (_, index) => ({ id: "p" + index, type: "paragraph", runs: [{ text: "x" }] })) }));
const huge = clone(valid);
huge.blocks[0].runs[0].text = "A".repeat(12001);
assert.throws(() => mod.validateRichDocument(huge));
const renderer = readFileSync("components/blog/blog-paper.tsx", "utf8");
assert.ok(renderer.includes("<RenderRichBlock"));
assert.ok(renderer.includes("safeEmbedUrl("));
assert.ok(renderer.includes("mediaWidth(media.widthPct, media.type)"));
assert.ok(renderer.includes('media.align === "right"'));
const editor = readFileSync("components/blog/blog-rich-editor.tsx", "utf8");
assert.ok(editor.includes("Text size (px)") && editor.includes('min={12} max={72}'));
assert.ok(editor.includes("BLOG_FONTS.map"));
assert.ok(editor.includes('type="range" min={20} max={100}'));
assert.ok(editor.includes('aria-label="Media alignment"'));
assert.ok(!renderer.includes("dangerouslySetInnerHTML"));
const dashboard = readFileSync("components/blog/blog-editor-dashboard.tsx", "utf8");
assert.ok(dashboard.includes("<BlogPaper "));
assert.ok(dashboard.includes("<BlogRichEditor "));
assert.ok(dashboard.includes('encodeRichDocument('));
const endpoint = readFileSync("app/api/blog/admin/article-drafts/route.ts", "utf8");
assert.ok(endpoint.includes("legacyDbCategory(validated.category)"));
assert.ok(endpoint.includes("storedDraftCategory("));
console.log("PASS: custom categories, rich block roundtrip, HTTPS media safety, preview and admin storage wiring");

for (const date of ["2026-02-30", "2025-02-29", "2026-13-01"])
  assert.throws(() => mod.validateArticleAuthor({displayDate: date}), /date/);
assert.equal(mod.validateArticleAuthor({displayDate:"2024-02-29"}).displayDate,"2024-02-29");
console.log("PASS: impossible calendar dates rejected; leap-day author metadata preserved");

assert.equal(mod.storedDraftCategory("FLRICH1:broken", "Research"), "Research");
assert.throws(() => mod.decodeRichDocument("FLRICH1:broken"), /damaged/);
console.log("PASS: damaged draft does not break listing and still fails closed on open");
