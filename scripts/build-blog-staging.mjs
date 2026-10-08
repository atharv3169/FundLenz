#!/usr/bin/env node
/**
 * Build the protected, reviewed FundLenz source as-is. Only AFTER the build,
 * replace the GENERATED Wrangler deploy target with the isolated staging config.
 *
 * Never modify package.json, vite.config.ts, wrangler.jsonc, or financial data.
 * Never deploy from this script.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const staging = JSON.parse(readFileSync(resolve("wrangler.blog-staging.jsonc"), "utf8"));
const production = JSON.parse(readFileSync(resolve("wrangler.jsonc"), "utf8"));
const expectedHost = "fundlenz-blog-staging.atharvsahu711.workers.dev";
const expectedDB = "7849f805-0efa-49d3-b5bb-26c2527e4cfd";
if (production.name !== "fundlenz" || staging.name !== "fundlenz-blog-staging" ||
    !staging.keep_vars || staging.preview_urls !== false ||
    staging.d1_databases?.length !== 1 ||
    staging.d1_databases[0].binding !== "BLOG_ADMIN_DB" ||
    staging.d1_databases[0].database_id !== expectedDB ||
    staging.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES !== expectedHost ||
    staging.routes || staging.route || staging.triggers) {
  throw new Error("Staging resources do not match the owner-reviewed configuration.");
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["run", "build"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const outputPath = resolve("dist/server/wrangler.json");
if (!existsSync(outputPath)) throw new Error("The normal Vinext build did not generate a Wrangler deploy config.");
const generated = JSON.parse(readFileSync(outputPath, "utf8"));
const generatedTriggers = generated.triggers;
const noActiveTriggers = generatedTriggers == null || (
  typeof generatedTriggers === "object" && !Array.isArray(generatedTriggers) &&
  Object.keys(generatedTriggers).every(key => key === "crons") &&
  (generatedTriggers.crons == null ||
   (Array.isArray(generatedTriggers.crons) && generatedTriggers.crons.length === 0))
);
console.log("Safe staging build diagnostics:", JSON.stringify({
  generatedName: generated.name,
  hasRoute: Boolean(generated.route),
  routesCount: Array.isArray(generated.routes) ? generated.routes.length : -1,
  triggerKeys: generatedTriggers && typeof generatedTriggers === "object" ? Object.keys(generatedTriggers) : [],
  noActiveTriggers,
  d1Count: Array.isArray(generated.d1_databases) ? generated.d1_databases.length : -1,
  environmentsCount: generated.env && typeof generated.env === "object" ? Object.keys(generated.env).length : -1,
  hasAdminHostnameVar: Boolean(generated.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES),
  // Do not print any environment variables, tokens or confidential values.
}));
if (generated.name !== production.name || generated.routes || generated.route || !noActiveTriggers ||
    (generated.d1_databases && generated.d1_databases.length) ||
    (generated.env && Object.keys(generated.env).length) ||
    (generated.vars && Object.keys(generated.vars).some(key => key === "BLOG_ADMIN_ALLOWED_HOSTNAMES"))) {
  throw new Error("Unexpected production-generated deployment settings; refusing staging conversion.");
}

// Inject the staging-only access gate at the Worker's true entrypoint, so it runs
// before ALL application routes or assets. Never modify the production source entrypoint.
const workerEntry = generated.main;
if (typeof workerEntry !== "string" ||
    !/^(?:\.\/)?[a-zA-Z0-9_./-]+\.js$/.test(workerEntry) ||
    workerEntry.includes("..") ||
    !existsSync(resolve("dist/server", workerEntry))) {
  throw new Error("Unexpected generated Worker entrypoint; refusing to install staging gate.");
}
if (!generated.assets || typeof generated.assets !== "object" || Array.isArray(generated.assets)) {
  throw new Error("Worker assets config is missing; cannot guarantee staging gate runs for static assets.");
}
const gateModule = resolve("dist/server/blog-staging-gate-core.mjs");
copyFileSync(resolve("scripts/blog-staging-gate-core.mjs"), gateModule);
const entry = "./" + workerEntry.replace(/^\.\//, "");
const wrapper = resolve("dist/server/blog-staging-gate-entry.mjs");
writeFileSync(wrapper, [
  "import application from " + JSON.stringify(entry) + ";",
  'import { stagingGate, forwardWithoutBasicHeader } from "./blog-staging-gate-core.mjs";',
  "export default {",
  "  async fetch(request, env, ctx) {",
  "    const denial = await stagingGate(request, env);",
  "    if (denial) return denial;",
  "    if (!application || typeof application.fetch !== 'function')",
  '      return new Response("Staging handler unavailable.", { status: 503 });',
  "    const nextResponse = await application.fetch(forwardWithoutBasicHeader(request), env, ctx);",
  "    const headers = new Headers(nextResponse.headers);",
  '    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");',
  '    headers.set("Cache-Control", "private, no-store");',
  "    return new Response(nextResponse.body, { status: nextResponse.status, statusText: nextResponse.statusText, headers });",
  "  },",
  "};",
  "",
].join("\n"), "utf8");
generated.main = "./blog-staging-gate-entry.mjs";
// Without this, Cloudflare serves /_next/static assets before the Worker sees auth.
generated.assets.run_worker_first = true;

// Rewrite only the generated, ignored build artifact. It is NOT a tracked repository file.
generated.name = staging.name;
generated.workers_dev = true;
generated.preview_urls = false;
generated.keep_vars = true;
generated.d1_databases = staging.d1_databases;
generated.vars = { ...(generated.vars || {}), ...staging.vars };
generated.observability = staging.observability;
// Vinext adds an empty triggers object in generated configs; do not register a cron.
delete generated.triggers;

writeFileSync(outputPath, JSON.stringify(generated, null, 2) + "\n", "utf8");
console.log("Staging artifact prepared for " + staging.name + " with D1 binding " + expectedDB);
console.log("Staging Basic Auth gate applied at Worker entrypoint; all static assets run Worker first.");
console.log("PASS: original source configuration left unchanged; NO deployment occurred.");
