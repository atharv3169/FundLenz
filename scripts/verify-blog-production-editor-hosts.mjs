#!/usr/bin/env node
/** Offline adversarial host/session tests. Never reads production secrets or D1. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
async function importTS(path, workerEnv = false) {
  const built = await build({
    entryPoints: [path], bundle: true, platform: "node", format: "esm",
    write: false, target: "node22", alias: { "@": process.cwd() },
    plugins: workerEnv ? [{
      name: "fake-cloudflare-runtime",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^cloudflare:workers$/ }, () =>
          ({ path: "environment", namespace: "blog-editor-tests" }));
        pluginBuild.onLoad({ filter: /.*/, namespace: "blog-editor-tests" }, () =>
          ({ contents: "export const env = globalThis.__fundlenzAdminTestEnvironment;", loader: "js" }));
      },
    }] : [],
  });
  return import("data:text/javascript;base64," +
    Buffer.from(built.outputFiles[0].text).toString("base64"));
}
const policy = await importTS("lib/blog-editor-hosts.ts");
const editor = await importTS("lib/blog-editor-auth.ts", true);
const admin = await importTS("lib/blog-admin-server.ts", true);
const cryptoUtils = await importTS("lib/blog-admin-crypto.ts");
const staging = policy.BLOG_EDITOR_STAGING_HOST;
const worker = policy.BLOG_EDITOR_PRODUCTION_HOST;
const future = policy.BLOG_EDITOR_FUTURE_HOST;
const secret = "a".repeat(43);
const token = "T".repeat(43);
const validCookie = cryptoUtils.BLOG_ADMIN_COOKIE + "=" + token;
const currentHash = await cryptoUtils.hmacHex(secret, "admin-session:" + token);

function memoryDb() {
  const hashes = new Set([currentHash]);
  return {
    hashes,
    prepare(sql) {
      assert.ok(sql.startsWith("SELECT token_hash FROM blog_admin_sessions"),
        "Only a read-only authenticated session lookup is allowed in this fixture");
      return {
        bind(hash) { this.hash = hash; return this; },
        async first() { return hashes.has(this.hash) ? { token_hash: this.hash } : null; },
      };
    },
  };
}
const stageDb = memoryDb();
const prodDb = memoryDb();
const stagingEnv = {
  BLOG_ADMIN_DB: stageDb, FUNDLENZ_ADMIN_PASSWORD_HASH: "test-only",
  FUNDLENZ_ADMIN_SESSION_SECRET: secret, BLOG_ADMIN_ALLOWED_HOSTNAMES: staging,
};
const productionEnv = {
  BLOG_ADMIN_DB: prodDb, FUNDLENZ_ADMIN_PASSWORD_HASH: "test-only",
  FUNDLENZ_ADMIN_SESSION_SECRET: secret, BLOG_ADMIN_ALLOWED_HOSTNAMES: worker,
};
globalThis.__fundlenzAdminTestEnvironment = stagingEnv;
function request(host, opts = {}) {
  const origin = opts.origin === undefined ? "https://" + host : opts.origin;
  const headers = { Cookie: opts.cookie === undefined ? validCookie : opts.cookie };
  if (origin !== null) headers.Origin = origin;
  return new Request((opts.scheme || "https") + "://" + host +
      (opts.port ? ":" + opts.port : "") + "/api/blog/admin/article-drafts",
      { method: opts.write ? "PUT" : "GET", headers });
}
async function expects(code, operation) {
  await assert.rejects(operation, e => {
    assert.equal(e.status, code, "Unexpected security result: " + String(e));
    return true;
  });
}
assert.ok(policy.isReviewedEditorHost(staging));
assert.ok(policy.isReviewedEditorHost(worker));
assert.ok(policy.isReviewedEditorHost(future));
for (const forbidden of ["sub.fundlenz.com", "fundlenz.com.attacker.invalid",
                         "fundlenz-blog-staging.atharvsahu711.workers.dev.evil",
                         "notfundlenz.atharvsahu711.workers.dev", "fundlenz.net"])
  assert.equal(policy.isReviewedEditorHost(forbidden), false);
for (const forbiddenUrl of ["http://" + worker, "https://" + worker + ":8443",
                            "https://evil.invalid", "https://name:pass@" + worker])
  assert.equal(policy.isReviewedEditorUrl(forbiddenUrl), false);

// Staging permissions remain unchanged, with an independent protected DB.
assert.equal(await editor.requireBlogEditor(request(staging)), stageDb);
assert.equal(await editor.requireBlogEditor(request(staging, { write: true })), stageDb);
await expects(503, () => editor.requireBlogEditor(request(worker)));
await expects(401, () => editor.requireBlogEditor(request(staging, { cookie: "" })));
await expects(403, () => editor.requireBlogEditor(request(staging, { write: true, origin: null })));
await expects(403, () => editor.requireBlogEditor(request(staging, { write: true, origin: "https://evil.invalid" })));

// Explicit production configuration grants access to that exact Worker only.
globalThis.__fundlenzAdminTestEnvironment = productionEnv;
assert.equal(await editor.requireBlogEditor(request(worker)), prodDb);
assert.equal(await editor.requireBlogEditor(request(worker, { write: true })), prodDb);
assert.equal(await admin.isAuthenticatedAdmin(request(worker)), true);
await expects(503, () => editor.requireBlogEditor(request(staging)));
await expects(503, () => editor.requireBlogEditor(request(future)));
await expects(404, () => editor.requireBlogEditor(request("fundlenz.com.attacker.invalid")));
await expects(404, () => editor.requireBlogEditor(request(worker, { scheme: "http" })));
await expects(404, () => editor.requireBlogEditor(request(worker, { port: "8443" })));
await expects(403, () => editor.requireBlogEditor(request(worker, { write: true, origin: "https://" + staging })));
await expects(401, () => editor.requireBlogEditor(request(worker, { cookie: "" })));
assert.equal(await admin.isAuthenticatedAdmin(request("evil.invalid")), false);
assert.throws(() => admin.requireAdminOrigin(request("evil.invalid", { write: true }),
  ["evil.invalid"]), e => e instanceof admin.AdminForbidden);

prodDb.hashes.clear();
await expects(401, () => editor.requireBlogEditor(request(worker)));
prodDb.hashes.add(currentHash);

// Future domain is NOT active until the operator separately opts in at cutover.
productionEnv.BLOG_ADMIN_ALLOWED_HOSTNAMES = worker + "," + future;
assert.equal(await editor.requireBlogEditor(request(future)), prodDb);
assert.equal(await editor.requireBlogEditor(request(future, { write: true })), prodDb);
await expects(403, () => editor.requireBlogEditor(request(future, {
  write: true, origin: "https://" + worker,
}));
productionEnv.BLOG_ADMIN_ALLOWED_HOSTNAMES = worker;
productionEnv.BLOG_ADMIN_DB = undefined;
await assert.rejects(() => editor.requireBlogEditor(request(worker)),
  e => e instanceof admin.AdminUnavailable || /not configured/.test(String(e)));
productionEnv.BLOG_ADMIN_DB = prodDb;

// Production homepage content must never reveal staging draft copy.
const copy = readFileSync("lib/blog-staging-homepage.ts", "utf8");
assert.ok(copy.includes('if (host !== BLOG_STAGING_HOST) return defaultBlogHomepageContent'));
console.log("PASS: strict staging/production host isolation, origin+session enforcement, future domain inactive until runtime opt-in");
