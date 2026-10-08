import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const compiled = await build({ entryPoints: ["lib/blog-publications.ts"], bundle: true,
  platform: "node", format: "esm", target: "node22", write: false });
const publications = await import("data:text/javascript;base64," +
  Buffer.from(compiled.outputFiles[0].text).toString("base64"));

assert.deepEqual(publications.publishedArticles, []);
const article = (slug, title, category, author) => ({
  slug, title, category, summary: "A carefully explained portfolio question.",
  publishedAt: "2026-10-09", author: { name: author },
  blocks: [{ id: "intro", type: "paragraph", runs: [{ text: "A clear explanation." }] }],
});
const examples = [
  article("market-structure", "Evidence from liquid markets", "Research", "Atharva Sahu"),
  article("learn-funds", "How to read a portfolio", "Learning", "Avika Mishra"),
];
publications.validatePublishedArticles(examples);
assert.deepEqual(publications.searchPublishedArticles(examples, ""), examples);
assert.deepEqual(publications.searchPublishedArticles(examples, " ATHARVA RESEARCH "), [examples[0]]);
assert.deepEqual(publications.searchPublishedArticles(examples, "pOrTfOlio"), [examples[0], examples[1]]);
assert.deepEqual(publications.searchPublishedArticles(examples, "not present"), []);
assert.deepEqual(publications.searchPublishedArticles(examples, "clear explanation"), examples);
assert.deepEqual(publications.searchPublishedArticles([{ ...examples[0], blocks: [
  { id: "styled", type: "paragraph", runs: [{ text: "liqui" }, { text: "dity stress" }] },
  { id: "figure", type: "image", src: "https://example.com/figure.png", alt: "Small-cap redemptions" },
] }, examples[1]], "liquidity"), [{ ...examples[0], blocks: [
  { id: "styled", type: "paragraph", runs: [{ text: "liqui" }, { text: "dity stress" }] },
  { id: "figure", type: "image", src: "https://example.com/figure.png", alt: "Small-cap redemptions" },
] }]);
assert.deepEqual(publications.searchPublishedArticles([{...examples[0], blocks: [
  { id: "figure", type: "image", src: "https://example.com/figure.png", caption: "Redemption pressure" },
]}], "redemption pressure").length, 1);
assert.throws(() => publications.validatePublishedArticles([...examples, examples[0]]), /metadata/);
assert.throws(() => publications.validatePublishedArticles([article("../admin", "Bad path", "Research", "Editor")]), /metadata/);
assert.throws(() => publications.validatePublishedArticles([article("bad-date", "Date", "Research", "Editor"),
  {...examples[0],slug:"invalid",publishedAt:"2026-02-30"}]), /metadata/);
assert.throws(() => publications.validatePublishedArticles([{
  ...examples[0], slug:"unsafe-image", blocks:[{id:"image",type:"image",src:"javascript:alert(1)"}],
}]), /unsafe media URL/);
console.log("PASS: public article search, route slugs, dates, uniqueness and rich-content safety");
