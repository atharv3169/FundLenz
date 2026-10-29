import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = f => readFileSync(f,"utf8");
const header = read("components/site-header.tsx");
const root = read("app/layout.tsx");
const nav = read("components/fundlens-blog-nav.module.css");
const portfolio = read("components/fundlens.tsx");
const securities = read("components/securities-catalog.tsx");
const drawer = read("components/projects-drawer.tsx");
const globalCss = read("app/globals.css");
const metadata = read("lib/site-metadata.ts");
const updater = read("scripts/automation/validate.py");
// Shared geometry with page-specific button destinations.
assert.match(root, /<SiteHeader \/>/);
assert.match(header, /styles\.siteHeader/);
assert.match(header, /className="brand"/);
assert.match(header, /className="brand-mark"/);
assert.match(header, /<ScanSearch size=\{25\} strokeWidth=\{1\.7\}/);
assert.match(header, /usePathname\(\)/);
assert.match(header, /pathname === "\/blogpost" \|\| pathname\.startsWith\("\/blogpost\/"\)/);
assert.match(header, /href: "\/catalogue-global", label: "Catalogue"/);
assert.match(header, /href: "\/", label: "Portfolio Lab"/);
assert.match(header, /href: "\/blogpost\/admin", label: "Admin"/);
assert.match(header, /href: "\/blogpost", label: "Blog"/);
assert.match(header, /blogPage && reviewedEditorHost/);
assert.match(header, /isReviewedEditorHost/);
assert.match(header, /useSyncExternalStore\(subscribeToHost, isEditorHost, serverEditorHost\)/);
assert.match(header, /href=\{primary\.href\} className="catalog-nav-link catalogue-main-link"/);
assert.match(header, /href=\{secondary\.href\} className="catalog-nav-link lab-blog-link"/);
assert.match(header, /<ProjectsDrawer \/>/);
assert.match(header, /href="\/about"/);
assert.ok(header.indexOf('className="catalog-nav-link catalogue-main-link"') < header.indexOf('className="catalog-nav-link lab-blog-link"'));
assert.ok(header.indexOf('className="catalog-nav-link lab-blog-link"') < header.indexOf('<ProjectsDrawer />'));
assert.ok(header.indexOf('<ProjectsDrawer />') < header.indexOf('className="project-credit'));
assert.doesNotMatch(header, /View report|Stocks & bonds|masthead-action/);
assert.doesNotMatch(read("app/fincalc/page.tsx"), /masthead-action|Back to Portfolio Lab/);
for(const path of ["components/fundlens.tsx","components/fund-catalog.tsx","components/global-catalog.tsx","components/securities-catalog.tsx","app/fincalc/page.tsx","app/blogpost/page.tsx","app/blogpost/[slug]/page.tsx"]) {
  assert.doesNotMatch(read(path), /<header className="masthead|<BlogSiteHeader/,path+" reintroduces a divergent header");
}
for(const path of ["components/fund-catalog.tsx","components/global-catalog.tsx","components/securities-catalog.tsx"])
  assert.match(read(path), /className="catalog-market-tabs"/);
assert.doesNotMatch(read("app/blogpost/page.tsx"), /Blog editorial access|href="\/blogpost\/admin"/,
  "No duplicate Blog Admin link in page body");
// Exact main homepage navigation, logo and spacing now shared with all routes.
assert.match(nav, /@media screen and \(max-width: 800px\)/);
assert.match(nav, /grid-template-areas: "brand catalogue blog menu";/);
assert.match(nav, /grid-template-columns: max-content minmax\(0, 1\.5fr\) minmax\(0, \.85fr\) 44px;/);
assert.match(nav, /column-gap: 12px;/);
assert.match(nav, /column-gap: 5px;/);
assert.match(nav, /height: auto;/);
assert.match(nav, /min-height: 60px;/);
assert.match(nav, /font-size: clamp\(1\.25rem, 5\.7vw, 1\.5rem\)/);
assert.match(nav, /width: 34px;[\s\S]*?height: 34px;/);
assert.match(nav, /:global\(\.masthead-right\) \{ display: contents; \}/);
assert.match(nav, /grid-area: catalogue;[\s\S]*?height: 35px;[\s\S]*?min-height: 35px;/);
assert.match(nav, /grid-area: blog;[\s\S]*?min-height: 35px;[\s\S]*?height: 35px;/);
assert.match(nav, /grid-area: catalogue;[\s\S]*?font-size: \.75rem;/);
assert.match(nav, /grid-area: blog;[\s\S]*?font-size: \.75rem;/);
assert.match(nav, /inset: -5px 0;/,"Effective 45px tap region retained");
assert.match(nav, /@media screen and \(max-width: 360px\)/);
assert.match(nav, /:global\(\.fundlenz-mobile-menu-trigger\)[\s\S]*?grid-area: menu;/);
assert.match(nav, /:global\(\.projects-desktop-trigger\)[\s\S]*?display: none !important;/);
assert.match(drawer, /<Menu size=\{22\}/);
assert.match(drawer, /aria-label="Open navigation menu"/);
assert.match(drawer, /href="\/fincalc"/);
assert.match(drawer, /href="\/blogpost"/);
assert.match(drawer, /aria-modal="true"/);
assert.match(drawer, /event.key === "Escape"/);
assert.match(drawer, /data-close-projects[\s\S]*?className="[^"]*border-0 bg-transparent/);
assert.match(globalCss, /\.fundlenz-mobile-menu-trigger \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
assert.match(globalCss, /\.fundlenz-drawer-footer \{[\s\S]*?margin-top: 14px !important;[\s\S]*?padding-top: 14px;/);
// Preserve dataset source and finance reporting integrity.
assert.match(portfolio, /id: "report", label: "Report", icon: FileText/);
assert.match(portfolio, /<TabsTrigger value=\{t.id\}/);
assert.match(portfolio, /Snapshot · \{snapshotLabel\}/);
assert.match(portfolio, /Last catalogue update · \{catalogueUpdateLabel \?\? "Not yet recorded"\}/);
assert.match(securities, /Last catalogue update \{catalogueUpdateLabel \?\? "not yet recorded"\}/);
for(const file of ["components/fund-catalog.tsx","components/global-catalog.tsx"]){
 assert.match(read(file), /Last catalogue update \{catalogueUpdateLabel\}/);
 assert.match(read(file), /href="\/catalogue-securities"/);
}
assert.match(metadata, /lastCatalogueUpdateDate/);
assert.match(updater, /stage_catalogue_update_date\(root, files, acquisition\)/);
assert.match(updater, /if not data_paths:/);
assert.match(updater, /if catalogue_update_date:[\s\S]*?lastCatalogueUpdateDate=catalogue_update_date/);
assert.doesNotMatch(portfolio, /Snapshot · \{catalogueUpdateLabel\}/);
assert.match(nav, /data-primary="portfolio"/);
assert.match(nav, /white-space: normal;/);
assert.match(nav, /data-section="blog"/);
assert.match(nav, /@media screen and \(min-width: 801px\)/);
assert.match(header, /project-credit[\s\S]*?href="\/about"/);
console.log("PASS: route-specific header buttons, 35px mobile controls, linked desktop creator and unchanged financial data");
