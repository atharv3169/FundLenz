import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const nav = readFileSync("components/fundlens-blog-nav.module.css","utf8");
const portfolio = readFileSync("components/fundlens.tsx","utf8");
const securities = readFileSync("components/securities-catalog.tsx","utf8");
const css = readFileSync("app/globals.css","utf8");
const metadata = readFileSync("lib/site-metadata.ts","utf8");
const updater = readFileSync("scripts/automation/validate.py","utf8");

const mobile = nav.slice(nav.indexOf("/* FundLenz portfolio masthead ONLY:"));
assert.match(mobile, /@media screen and \(max-width: 800px\)/);
assert.match(mobile, /grid-template-areas: "brand blog catalogue";/,
  "All three controls must share one header row on mobile");
assert.match(mobile, /grid-template-columns: minmax\(max-content, 1fr\) max-content max-content;/,
  "Preserve the full intrinsic brand width; make buttons only as wide as necessary");
assert.match(mobile, /min-height: 44px;/, "Keep accessible 44px button targets");
assert.match(mobile, /@media screen and \(min-width: 381px\) and \(max-width: 800px\)/,
  "Wider button treatment must remain scoped to mobile screens with sufficient room");
assert.match(mobile, /clamp\(70px, 19vw, 88px\) clamp\(108px, 29vw, 130px\)/,
  "Increase Blog/Catalogue button width toward the red-line reference without changing the logo");
assert.match(mobile, /width: 100%;\s*justify-self: stretch;/,
  "Buttons should fill expanded slots rather than keeping their tiny intrinsic widths");
assert.match(mobile, /minmax\(max-content, 1fr\)/,
  "Keep original logo width before allocating space to the buttons");
assert.match(mobile, /font-size: \.75rem;/, "Compact navigation buttons rather than the logo");
assert.match(mobile, /@media screen and \(max-width: 360px\)/,
  "Narrow phones must get smaller button padding, never smaller branding");
assert.doesNotMatch(nav, /\.brand-mark|\.brand\s*\{/,
  "Do not change the logo dimensions or typography");
assert.match(mobile, /grid-area: blog;/);
assert.match(mobile, /grid-area: catalogue;/);
const header = portfolio.slice(portfolio.indexOf('<header className="masthead">'),
  portfolio.indexOf('</header>') + '</header>'.length);
assert.ok(header.includes('href="/catalogue-global"'), "Catalogue remains present");
assert.ok(header.includes('href="/blogpost"'), "Blog remains present");
assert.doesNotMatch(header, /View report|header-button|setTab\("report"\)/,
  "Remove the redundant View report header button at ALL widths");
assert.match(portfolio, /id: "report", label: "Report", icon: FileText/,
  "Keep the underlying on-page Report tab available");
assert.match(portfolio, /<TabsTrigger value=\{t.id\}/,
  "Existing report navigation inside the page must still render");
assert.doesNotMatch(header, /Stocks\s*&(?:amp;|)\s*bonds|href="\/catalogue-securities"|global-lab-link/,
  "Removed Stocks & bonds shortcut must not return");
for (const catalogueFile of ["components/fund-catalog.tsx","components/global-catalog.tsx"]) {
  assert.match(readFileSync(catalogueFile, "utf8"), /href="\/catalogue-securities"/,
    "Stocks/bonds should remain accessible inside Catalogue");
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
console.log("PASS: single-row mobile brand/Blog/Catalogue, no Report shortcut, report tab and verified dates preserved");
