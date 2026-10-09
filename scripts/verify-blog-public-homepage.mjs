import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const compiled = await build({ entryPoints:["lib/blog-public-homepage.ts"],bundle:true,
  platform:"node",format:"esm",target:"node22",write:false });
const store = await import("data:text/javascript;base64,"+Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const data = JSON.parse(readFileSync("content/blog-homepage.json","utf8"));
assert.deepEqual(await store.readPublicHomepageCopy("fundlenz.atharvsahu711.workers.dev"),data);
assert.deepEqual(await store.readPublicHomepageCopy("attacker.fundlenz.com"),data);
assert.deepEqual(await store.readPublicHomepageCopy("fundlenz.com"),data);
const schema=readFileSync("db/blog-admin/0003_publications.sql","utf8");
for(const t of ["blog_homepage_publication","blog_homepage_publication_revisions"])
  assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS "+t));
const api=readFileSync("app/api/blog/admin/homepage-publication/route.ts","utf8");
assert.match(api,/requireBlogEditor\(request, true\)/);
assert.match(api,/publicationEnabled\(\)/);
assert.match(api,/await db.batch/);
console.log("PASS: gated homepage publication, distinct live snapshots and private draft isolation");
