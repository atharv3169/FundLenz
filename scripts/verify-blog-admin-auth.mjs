import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
async function importTS(entryPoint, withCloudflareEnv = false) {
  const built = await build({
    entryPoints: [entryPoint],
    bundle: true, platform: "node", format: "esm", write: false, target: "node22",
    alias: { "@": process.cwd() },
    plugins: withCloudflareEnv ? [{
      name: "mock-cloudflare-env",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^cloudflare:workers$/ }, () =>
          ({ path: "runtime-env", namespace: "fundlenz-test" }));
        pluginBuild.onLoad({ filter: /.*/, namespace: "fundlenz-test" }, () =>
          ({ contents: "export const env = globalThis.__fundlenzAdminTestEnvironment;", loader: "js" }));
      },
    }] : [],
  });
  const encoded = Buffer.from(built.outputFiles[0].text, "utf8").toString("base64");
  return import("data:text/javascript;base64," + encoded);
}
const cryptoModule = await importTS("lib/blog-admin-crypto.ts");
const state = await importTS("lib/blog-admin-state.ts");

const {
  createPasswordVerifier, verifyPassword, BLOG_ADMIN_COOKIE,
  hmacHex, makeSessionToken, parseCookie, sessionCookie, clearSessionCookie, privateAdminResponse,
} = cryptoModule;
const {
  startSession, revokeSession, authenticateSession,
  reserveLoginAttempt, recordLoginFailure, BlogAdminRateLimit,
  validSessionSecret,
} = state;

const verifier = await createPasswordVerifier("super-long-example-password-for-testing");
assert.ok(verifier.startsWith("pbkdf2_sha256$600000$"));
assert.ok(await verifyPassword("super-long-example-password-for-testing", verifier));
assert.equal(await verifyPassword("incorrect-long-example-password", verifier), false);
assert.equal(await verifyPassword("secret", "plaintext-not-a-valid-verifier"), false);
assert.equal(await verifyPassword("secret", "pbkdf2_sha256$1$no$no"), false);
assert.notEqual(await createPasswordVerifier("super-long-example-password-for-testing"), verifier);
await assert.rejects(() => createPasswordVerifier("abcdefghijk"), /12/);
const twelveCharVerifier = await createPasswordVerifier("Abc123xYz987");
assert.ok(await verifyPassword("Abc123xYz987", twelveCharVerifier), "Exactly 12 characters must verify");
assert.equal(await verifyPassword("Abc123xYz98", twelveCharVerifier), false);
assert.equal((await createPasswordVerifier("Abc123xYz987")).startsWith("pbkdf2_sha256$600000$"), true);
assert.ok(validSessionSecret("a".repeat(43)));
assert.equal(validSessionSecret("not-long-enough"), false);

const sessionSecret = "test-".padEnd(44, "a");
const cookieValue = makeSessionToken();
assert.equal(cookieValue.length, 43);
const cookie = sessionCookie(cookieValue);
assert.ok(cookie.includes("Secure; HttpOnly; SameSite=Strict"));
assert.ok(cookie.startsWith(BLOG_ADMIN_COOKIE + "="));
assert.equal(parseCookie(cookie.split(";")[0], BLOG_ADMIN_COOKIE), cookieValue);
assert.ok(clearSessionCookie().includes("Max-Age=0"));
const response = privateAdminResponse({ authenticated: true }, 200, cookie);
assert.ok(response.headers.get("Cache-Control")?.includes("no-store"));
assert.ok(response.headers.get("Set-Cookie")?.includes(BLOG_ADMIN_COOKIE));
assert.equal((await response.json()).authenticated, true);
assert.equal((await hmacHex(sessionSecret, "hello")).length, 64);

function mockDatabase() {
  const sessions = new Map();
  const attempts = new Map();
  const events = new Map();
  return {
    sessions, attempts, events,
    prepare(sql) {
      let args;
      return {
        bind(...params) { args = params; return this; },
        async first() {
          if (sql.startsWith("SELECT token_hash FROM blog_admin_sessions")) {
            const row = sessions.get(args[0]);
            return row && row.expires_at > args[1] && !row.revoked_at ? { token_hash: args[0] } : null;
          }
          if (sql.startsWith("SELECT attempt_count, failure_count") || sql.startsWith("SELECT failure_count")) {
            const row = attempts.get(args[0] + ":" + args[1]);
            return row ? { ...row } : null;
          }
          throw Error("Unknown query: " + sql);
        },
        async run() {
          if (sql.startsWith("INSERT INTO blog_admin_sessions")) {
            sessions.set(args[0], { created_at: args[1], expires_at: args[2], revoked_at: null });
          } else if (sql.startsWith("UPDATE blog_admin_sessions")) {
            const row = sessions.get(args[1]);
            if (row) row.revoked_at = args[0];
          } else if (sql.startsWith("INSERT INTO blog_admin_attempts")) {
            const key = args[0] + ":" + args[1];
            const row = attempts.get(key) || { attempt_count: 0, failure_count: 0 };
            row.attempt_count++;
            attempts.set(key, row);
          } else if (sql.startsWith("UPDATE blog_admin_attempts")) {
            const key = args[0] + ":" + args[1];
            attempts.get(key).failure_count++;
          } else if (sql.startsWith("INSERT OR IGNORE INTO blog_admin_security_events")) {
            if (!events.has(args[0])) events.set(args[0], { created_at: args[1], actor_hash: args[2], failure_count: args[3] });
          } else {
            throw Error("Unknown update: " + sql);
          }
          return { success: true };
        },
      };
    },
  };
}

