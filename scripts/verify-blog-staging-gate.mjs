import assert from "node:assert/strict";
import {
  stagingGate, forwardWithoutBasicHeader,
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

console.log("PASS: staging gate fails closed, challenges unauthorized traffic on every route, and strips credentials");
