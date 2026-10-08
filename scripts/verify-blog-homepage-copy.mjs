import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const built = await build({
  entryPoints: ["lib/blog-homepage-content.ts"],
  bundle: true, platform: "node", format: "esm", write: false, target: "node22",
  alias: { "@": process.cwd() },
});
const entry = "data:text/javascript;base64," +
  Buffer.from(built.outputFiles[0].text, "utf8").toString("base64");
const { blogHomepageFields, defaultBlogHomepageContent, validateBlogHomepageContent } = await import(entry);

const actual = validateBlogHomepageContent(defaultBlogHomepageContent);
assert.equal(actual.heroHeading, "Research worth reading.");
assert.equal(new Set(blogHomepageFields.map(f => f.key)).size, blogHomepageFields.length);
assert.equal(Object.keys(actual).length, blogHomepageFields.length);
for (const field of blogHomepageFields) {
  assert.ok(actual[field.key].length > 0);
  assert.ok(actual[field.key].length <= field.max);
  assert.ok(field.label && field.group);
}
assert.throws(() => validateBlogHomepageContent({ ...actual, heroHeading: "" }), /Invalid value/);
assert.throws(() => validateBlogHomepageContent({ ...actual, heroHeading: "x".repeat(122) }), /Invalid value/);
assert.throws(() => validateBlogHomepageContent({ ...actual, unapprovedKey: "hello" }), /Unexpected/);
assert.throws(() => validateBlogHomepageContent({ ...actual, footerDescription: "Nothing to see" }), /Footer disclaimer/);
console.log("PASS: editable blog homepage copy fields and server-side validation");