const db = mockDatabase();
const token = await startSession(db, sessionSecret);
const header = BLOG_ADMIN_COOKIE + "=" + token;
assert.ok(await authenticateSession(db, sessionSecret, header));
assert.equal(await authenticateSession(db, sessionSecret, BLOG_ADMIN_COOKIE + "=invalid-token"), false);
assert.equal(await authenticateSession(db, sessionSecret, null), false);
await revokeSession(db, sessionSecret, header);
assert.equal(await authenticateSession(db, sessionSecret, header), false);

for (let i = 1; i <= 8; i++) {
  const entry = await reserveLoginAttempt(db, sessionSecret, "203.0.113.1");
  assert.equal(entry.attempts, i);
  await recordLoginFailure(db, entry.actorHash, entry.windowId);
}
assert.equal(db.events.size, 1, "One pending security event should be saved after fourth failure");
const event = [...db.events.values()][0];
assert.equal(event.failure_count, 4, "Event is opened at fourth failure, not sent as email");
await assert.rejects(() => reserveLoginAttempt(db, sessionSecret, "203.0.113.1"),
  error => error instanceof BlogAdminRateLimit);
assert.equal((await reserveLoginAttempt(db, sessionSecret, "203.0.113.2")).attempts, 1);
// Server integration: preserve rate-limit 429 while classifying ONLY operational
// failures in staging. No secrets or database values are printed.
const testEnvironment = {
  BLOG_ADMIN_DB: mockDatabase(),
  FUNDLENZ_ADMIN_PASSWORD_HASH: verifier,
  FUNDLENZ_ADMIN_SESSION_SECRET: sessionSecret,
  BLOG_ADMIN_ALLOWED_HOSTNAMES: "fundlenz-blog-staging.atharvsahu711.workers.dev",
};
globalThis.__fundlenzAdminTestEnvironment = testEnvironment;
const server = await importTS("lib/blog-admin-server.ts", true);
const request = new Request(
  "https://fundlenz-blog-staging.atharvsahu711.workers.dev/api/blog/admin/login", {
    method: "POST",
    headers: {
      Origin: "https://fundlenz-blog-staging.atharvsahu711.workers.dev",
      "CF-Connecting-IP": "198.51.100.25",
    },
  },
);
assert.equal((await server.checkAdminPassword(request, "cookiemonster",
  "super-long-example-password-for-testing")).authorized, true,
  "Valid credentials should reach a session-creation-ready state");
assert.equal((await server.checkAdminPassword(request, "cookiemonster",
  "incorrect-password")).authorized, false,
  "Wrong credentials should return unauthorized, not operational failure");
const preparedDb = testEnvironment.BLOG_ADMIN_DB;
testEnvironment.BLOG_ADMIN_DB = { prepare() { throw new Error("mock D1 offline"); } };
await assert.rejects(() => server.checkAdminPassword(request, "cookiemonster",
  "super-long-example-password-for-testing"), error =>
    error instanceof server.AdminCredentialStageFailure &&
    error.stage === "d1-reserve", "Offline D1 reserve must have a safe stage");
testEnvironment.BLOG_ADMIN_DB = preparedDb;

const failingUpdatesDB = mockDatabase();
const prepareOriginal = failingUpdatesDB.prepare.bind(failingUpdatesDB);
failingUpdatesDB.prepare = (sql) => {
  if (sql.startsWith("UPDATE blog_admin_attempts"))
    throw new Error("mock D1 write unavailable");
  return prepareOriginal(sql);
};
testEnvironment.BLOG_ADMIN_DB = failingUpdatesDB;
await assert.rejects(() => server.checkAdminPassword(request, "cookiemonster",
  "incorrect-password"), error =>
    error instanceof server.AdminCredentialStageFailure &&
    error.stage === "d1-failure-count", "D1 failure-count write must be classed separately");
testEnvironment.BLOG_ADMIN_DB = mockDatabase();
for (let i = 0; i < 8; i++) {
  await server.checkAdminPassword(request, "cookiemonster", "incorrect-password");
}
await assert.rejects(() => server.checkAdminPassword(request, "cookiemonster",
  "incorrect-password"), error => !(error instanceof server.AdminCredentialStageFailure) &&
    error.message === "Too many login attempts. Please try again later.",
    "Exhausted D1 login attempts must remain rate-limited, not 503");

console.log("PASS: admin verifier, D1 sessions and safe diagnostic stages, logout, attempt limits");
