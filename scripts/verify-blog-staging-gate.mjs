import assert from "node:assert/strict";
import {
  stagingGate, forwardWithoutBasicHeader, serveStagingRequest, isPrivateStagingPath,
} from "./blog-staging-gate-core.mjs";

const host = "https://fundlenz-blog-staging.atharvsahu711.workers.dev";
const adminURL = host + "/blogpost/admin";
const secret = "staging-test-password-that-is-not-real-2026";
const authorizedHeader = "Basic " + btoa("fundlenz-staging:" + secret);
const makeRequest = (path, auth) =>
  new Request(host + path, { headers: auth ? { Authorization: auth } : {} });
const configured = { FUNDLENZ_STAGING_GATE_PASSWORD: secret };

for (const path of [
  "/", "/about", "/upcoming-projects", "/blogpost", "/blogpost/example",
  "/catalogue-global", "/catalogue-india", "/catalogue-securities",
  "/_next/static/chunks/foo.js", "/_next/static/css/style.css",
  "/favicon.svg", "/projects/fincalc/index.html", "/projects/fincalc/core.mjs",
  "/api/blog/subscribe", "/api/blog/contribute",
]) {
  assert.equal(isPrivateStagingPath(path), false, path + " must be public");
  assert.equal(await stagingGate(makeRequest(path), {}), null,
    "No staging password may be required for preview route " + path);
  assert.equal(await stagingGate(makeRequest(path, "Bearer example"), configured), null);
}
for (const path of [
  "/blogpost/admin", "/blogpost/admin/", "/blogpost/admin/settings",
  "/api/blog/admin", "/api/blog/admin/login", "/api/blog/admin/session",
  "/api/blog/admin/homepage-draft",
  "/api/blog%2Fadmin/login", "/blogpost/%61dmin",
  "/api/blog//admin/login", "/API/BLOG/ADMIN/LOGIN",
]) {
  assert.equal(isPrivateStagingPath(new URL(host + path).pathname), true, path);
  assert.equal((await stagingGate(makeRequest(path), {})).status, 503,
    "Missing gate secret must fail closed for admin path " + path);
  const denial = await stagingGate(makeRequest(path), configured);
  assert.equal(denial.status, 401, "Admin must require authentication: " + path);
  assert.match(denial.headers.get("WWW-Authenticate"), /^Basic realm=/);
  assert.equal(await stagingGate(makeRequest(path, authorizedHeader), configured), null);
}
assert.equal(isPrivateStagingPath("/api/blog/%"), true,
  "Malformed URL escape must fail closed");
assert.equal((await stagingGate(makeRequest("/blogpost/admin", "Bearer " + secret),
  configured)).status, 401);
assert.equal((await stagingGate(makeRequest("/blogpost/admin", "Basic invalid@@@"),
  configured)).status, 401);
assert.equal((await stagingGate(makeRequest("/blogpost/admin", "Basic " + btoa("wrong:" + secret)),
  configured)).status, 401);
assert.equal((await stagingGate(makeRequest("/blogpost/admin", "Basic " + btoa("fundlenz-staging:wrong")),
  configured)).status, 401);
assert.equal((await stagingGate(makeRequest("/blogpost/admin", null), {
  FUNDLENZ_STAGING_GATE_PASSWORD: "short",
})).status, 503);

const forwarded = forwardWithoutBasicHeader(makeRequest("/about", authorizedHeader));
assert.equal(forwarded.headers.has("Authorization"), false);
assert.equal(forwarded.url, host + "/about");

const assets = [];
const appRoutes = [];
const env = {
  ...configured,
  ASSETS: {
    async fetch(request) {
      assets.push({ path: new URL(request.url).pathname,
        auth: request.headers.has("Authorization") });
      return new Response("sample JS", { status: 200,
        headers: { "Content-Type": "application/javascript" } });
    },
  },
};
async function app(request) {
  appRoutes.push({ path: new URL(request.url).pathname,
    auth: request.headers.has("Authorization") });
  return new Response("app", { status: 200 });
}
const assetPath = "/_next/static/chunks/test-client.js";
const script = await serveStagingRequest(makeRequest(assetPath), env, app);
assert.equal(script.status, 200);
assert.equal(script.headers.get("Content-Type"), "application/javascript");
assert.equal(assets.length, 1, "Public JS must be served without the browser login");
assert.equal(assets[0].auth, false);
assert.equal(appRoutes.length, 0, "Static scripts must not go through the application");
const calcScript = await serveStagingRequest(makeRequest("/projects/fincalc/core.mjs"), env, app);
assert.equal(calcScript.status, 200, "FinCalc assets must be served without login");
assert.equal(assets.at(-1).path, "/projects/fincalc/core.mjs");
const stylesheet = await serveStagingRequest(makeRequest("/_next/static/css/style.css"),
  env, app);
assert.equal(stylesheet.status, 200);
assert.equal(assets.length, 2);
const about = await serveStagingRequest(makeRequest("/about"), env, app);
assert.equal(about.status, 200);
assert.equal(appRoutes.at(-1).path, "/about");
const homepage = await serveStagingRequest(makeRequest("/"), {}, app);
assert.equal(homepage.status, 200, "Public homepage must not depend on secret setup");
assert.equal((await serveStagingRequest(makeRequest("/blogpost/admin"), env, app)).status, 401);
assert.equal((await serveStagingRequest(makeRequest("/api/blog/admin/session"), env, app)).status, 401);
const authenticatedAdmin = await serveStagingRequest(makeRequest("/blogpost/admin", authorizedHeader),
  env, app);
assert.equal(authenticatedAdmin.status, 200);
assert.equal(appRoutes.at(-1).auth, false, "Basic password must never reach application");
assert.equal((await serveStagingRequest(makeRequest(assetPath), {}, app)).status, 503,
  "Static assets without the ASSETS binding must fail closed");
assert.equal((await serveStagingRequest(makeRequest("/about", authorizedHeader),
  env, app)).status, 200);
assert.equal(appRoutes.at(-1).auth, false, "Basic credentials must be stripped even on public pages");

console.log("PASS: public staging preview needs no browser login; admin remains protected; static assets and credential stripping work");
