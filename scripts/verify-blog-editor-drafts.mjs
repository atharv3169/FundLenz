import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const built = await build({
  entryPoints: ["lib/blog-article-draft.ts"], bundle: true,
  platform: "node", format: "esm", write: false, target: "node22",
});
const module = await import("data:text/javascript;base64," +
  Buffer.from(built.outputFiles[0].text, "utf8").toString("base64"));
const validate = module.validateArticleDraft;
const good = { title: "  Fund insights  ", summary: "Intro", body_markdown: "## Section\\nA clear finding",
  category: "Research" };
assert.deepEqual(validate(good), { ...good, title: "Fund insights" });
assert.equal(module.blogDraftCategories.length, 4);
for (const bad of [
  { ...good, title: "" }, { ...good, title: "X".repeat(161) },
  { ...good, body_markdown: "Y".repeat(50001) },
  { ...good, summary: "Z".repeat(601) },
  { ...good, category: "Unapproved" },
  { ...good, status: "published" },
  { ...good, admin: true },
  { ...good, body_markdown: "<script>\u0007</script>" },
]) assert.throws(() => validate(bad));
const auth = readFileSync("lib/blog-editor-auth.ts", "utf8");
const homepage = readFileSync("app/api/blog/admin/homepage-draft/route.ts", "utf8");
const articles = readFileSync("app/api/blog/admin/article-drafts/route.ts", "utf8");
const adminView = readFileSync("components/blog/blog-admin-login.tsx", "utf8");
const dashboard = readFileSync("components/blog/blog-editor-dashboard.tsx", "utf8");
assert.ok(auth.includes("await isAuthenticatedAdmin(request)"));
assert.ok(auth.includes("if (writing) requireAdminOrigin(request, hosts)"));
assert.ok(auth.includes('url.hostname !== BLOG_EDITOR_STAGING_HOST'));
assert.ok(homepage.includes("await requireBlogEditor(request, true)"));
assert.ok(articles.match(/await requireBlogEditor\(request, true\)/g)?.length === 3);
assert.ok(homepage.includes("version=version+1"));
assert.ok(articles.includes("AND status='draft'"));
assert.ok(!articles.includes('status=\'published\''));
assert.ok(adminView.includes('<BlogEditorDashboard onUnsavedChange={setUnsaved} />'));
assert.ok(dashboard.includes('Not published'));
assert.ok(!dashboard.includes("dangerouslySetInnerHTML"));
console.log("PASS: validated private article fields, staging auth boundaries, revision checks and no publish surface");
