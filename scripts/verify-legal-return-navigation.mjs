import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const result = await build({entryPoints:["lib/legal-navigation-state.ts"],bundle:true,
  platform:"node",format:"esm",target:"node22",write:false});
const navstate = await import("data:text/javascript;base64," +
  Buffer.from(result.outputFiles[0].text).toString("base64"));
const now = Date.now();
for(const [from,to] of [["/catalogue-india?fund=abc","/terms"],
  ["/catalogue-global?fund=xyz","/privacy"],["/catalogue-securities?security=one","/terms"],
  ["/blogpost/fundlenz-qa","/terms"],["/blogpost","/privacy"],["/","/privacy"],["/?funds=ABC,DEF","/terms"]])
  assert.equal(navstate.validLegalSource({from,to,at:now},to,now),true,
    "Preserve last visited page and exact query string");
for(const from of ["//malicious.test","https://malicious.test","/\\evil.test","/terms"]){
  const to="/terms";
  assert.equal(navstate.validLegalSource({from,to,at:now},to,now),false);
}
assert.equal(navstate.validLegalSource({from:"/catalogue-india",to:"/privacy",at:now},"/terms",now),false);
assert.equal(navstate.validLegalSource({from:"/",to:"/privacy",at:now-3*3600000},"/privacy",now),false);
const source=readFileSync("components/legal-navigation.tsx","utf8");
assert.match(source, /router\.back\(\)/,"Arrow must use actual browser history");
assert.match(source, /router\.replace\("\/"\)/,"Direct legal visits need a safe fallback");
assert.match(source, /location\.pathname \+ location\.search \+ location\.hash/);
assert.match(source, /event\.metaKey[\s\S]*event\.ctrlKey/,"New-tab clicks do not overwrite history context");
for(const name of ["app/privacy/page.tsx","app/terms/page.tsx"]){
  const s=readFileSync(name,"utf8");
  assert.match(s, /<LegalBackLink\s*\/>/);
  assert.doesNotMatch(s,/Back to FundLenz/);
}
for(const name of ["app/layout.tsx","components/blog/blog-site-chrome.tsx",
  "components/blog/visitor-forms.tsx"])
  assert.match(readFileSync(name,"utf8"),/<LegalLink href="\/privacy">/);
for(const name of ["app/layout.tsx","components/blog/blog-site-chrome.tsx"])
  assert.match(readFileSync(name,"utf8"),/<LegalLink href="\/terms">/);
const lab=readFileSync("components/fundlens.tsx","utf8");
assert.match(lab,/window\.addEventListener\(LEGAL_CAPTURE_EVENT, capture\)/);
assert.match(lab,/JSON\.stringify\(createSession\(data, amounts, scenario, exampleAmounts\)\)/);
assert.match(lab,/await restoreSession\(pending\.saved\)/,"Use validated saved session, not reset to Overview");
assert.match(lab,/source\.from === currentPath/);
assert.match(lab,/sessionStorage\.removeItem\(LEGAL_LAB_KEY\)/,"State is one-shot");
assert.match(lab,/"holdings", "overlap", "stress", "compare", "methods", "report"/);
console.log("PASS: Legal arrows use previous page and portfolio view/session restore without open redirect");
