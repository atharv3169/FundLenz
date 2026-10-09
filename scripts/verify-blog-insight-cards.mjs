import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
async function load(path) {
  const result = await build({entryPoints: [path], bundle:true, platform:"node",format:"esm",target:"node22",write:false});
  return import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].text).toString("base64"));
}

const cards = await load("lib/blog-insight-cards.ts");
const homepage = await load("lib/blog-homepage-content.ts");
const rich = await load("lib/blog-rich-document.ts");
const publications = await load("lib/blog-publications.ts");
const good = {...cards.defaultArticleInsightCards[0]};
assert.equal(cards.validateInsightCards([good])[0].title,"Understand the market. Not just the headlines.");
assert.deepEqual(cards.validateInsightCards([]),[]);
assert.deepEqual(cards.parseHomepageInsightCards("[]"),[]);
const pair=[good,{...good,id:"another-card",size:"large",title:"Second card"}];
assert.deepEqual(cards.parseHomepageInsightCards(cards.encodeHomepageInsightCards(pair)),pair);
assert.throws(()=>cards.validateInsightCards([{...good,id:"../../admin"}]),/identifier/);
assert.throws(()=>cards.validateInsightCards([good,good]),/duplicate/);
assert.throws(()=>cards.validateInsightCards([{...good,title:"<script>alert(1)</script>"}]),/title/);
assert.throws(()=>cards.validateInsightCards([{...good,size:"800px"}]),/size/);
assert.throws(()=>cards.validateInsightCards([{...good,customCss:"display:none"}]),/Unexpected/);
assert.throws(()=>cards.validateInsightCards(Array(9).fill(good)),/Too many/);
assert.throws(()=>cards.encodeHomepageInsightCards(Array(6).fill(good)),/Too many/);

const oldHomepage=JSON.parse(readFileSync("content/blog-homepage.json","utf8"));
delete oldHomepage.sideCardsLeft; delete oldHomepage.sideCardsRight;
const compat=homepage.validateBlogHomepageContent(oldHomepage);
assert.equal(compat.sideCardsLeft,"[]");
assert.equal(compat.sideCardsRight,"[]");
assert.deepEqual(homepage.validateBlogHomepageContent({...compat,sideCardsLeft:JSON.stringify(pair)}).sideCardsLeft,
  JSON.stringify(pair));
assert.throws(()=>homepage.validateBlogHomepageContent({...compat,sideCardsRight:JSON.stringify([{...good,title:"<b>Unsafe</b>"}])}));
assert.throws(()=>homepage.validateBlogHomepageContent({...compat, sideCardsLeft:JSON.stringify([good,good])}));
assert.throws(()=>homepage.validateBlogHomepageContent({...compat, sideCardsRight:"not-json"}));
assert.throws(()=>homepage.validateBlogHomepageContent({...compat,footerDescription:"Please buy our recommended investments."}));
const legacy=rich.validateRichDocument({format:"fundlenz-rich-1",category:"Research",
  blocks:[{id:"a",type:"paragraph",runs:[{text:"test"}]}]});
assert.equal(legacy.sideCards,undefined,"Legacy documents must keep their original sidebar by default.");
const doc=rich.validateRichDocument({...legacy,sideCards:pair});
assert.deepEqual(rich.decodeRichDocument(rich.encodeRichDocument(doc)).sideCards,pair);
assert.deepEqual(rich.decodeRichDocument(rich.encodeRichDocument({...doc,sideCards:[]})).sideCards,[]);
assert.throws(()=>rich.validateRichDocument({...doc,sideCards:[{...good,eyebrow:"<h1>"}]}));
const article={slug:"card-qa",title:"Card QA",summary:"A secure preview.",publishedAt:"2026-10-09",
  category:"Research",author:{name:"FundLenz"},blocks:legacy.blocks,sideCards:pair};
publications.validatePublishedArticles([article]);
assert.throws(()=>publications.validatePublishedArticles([{...article,sideCards:[{...good,title:"<svg/onload=alert(1)>"}]}]));
assert.equal(publications.searchPublishedArticles([article],"Card QA").length,1);

const page=readFileSync("app/blogpost/page.tsx","utf8");
const homepageEditor=readFileSync("components/blog/blog-homepage-editor.tsx","utf8");
const articleEditor=readFileSync("components/blog/blog-editor-dashboard.tsx","utf8");
const articlePage=readFileSync("app/blogpost/[slug]/page.tsx","utf8");
const paper=readFileSync("components/blog/blog-paper.tsx","utf8");
const homeCss=readFileSync("app/blogpost/page.module.css","utf8");
const paperCss=readFileSync("components/blog/blog-paper.module.css","utf8");
for(const src of [homepageEditor,articleEditor]) {
  assert.match(src,/BlogInsightCardsEditor/);
  assert.match(src,/onChange=\{cards/);
}
assert.match(page,/leftCards\.map\(card/);
assert.match(page,/rightCards\.map\(card/);
assert.match(homeCss,/@media\(max-width:1100px\)/);
assert.match(homeCss,/\.homeCenter\{order:0/);
assert.match(homeCss,/\.homeLeftRail\{order:1/);
assert.match(homeCss,/\.homeRightRail\{order:2/);
assert.match(paper,/sideCards \?\? defaultArticleInsightCards/);
assert.match(paperCss,/@media\(max-width:720px\)/);
assert.match(articlePage,/sideCards=\{article\.sideCards\}/);
assert.match(readFileSync("app/api/blog/admin/publications/route.ts","utf8"),/doc\.sideCards/);
assert.match(articleEditor,/setDirty\(true\)/);
console.log("PASS: secure insight cards, old D1 compatibility, draft serialization, public validation, positioning and mobile layout");
