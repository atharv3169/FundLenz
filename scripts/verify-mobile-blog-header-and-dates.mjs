import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const nav = readFileSync("components/fundlens-blog-nav.module.css","utf8");
const portfolio = readFileSync("components/fundlens.tsx","utf8");
const securities = readFileSync("components/securities-catalog.tsx","utf8");
const css = readFileSync("app/globals.css","utf8");
const metadata = readFileSync("lib/site-metadata.ts","utf8");
const updater = readFileSync("scripts/automation/validate.py","utf8");

assert.match(css, /grid-template-areas:\s*"brand report" "catalogue securities"/,
  "Core phone header layout is 2 columns");
const mobile = nav.slice(nav.indexOf("/* Mobile only:"));
assert.match(mobile, /@media\s*\(max-width:\s*800px\)/);
assert.match(mobile, /grid-template-areas:\s*"brand report" "catalogue securities" "blog blog"/,
  "Blog should live on its own mobile row");
assert.match(mobile, /\.labShell:global\(\.portfolio-lab\) :global\(\.masthead \.catalog-nav-link\.lab-blog-link\)[\s\S]*?grid-area:\s*blog/);
assert.doesNotMatch(nav.split("/* Mobile only:")[0], /grid-template-areas:/,
  "No changes to the pre-existing desktop/tablet header layout");
assert.match(portfolio, /className="catalog-nav-link lab-blog-link" href="\/blogpost"/);
assert.match(portfolio, /Snapshot · \{snapshotLabel\}/,
  "Per-fund disclosure date must stay genuine");
assert.match(portfolio, /Last catalogue update · \{catalogueUpdateLabel \?\? "Not yet recorded"\}/,
  "The last verified *site-wide* data release must display on the lab");
assert.match(securities, /Last catalogue update \{catalogueUpdateLabel \?\? "not yet recorded"\}/,
  "Securities catalogue must share the same verified release marker");
for (const file of ["components/fund-catalog.tsx","components/global-catalog.tsx"]) {
  assert.match(readFileSync(file,"utf8"), /Last catalogue update \{catalogueUpdateLabel\}/);
}
assert.match(metadata, /lastCatalogueUpdateDate/);
assert.match(updater, /stage_catalogue_update_date\(root, files, acquisition\)/);
assert.match(updater, /if not data_paths:/,
  "No accepted fund changes must not advance the update label");
assert.match(updater, /if catalogue_update_date:[\s\S]*?lastCatalogueUpdateDate=catalogue_update_date/,
  "Updater must save the verified date atomically with data");
assert.doesNotMatch(portfolio, /Snapshot · \{catalogueUpdateLabel\}/,
  "Publication date cannot replace a stale source snapshot date");
console.log("PASS: standalone Blog row on mobile; real snapshots and shared verified-update metadata preserved");
