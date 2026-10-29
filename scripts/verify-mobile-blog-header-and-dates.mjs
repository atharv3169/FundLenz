import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const nav = readFileSync("components/fundlens-blog-nav.module.css","utf8");
const portfolio = readFileSync("components/fundlens.tsx","utf8");
const securities = readFileSync("components/securities-catalog.tsx","utf8");
const metadata = readFileSync("lib/site-metadata.ts","utf8");
const updater = readFileSync("scripts/automation/validate.py","utf8");
const drawer = readFileSync("components/projects-drawer.tsx", "utf8");
const calc = readFileSync("app/fincalc/page.tsx", "utf8");
const globalCss = readFileSync("app/globals.css", "utf8");

const mobile = nav.slice(nav.indexOf("/* Portfolio Lab mobile masthead."));
assert.match(mobile, /@media screen and \(max-width: 800px\)/);
assert.match(mobile, /grid-template-areas: "brand catalogue menu";/,
  "Mobile brand, Catalogue and menu must occupy a single row in that order");
assert.match(mobile, /grid-template-columns: minmax\(0, 1fr\) max-content 44px;/,
  "Keep the brand flexible and give the right-hand menu a 44px touch target");
assert.match(mobile, /min-height: 44px;/, "Catalogue needs a 44px touch target");
assert.match(mobile, /:global\(\.masthead \.lab-blog-link\),[\s\S]*?:global\(\.masthead \.projects-desktop-trigger\)[\s\S]*?display: none !important;/,
  "Hide Blog and the desktop More projects button at mobile widths");
assert.match(mobile, /:global\(\.masthead \.fundlenz-mobile-menu-trigger\)[\s\S]*?grid-area: menu;/,
  "Place hamburger immediately to the right of Catalogue");
assert.match(mobile, /@media screen and \(max-width: 360px\)/,
  "Compact layout must accommodate narrow phones");
assert.match(drawer, /<Menu size=\{22\}/, "Render a three-line hamburger icon");
assert.match(drawer, /aria-label="Open navigation menu"/,
  "Hamburger must have an accessible label");
assert.match(drawer, /A project by <Link href="\/about"/,
  "Place creator credit/link at top of mobile drawer");
assert.match(drawer, /href="\/fincalc"/, "Keep FinCalc available in the drawer");
assert.match(drawer, /href="\/blogpost"/, "Move Blog into the mobile drawer");
assert.match(drawer, /aria-modal="true"/, "Drawer needs a dialog");
assert.match(drawer, /event.key === "Escape"/, "Drawer remains keyboard dismissible");
assert.match(globalCss, /text-decoration-line: underline !important;/,
  "Creator link must be visibly underlined, not hover-only");
assert.match(globalCss, /\.masthead \.project-credit a\[href="\/about"\]/);
assert.match(globalCss, /@media screen and \(max-width: 800px\)[\s\S]*?\.fincalc-header \.masthead-right \.catalogue-main-link/,
  "FinCalc must share the same mobile Catalogue/menu layout");
assert.match(calc, /className="catalog-nav-link catalogue-main-link"/,
  "FinCalc Catalogue button must use the common mobile positioning rule");
const header = portfolio.slice(portfolio.indexOf('<header className="masthead">'),
  portfolio.indexOf('</header>') + '</header>'.length);
assert.ok(header.includes('href="/catalogue-global"'), "Catalogue remains present");
assert.match(header, /className="catalog-nav-link catalogue-main-link"/,
  "Portfolio Catalogue uses the explicit mobile grid slot");
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
console.log("PASS: single-row mobile brand/Catalogue/menu, creator link, drawer navigation, no overlap, report tab and verified dates preserved");
