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
assert.match(mobile, /grid-template-areas: "brand catalogue blog menu";/,
  "Brand, Catalogue, Blog, and menu must appear in that order on mobile");
assert.match(mobile, /grid-template-columns: max-content minmax\(0, 1\.5fr\) minmax\(0, \.85fr\) 44px;/,
  "Reserve space for the logo, expand Catalogue and Blog, and keep the 44px menu");
assert.match(mobile, /grid-area: catalogue;[\s\S]*?height: 40px;[\s\S]*?min-height: 40px;/,
  "Catalogue border must be 40px high on mobile");
assert.match(mobile, /grid-area: blog;[\s\S]*?min-height: 40px;[\s\S]*?height: 40px;/,
  "Blog border must be 40px high on mobile");
assert.match(mobile, /inset: -2px 0;/,
  "Both shortened buttons retain at least a 44px effective touch area");
assert.match(mobile, /column-gap: 12px;/,
  "Subtly enlarge spacing between logo and action buttons on regular phones");
assert.match(mobile, /column-gap: 5px;/,
  "Allow a small extra gap on the narrowest phones");
assert.match(mobile, /grid-area: catalogue;[\s\S]*?font-size: \.75rem;/,
  "Catalogue label font size must remain unchanged");
assert.match(mobile, /grid-area: blog;[\s\S]*?font-size: \.75rem;/,
  "Blog label font size must remain unchanged");
assert.match(mobile, /grid-area: catalogue;[\s\S]*?width: 100%;[\s\S]*?justify-self: stretch;/,
  "Catalogue must extend into available space beside the logo");
assert.match(mobile, /grid-area: blog;[\s\S]*?width: 100%;[\s\S]*?justify-self: stretch;/,
  "Blog should fill its grid column instead of shrinking to its text width");
assert.match(mobile, /@media screen and \(max-width: 360px\)[\s\S]*?grid-template-columns: max-content/,
  "Narrow phones must retain a compact, non-overlapping grid");
assert.match(mobile, /:global\(\.masthead \.lab-blog-link\)[\s\S]*?grid-area: blog;[\s\S]*?display: inline-flex !important;/,
  "Display Blog between Catalogue and menu on mobile");
assert.match(mobile, /:global\(\.masthead \.projects-desktop-trigger\)[\s\S]*?display: none !important;/,
  "Hide only the desktop More projects button at mobile widths");
assert.match(mobile, /:global\(\.masthead \.fundlenz-mobile-menu-trigger\)[\s\S]*?grid-area: menu;/,
  "Place hamburger immediately to the right of Blog");
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
assert.doesNotMatch(drawer, /overflow-y-auto border-l border-\[#385d6c\]/,
  "Drawer left edge must not have a contrasting border");
assert.match(drawer, /data-close-projects[\s\S]*?className="[^"]*border-0 bg-transparent/,
  "Close X must be unboxed while remaining a reachable button");
assert.match(drawer, /fundlenz-drawer-footer mt-auto border-t/,
  "Drawer footer needs its own responsive spacing hook");
assert.match(globalCss, /\.fundlenz-drawer-footer \{[\s\S]*?margin-top: 14px !important;[\s\S]*?padding-top: 14px;/,
  "On mobile, lower divider must sit near Blog rather than at the viewport bottom");
assert.match(drawer, /event.key === "Escape"/, "Drawer remains keyboard dismissible");
assert.match(globalCss, /\.fundlenz-mobile-menu-trigger \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/,
  "Hamburger must have no permanent border or filled background");
assert.match(globalCss, /\.fundlenz-mobile-menu-trigger:focus-visible \{/,
  "Keep keyboard focus visible even on a borderless trigger");
assert.match(globalCss, /\.fundlenz-drawer-creator \{[\s\S]*?margin: 0 0 28px !important;/,
  "Creator credit must be clearly spaced away from the projects heading");
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
assert.ok(header.indexOf('href="/catalogue-global"') < header.indexOf('href="/blogpost"'),
  "Catalogue must appear before Blog in mobile header");
assert.ok(header.indexOf('href="/blogpost"') < header.indexOf('<ProjectsDrawer />'),
  "Blog must appear immediately before the projects drawer control");
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
console.log("PASS: expanded Catalogue/Blog buttons, borderless drawer edge and close X, compact lower Blog divider, and verified navigation/data invariants");
