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
  assert.ok(field.optional || actual[field.key].length > 0);
  assert.ok(actual[field.key].length <= field.max);
  assert.ok(field.label && field.group);
}
assert.throws(() => validateBlogHomepageContent({ ...actual, heroHeading: "" }), /Invalid value/);
assert.throws(() => validateBlogHomepageContent({ ...actual, heroHeading: "x".repeat(122) }), /Invalid value/);
assert.throws(() => validateBlogHomepageContent({ ...actual, unapprovedKey: "hello" }), /Unexpected/);
assert.throws(() => validateBlogHomepageContent({ ...actual, footerDescription: "Nothing to see" }), /Footer disclaimer/);
assert.equal(validateBlogHomepageContent(Object.fromEntries(
  Object.entries(actual).filter(([key]) => !key.startsWith("social") && key !== "articleMastheadRight")
)).socialFacebookEnabled,"false");
assert.throws(() => validateBlogHomepageContent({...actual,socialXEnabled:"true"}),/HTTPS/);
assert.throws(() => validateBlogHomepageContent({...actual,socialFacebookUrl:"javascript:alert(1)"}),/HTTPS/);
assert.equal(validateBlogHomepageContent({...actual,articleMastheadRight:""}).articleMastheadRight,"");
console.log("PASS: editable blog homepage copy fields and server-side validation");
// Staging storefront must reflect the saved, server-validated copy, without
// ever allowing private D1 drafts to leak on the regular production host.
const stageBuilt = await build({
  entryPoints: ["lib/blog-staging-homepage.ts"],
  bundle: true, platform: "node", format: "esm", write: false, target: "node22",
  alias: { "@": process.cwd() },
});
const stageMod = await import("data:text/javascript;base64," +
  Buffer.from(stageBuilt.outputFiles[0].text, "utf8").toString("base64"));
const saved = {
  ...actual,
  eyebrow: "FundLenz Blog",
  socialFacebookUrl: "https://www.facebook.com/fundlenz",
  socialFacebookEnabled: "true",
  socialXUrl: "https://x.com/fundlenz",
  socialXEnabled: "true",
};
let reads = 0;
const mockDb = {
  prepare(query) {
    assert.equal(query, "SELECT content_json FROM blog_homepage_draft WHERE id=1");
    reads++;
    return { async first() { return { content_json: JSON.stringify(saved) }; } };
  },
};
const staged = await stageMod.readStagingHomepageCopy(stageMod.BLOG_STAGING_HOST, mockDb);
assert.equal(staged.socialFacebookEnabled, "true", "Saved checkbox should appear in staging");
assert.equal(staged.socialFacebookUrl, saved.socialFacebookUrl, "Saved social href should appear in staging");
assert.equal(staged.eyebrow, "FundLenz Blog", "Saved homepage title should appear in staging");
assert.equal(reads, 1);
const publicCopy = await stageMod.readStagingHomepageCopy("fundlenz.com", mockDb);
assert.equal(publicCopy.socialFacebookEnabled, "false", "Never serve staging draft on public website");
assert.equal(reads, 1, "Production-host requests must not query private D1");
assert.equal((await stageMod.readStagingHomepageCopy("FUNDLENZ.COM", mockDb)).heroHeading, actual.heroHeading);
await assert.rejects(stageMod.readStagingHomepageCopy(stageMod.BLOG_STAGING_HOST), /database is unavailable/);
const fallback = await stageMod.readStagingHomepageCopy(stageMod.BLOG_STAGING_HOST, {
  prepare() { return { async first() { return null; } }; },
});
assert.equal(fallback.heroHeading, actual.heroHeading, "Empty staging draft defaults safely");
await assert.rejects(stageMod.readStagingHomepageCopy(stageMod.BLOG_STAGING_HOST, {
  prepare() { return { async first() { return { content_json: JSON.stringify({ ...saved, socialXUrl: "javascript:alert(1)" }) }; } }; },
}), /HTTPS/);
const blogSource = (await import("node:fs")).readFileSync("app/blogpost/page.tsx", "utf8");
const chromeSource = (await import("node:fs")).readFileSync("components/blog/blog-site-chrome.tsx", "utf8");
assert.ok(blogSource.includes("await readPublicHomepageCopy(host, db)") && blogSource.includes('dynamic = "force-dynamic"'));
assert.ok(blogSource.includes("<BlogSiteFooter copy={copy}/>"));
assert.ok(chromeSource.includes("<small>BLOG</small>"));
assert.ok(!chromeSource.includes("Catalogue</Link>") && !chromeSource.includes("Stocks &amp; bonds</Link>"));
console.log("PASS: saved homepage drafts remain staged; public copy requires explicit promotion and navigation stays intact");

