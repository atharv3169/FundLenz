import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const compiled = await build({ entryPoints: ["lib/blog-publication-store.ts"], bundle: true,
  platform: "node", format: "esm", target: "node22", write: false });
const store = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
for (const slug of ["good-name", "funds-2026", "a"]) assert.equal(store.validPublicationSlug(slug), true);
for (const slug of ["../admin", "Uppercase", "a--b", "a/", "x".repeat(101), ""]) assert.equal(store.validPublicationSlug(slug), false);
const sample = {
  slug: "article-test", title: "A study of concentration", summary: "Research on diversification.",
  category: "Research", publishedAt: "2026-10-09", author: { name: "FundLenz" },
  blocks: [{ id: "intro", type: "paragraph", runs: [{ text: "Market analysis." }] }],
};
assert.deepEqual(store.parsePublication(JSON.stringify(sample)), sample);
assert.throws(() => store.parsePublication(JSON.stringify({...sample, blocks:[{id:"bad",type:"image",src:"javascript:evil()"}]})));
assert.throws(() => store.parsePublication(JSON.stringify({...sample, slug:"../admin"})));
const sql = readFileSync("db/blog-admin/0003_publications.sql","utf8");
for(const name of ["blog_publications", "blog_publication_revisions"]) assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS "+name));
assert.ok(!/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i.test(sql));
const handler=readFileSync("app/api/blog/admin/publications/route.ts","utf8");
assert.match(handler,/requireBlogEditor\(request, true\)/);
assert.match(handler,/requirePublicationSwitch\(\)/);
assert.match(handler,/writePublication/);
assert.match(handler,/validDraft\(draft, data.draftVersion\)/);
console.log("PASS: publication migration, safe slugs, validated snapshots, admin publishing guards");
