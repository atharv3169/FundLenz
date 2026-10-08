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
      { text: "New research", font: "serif", color: "#174467", bold: true },
      { text: " read more", href: "https://fundlenz.com/blogpost", underline: true },
    ] },
    { id: "photo", type: "image", src: "https://images.example.org/photo.jpg",
      alt: "Fund manager", caption: "Image caption" },
    { id: "video", type: "video", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "video-link", type: "video-thumbnail", src: "https://vimeo.com/12345678",
      thumbnail: "https://images.example.org/poster.jpg", caption: "Watch interview" },
  ],
};
const serialized = mod.encodeRichDocument(valid);
assert.ok(serialized.startsWith("FLRICH1:"));
assert.deepEqual(mod.decodeRichDocument(serialized, "Research"), valid);
assert.equal(mod.storedDraftCategory(serialized, "Research"), valid.category);
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
assert.ok(!renderer.includes("dangerouslySetInnerHTML"));
const dashboard = readFileSync("components/blog/blog-editor-dashboard.tsx", "utf8");
assert.ok(dashboard.includes("<BlogPaper "));
assert.ok(dashboard.includes("<BlogRichEditor "));
assert.ok(dashboard.includes('encodeRichDocument('));
const endpoint = readFileSync("app/api/blog/admin/article-drafts/route.ts", "utf8");
assert.ok(endpoint.includes("legacyDbCategory(validated.category)"));
assert.ok(endpoint.includes("storedDraftCategory("));
console.log("PASS: custom categories, rich block roundtrip, HTTPS media safety, preview and admin storage wiring");
