import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const nav = readFileSync("components/fundlens-blog-nav.module.css","utf8");
const portfolio = readFileSync("components/fundlens.tsx","utf8");
const securities = readFileSync("components/securities-catalog.tsx","utf8");
const css = readFileSync("app/globals.css","utf8");
const metadata = readFileSync("lib/site-metadata.ts","utf8");
const updater = readFileSync("scripts/automation/validate.py","utf8");

assert.match(css, /grid-template-areas:\s*"brand report" "catalogue securities"/,
  "Legacy base grid remains intact; only the mobile module overrides it");
const mobile = nav.slice(nav.indexOf("/* Compact mobile header:"));
assert.match(mobile, /@media\s*\(max-width:\s*800px\)/,
  "Only mobile/tablet breakpoints should change");
assert.match(mobile, /grid-template-areas:\s*"brand blog" "report catalogue"/,
  "FundLenz and Blog share the first row; Report and Catalogue share the second");
assert.match(mobile, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  "Both second-row buttons share the available width");
assert.match(mobile, /\.labShell:global\(\.portfolio-lab\) :global\(\.masthead \.catalog-nav-link\.lab-blog-link\)[\s\S]*?width:\s*auto;[\s\S]*?justify-self:\s*end/,
  "Blog should be a compact top-right shortcut rather than a full-size card");
assert.match(mobile, /padding-top:\s*11px;[\s\S]*?padding-bottom:\s*11px/,
  "Compact header vertical padding");
assert.match(mobile, /\.labShell:global\(\.portfolio-lab\) :global\(\.masthead \.header-button\)[\s\S]*?grid-area:\s*report/);
assert.match(mobile, /\.labShell:global\(\.portfolio-lab\) :global\(\.masthead \.catalog-nav-link\.lab-blog-link\)[\s\S]*?grid-area:\s*blog/);
assert.match(mobile, /\.labShell:global\(\.portfolio-lab\) :global\(\.masthead \.catalog-nav-link:not\(\.lab-blog-link\)\)[\s\S]*?grid-area:\s*catalogue/);
assert.doesNotMatch(nav.split("/* Compact mobile header:")[0], /grid-template-areas:/,
  "Desktop header is not changed");
const header = portfolio.slice(portfolio.indexOf('<header className="masthead">'),
  portfolio.indexOf('</header>') + '</header>'.length);
assert.ok(header.includes('href="/catalogue-global"'), "Catalogue must remain in the header");
assert.ok(header.includes('href="/blogpost"'), "Blog must remain in the header");
assert.ok(header.includes('View report'), "Report button must remain in the header");
assert.doesNotMatch(header, /Stocks\s*&(?:amp;|)\s*bonds|href="\/catalogue-securities"|global-lab-link/,
  "Stocks and bonds header button must be removed on all viewports");
for (const catalogueFile of ["components/fund-catalog.tsx","components/global-catalog.tsx"]) {
  const catalogue = readFileSync(catalogueFile, "utf8");
  assert.match(catalogue, /href="\/catalogue-securities"/,
    "Securities catalogue must stay accessible through the Catalogue");
}
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
console.log("PASS: compact logo+Blog / Report+Catalogue mobile header, securities navigation and verified dates preserved");
