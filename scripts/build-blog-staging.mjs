#!/usr/bin/env node
/** Builds against the D1-isolated staging Wrangler config; no deploy is triggered. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const filename = resolve("wrangler.blog-staging.jsonc");
if (!existsSync(filename)) throw new Error("Staging Wrangler config is missing.");
const config = JSON.parse(readFileSync(filename, "utf8"));
if (config.name !== "fundlenz-blog-staging" ||
    config.d1_databases?.[0]?.binding !== "BLOG_ADMIN_DB" ||
    config.d1_databases?.[0]?.database_name !== "fundlenz-blog-admin-staging") {
  throw new Error("Staging configuration does not match the isolated resources.");
}
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["run", "build"], {
  stdio: "inherit", env: {
    ...process.env,
    FUNDLENZ_BUILD_TARGET: "blog-staging",
  },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log("Staging build finished. This command did NOT deploy anything.");
