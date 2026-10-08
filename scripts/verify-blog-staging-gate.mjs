import assert from "node:assert/strict";
import {
  stagingGate, forwardWithoutBasicHeader, serveStagingRequest,
} from "./blog-staging-gate-core.mjs";

const url = "https://fundlenz-blog-staging.atharvsahu711.workers.dev/blogpost/admin";
const secret = "staging-test-password-that-is-not-real-2026";
const authorizedHeader = "Basic " + btoa("fundlenz-staging:" + secret);
const makeRequest = (auth, path = url) =>
  new Request(path, { headers: auth ? { Authorization: auth } : {} });
const pass = { FUNDLENZ_STAGING_GATE_PASSWORD: secret };

const unset = await stagingGate(makeRequest(), {});
assert.equal(unset.status, 503);
assert.equal(unset.headers.get("Cache-Control"), "no-store, private");
assert.equal((await stagingGate(makeRequest(), {
  FUNDLENZ_STAGING_GATE_PASSWORD: "short",
})).status, 503);
const challenge = await stagingGate(makeRequest(), pass);
assert.equal(challenge.status, 401);
assert.match(challenge.headers.get("WWW-Authenticate"), /^Basic realm=/);
assert.equal(challenge.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
assert.equal((await stagingGate(makeRequest("Bearer " + secret), pass)).status, 401);
assert.equal((await stagingGate(makeRequest("Basic invalid@@@"), pass)).status, 401);
assert.equal((await stagingGate(makeRequest("Basic " + btoa("wrong:" + secret)), pass)).status, 401);
assert.equal((await stagingGate(makeRequest("Basic " + btoa("fundlenz-staging:wrong")), pass)).status, 401);
for (const path of [url, url.replace("/blogpost/admin", "/_next/static/chunks/foo.js"),
  url.replace("/blogpost/admin", "/api/blog/admin/login"),
  url.replace("/blogpost/admin", "/")]) {
  assert.equal((await stagingGate(makeRequest(authorizedHeader, path), pass)), null,
    "Correct credentials should be accepted for " + path);
  assert.equal((await stagingGate(makeRequest(null, path), pass)).status, 401,
    "Every path must deny unauthenticated requests: " + path);
}
const forwarded = forwardWithoutBasicHeader(makeRequest(authorizedHeader));
assert.equal(forwarded.headers.has("Authorization"), false);
assert.equal(forwarded.url, url);


const assetRequests = [];
const applicationRequests = [];
const mockEnv = {
  ...pass,
  ASSETS: {
    async fetch(request) {
      assetRequests.push({ path: new URL(request.url).pathname, auth: request.headers.has("Authorization") });
      return new Response("sample JS", { status: 200, headers: { "Content-Type": "application/javascript" } });
    },
  },
};
async function mockApplication(request) {
  applicationRequests.push({ path: new URL(request.url).pathname, auth: request.headers.has("Authorization") });
  return new Response("app", { status: 200 });
}
const chunkUrl = url.replace("/blogpost/admin", "/_next/static/chunks/test-client.js");
const chunk = await serveStagingRequest(makeRequest(authorizedHeader, chunkUrl), mockEnv, mockApplication);
assert.equal(chunk.status, 200);
assert.equal(chunk.headers.get("Content-Type"), "application/javascript");
assert.equal(assetRequests.length, 1, "Authenticated JS chunk must reach Cloudflare assets");
assert.equal(applicationRequests.length, 0, "JS chunk must not be handled by Vinext server");
assert.equal(assetRequests[0].auth, false, "HTTP Basic secret must not reach asset binding");
assert.equal((await serveStagingRequest(makeRequest(null, chunkUrl), mockEnv, mockApplication)).status, 401,
  "Unauthenticated clients must not fetch JS");
assert.equal(assetRequests.length, 1, "Unauthorized JS request must not reach assets");
const stylesheet = await serveStagingRequest(makeRequest(authorizedHeader,
  url.replace("/blogpost/admin", "/_next/static/css/style.css")), mockEnv, mockApplication);
assert.equal(stylesheet.status, 200);
assert.equal(assetRequests.length, 2);
const admin = await serveStagingRequest(makeRequest(authorizedHeader), mockEnv, mockApplication);
assert.equal(admin.status, 200);
assert.equal(applicationRequests.length, 1, "App routes must reach the Vinext handler");
assert.equal(applicationRequests[0].auth, false, "HTTP Basic password must not enter the app");
assert.equal((await serveStagingRequest(makeRequest(authorizedHeader, chunkUrl),
  pass, mockApplication)).status, 503, "No asset binding must fail closed");
assert.equal((await serveStagingRequest(makeRequest(), mockEnv, mockApplication)).status, 401);

console.log("PASS: staging gate fails closed, challenges unauthorized traffic on every route, and strips credentials; authenticated JS/CSS are served correctly");
