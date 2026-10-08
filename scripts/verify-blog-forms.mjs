import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const transformed = await build({
  entryPoints: ["lib/blog-private-form-security.ts"],
  bundle: true, platform: "node", format: "esm", write: false, target: "node22",
});
const moduleUrl = "data:text/javascript;base64," +
  Buffer.from(transformed.outputFiles[0].text, "utf8").toString("base64");
const {
  allowedEmail, boundedText, optionalSocialUrl, requireAllowedOrigin,
  limitedBody, validateHuman, SubmissionError, privateError,
} = await import(moduleUrl);

function rejects(fn, status) {
  assert.throws(fn, error => error instanceof SubmissionError && error.status === status);
}

const originalHosts = process.env.FORMS_ALLOWED_HOSTNAMES;
const originalTurnstile = process.env.TURNSTILE_SECRET_KEY;
const originalFetch = globalThis.fetch;
try {
  process.env.FORMS_ALLOWED_HOSTNAMES = "fundlenz.com";
  process.env.TURNSTILE_SECRET_KEY = "test-only-not-a-real-secret";
  assert.equal(allowedEmail(" Test@EXAMPLE.com "), "test@example.com");
  for (const email of ["bad", "a@", "@example.com", "a@b", "hello @example.com"])
    rejects(() => allowedEmail(email), 400);
  assert.equal(boundedText(" hi ", 5, true), "hi");
  rejects(() => boundedText(" ", 5, true), 400);
  assert.equal(optionalSocialUrl("https://www.instagram.com/fundlenz"), "https://www.instagram.com/fundlenz");
  for (const value of ["javascript:alert(1)", "not-a-url", "ftp://example.com/path"])
    rejects(() => optionalSocialUrl(value), 400);
  const goodRequest = new Request("https://fundlenz.com/api/blog/subscribe", {
    method: "POST", headers: { Origin: "https://fundlenz.com" }, body: "abc",
  });
  requireAllowedOrigin(goodRequest);
  for (const origin of ["https://evil.example", "http://fundlenz.com", "https://fundlenz.com.attacker.com"]) {
    rejects(() => requireAllowedOrigin(new Request("https://fundlenz.com/test", {
      method: "POST", headers: { Origin: origin }, body: "a",
    })), 403);
  }
  rejects(() => requireAllowedOrigin(new Request("https://fundlenz.com/test", {
    method: "POST", body: "a",
  })), 403);
  assert.equal((await limitedBody(goodRequest, 4)).length, 3);
  const oversized = new Request("https://fundlenz.com/test", {
    method: "POST", body: "abcdef",
  });
  await assert.rejects(() => limitedBody(oversized, 5), error => error.status === 413);

  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true, hostname: "fundlenz.com", action: "blog_subscribe",
  }), { headers: { "content-type": "application/json" } });
  await validateHuman(goodRequest, "test-token", "blog_subscribe");
  await assert.rejects(() => validateHuman(goodRequest, "test-token", "blog_contribute"),
    error => error.status === 400);
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true, hostname: "evil.example", action: "blog_subscribe",
  }), { headers: { "content-type": "application/json" } });
  await assert.rejects(() => validateHuman(goodRequest, "test-token", "blog_subscribe"),
    error => error.status === 400);
  const privacy = await privateError(new Error("confidential refresh_token=SECRET")).json();
  assert.equal(JSON.stringify(privacy).includes("SECRET"), false);
  console.log("PASS: blog form security unit checks (origin, validation, size, Turnstile, privacy)");
} finally {
  if (originalHosts === undefined) delete process.env.FORMS_ALLOWED_HOSTNAMES;
  else process.env.FORMS_ALLOWED_HOSTNAMES = originalHosts;
  if (originalTurnstile === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalTurnstile;
  globalThis.fetch = originalFetch;
}
