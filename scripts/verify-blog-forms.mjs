import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  // Consent checkbox removed only from newsletter; Submit is an affirmative action.
  // Server consent and anti-bot enforcement are unchanged.
  const src = readFileSync("components/blog/visitor-forms.tsx", "utf8");
  const newsletter = src.split("export function NewsletterBox(")[1]?.split("export function ContributionButton(")[0];
  const contribution = src.split("function ContributionDialog(")[1];
  assert.ok(newsletter && contribution);
  assert.doesNotMatch(newsletter, /type="checkbox"/);
  assert.doesNotMatch(newsletter, /setConsent\(/);
  assert.match(newsletter, /By clicking/);
  assert.match(newsletter, /newsletterPrivacy/);
  assert.match(newsletter, /consent: true/);
  assert.match(newsletter, /href="\/privacy"/);
  assert.match(newsletter, /aria-describedby="fundlenz-newsletter-privacy"/);
  assert.match(newsletter, /disabled=\{busy \|\| !token \|\| !siteKey\}/);

  // A successful signup replaces the entire form with a centered thank-you
  // screen; the back arrow alone reopens the form. Failed requests stay editable.
  assert.match(newsletter, /setView\("thanks"\)/, "Success transitions into confirmation.");
  assert.match(newsletter, /setView\("form"\)/, "Back arrow restores the form.");
  assert.match(newsletter, /if \(view === "thanks"\)/, "Show confirmation instead of a second form.");
  assert.match(newsletter, /if \(view === "loading"\)/, "No flash of the form on reload.");
  assert.match(newsletter, /aria-label="Back to newsletter form"/);
  assert.match(newsletter, /onClick=\{returnToForm\}/, "Only arrow should reopen form.");
  assert.match(newsletter, /Thank you for joining!/);
  assert.match(newsletter, /localStorage\.setItem\(NEWSLETTER_COMPLETE_KEY, "1"\)/,
    "Confirmation state persists across refreshes.");
  assert.match(newsletter, /localStorage\.removeItem\(NEWSLETTER_COMPLETE_KEY\)/,
    "The back arrow explicitly resets the saved view.");
  assert.match(newsletter, /if \(view !== "form" \|\| !token \|\| busy \|\| !siteKey\) return;/,
    "Only active form may submit.");
  assert.match(newsletter, /if \(!response\.ok\) throw new Error\(requestError\(data\)\)/,
    "Failed requests cannot show the success screen.");
  assert.match(newsletter, /setMessage\(error instanceof Error/, "Failures remain visible.");

  const css = readFileSync("components/blog/visitor-forms.module.css", "utf8");
  assert.match(css, /\.newsletterThanks\s*\{[^}]*place-items:\s*center/);
  assert.match(css, /\.newsletterBack:focus-visible/, "Back arrow needs visible keyboard focus.");
  assert.match(css, /\.newsletterBack:hover/, "Back arrow needs hover feedback.");
  assert.match(contribution, /type="checkbox"/);
  const endpoint = readFileSync("app/api/blog/subscribe/route.ts", "utf8");
  assert.match(endpoint, /data\.consent !== true/);
  assert.match(endpoint, /validateHuman\(request, data\.turnstileToken/);
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
