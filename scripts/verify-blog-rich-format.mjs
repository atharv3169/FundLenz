import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = await import(pathToFileURL(viteRequire.resolve("esbuild")).href);
const compiled = await build({
  entryPoints: ["lib/blog-rich-format.ts"], bundle: true,
  platform: "node", format: "esm", write: false, target: "node22",
});
const fmt = await import("data:text/javascript;base64," +
  Buffer.from(compiled.outputFiles[0].text, "utf8").toString("base64"));
const getText = fmt.richText;

let runs = [{ text: "Why fund size matters in markets" }];
const original = getText(runs);
const selected = { start: 4, end: 13 }; // "fund size"
runs = fmt.applyRunStyle(runs, selected, { font: "baskerville" });
assert.equal(getText(runs), original);
assert.deepEqual(runs.map(r => [r.text, r.font]), [
  ["Why ", undefined], ["fund size", "baskerville"], [" matters in markets", undefined],
]);
runs = fmt.applyRunStyle(runs, selected, { sizePx: 28 });
runs = fmt.toggleRunStyle(runs, selected, "bold");
runs = fmt.applyRunStyle(runs, selected, { color: "#123456" });
runs = fmt.applyRunStyle(runs, selected, { href: "https://fundlenz.com/blogpost" });
assert.equal(getText(runs), original);
assert.ok(runs.find(r => r.text === "fund size" && r.font === "baskerville" &&
  r.sizePx === 28 && r.bold && r.color === "#123456" && r.href?.startsWith("https:")));
assert.equal(runs[0].font, undefined);
assert.equal(runs.at(-1).href, undefined);
runs = fmt.toggleRunStyle(runs, selected, "bold");
assert.ok(!runs.find(r => r.text === "fund size").bold);
const alreadyFormatted = fmt.applyRunStyle(runs, selected, { sizePx: 28 });
assert.deepEqual(alreadyFormatted, runs, "Idempotent styling should not split text endlessly");
assert.notEqual(alreadyFormatted, undefined);
assert.equal(getText(fmt.applyRunStyle([{text:""}], null, {font:"times"})), "");
assert.equal(getText(fmt.applyRunStyle([{text:"hello"}], {start:1,end:1}, {bold:true})), "hello");

const oldRuns = [{text:"Left",italic:true},{text:" middle ",font:"serif"},{text:"right",bold:true}];
const cloned = structuredClone(oldRuns);
const changed = fmt.applyRunStyle(oldRuns,{start:2,end:10},{sizePx:24});
assert.deepEqual(oldRuns, cloned, "Source must never be mutated");
assert.equal(getText(changed), getText(oldRuns));
assert.equal(changed[0].text,"Le");
assert.equal(changed.at(-1).text,"right");
for (const span of [{start:-1,end:2},{start:3,end:1000},{start:7,end:6},
  {start:1.1,end:2},{start:NaN,end:3}]) {
  assert.throws(() => fmt.applyRunStyle([{text:"Hello"}],span,{font:"serif"}));
}
// Unicode preservation, even where offsets use UTF-16 code units as DOM Range does.
const unicode="Résumé 🎓 – वित्तीय बाज़ार – বাংলা – 📈";
for (const selection of [{start:0,end:unicode.length},{start:7,end:10},
  {start:11,end:20},{start:unicode.length,end:unicode.length}])
  assert.equal(getText(fmt.applyRunStyle([{text:unicode}],selection,{sizePx:22})),unicode);

// Seeded property tests: repeated arbitrary selections may change formatting but NEVER text.
let seed=0x5143ff05;
function rand(n) { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed % n; }
for(let scenario=0;scenario<65;scenario++){
  const base="Financial markets: inflation, rates, mutual funds, dividends and FX."+
    " हिंदी বাংলা عربى — equities 📈 and fixed income 🎓.";
  let items=[{text:base}];
  for(let j=0;j<25;j++){
    const x=rand(base.length+1),y=rand(base.length+1);
    const start=Math.min(x,y),end=Math.max(x,y);
    const style=j%4===0?{font:"cambria"}:j%4===1?{sizePx:12+rand(60)}:
      j%4===2?{bold:!!rand(2)}:{color:"#007788"};
    items=fmt.applyRunStyle(items,{start,end},style);
    assert.equal(getText(items),base,`Text altered after random edit ${scenario}/${j}`);
    assert.ok(items.length <=300);
  }
}
const editor=readFileSync("components/blog/blog-rich-editor.tsx","utf8");
const dashboard=readFileSync("components/blog/blog-editor-dashboard.tsx","utf8");
assert.ok(editor.includes("applyRunStyle(original, selection, style)"));
assert.ok(editor.includes("toggleRunStyle(original, selection, toggle)"));
assert.ok(!editor.includes("document.execCommand("),"No browser HTML formatting mutations");
assert.ok(!editor.includes("selected.extractContents("),"No DOM content extraction for formatting");
assert.ok(editor.includes("onInput={() => {") && editor.includes("onDirty?.();"));
assert.ok(editor.includes('event.clipboardData.getData("text/plain")'));
assert.ok(dashboard.includes("onDirty={() => { setDirty(true)"));
console.log("PASS: precise multi-style selections, Unicode safety, immutable text preservation, 1,625 seeded editing steps and save/paste regression guards");
