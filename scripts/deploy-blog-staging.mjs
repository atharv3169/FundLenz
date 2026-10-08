#!/usr/bin/env node
/**
 * Explicit deployment command for an OWNER-APPROVED staging release.
 * It refuses to deploy a build that names the live fundlenz Worker.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const expectedDB = "7849f805-0efa-49d3-b5bb-26c2527e4cfd";
const configCandidates = [
  resolve("dist/server/wrangler.json"),
  resolve("dist/fundlenz-blog-staging/wrangler.json"),
].filter(existsSync);
if (configCandidates.length !== 1)
  throw new Error("Run 'pnpm run build:blog-staging' first; expected exactly one generated staging config.");
const configPath = configCandidates[0];
const configuration = JSON.parse(readFileSync(configPath, "utf8"));
if (configuration.name !== "fundlenz-blog-staging" ||
    configuration.d1_databases?.[0]?.binding !== "BLOG_ADMIN_DB" ||
    configuration.d1_databases?.[0]?.database_id !== expectedDB ||
    !configuration.keep_vars || configuration.routes || configuration.route ||
    configuration.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES !== "fundlenz-blog-staging.atharvsahu711.workers.dev") {
  throw new Error("Refusing deployment: build output is not an isolated, verified staging Worker.");
}
if (process.env.FUNDLENZ_ALLOW_STAGING_DEPLOY !== "yes")
  throw new Error("Deployment requires explicit approval. Set FUNDLENZ_ALLOW_STAGING_DEPLOY=yes only after reviewing the build.");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "wrangler", "deploy", "--config", configPath], {
  stdio: "inherit", env: process.env,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log("Deployed ONLY to fundlenz-blog-staging. Verify separately in Cloudflare.");
