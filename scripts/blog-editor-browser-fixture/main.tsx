import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BlogRichEditor } from "../../components/blog/blog-rich-editor";
import { BlogPaper } from "../../components/blog/blog-paper";
import { BlogEditorDashboard } from "../../components/blog/blog-editor-dashboard";
import { defaultBlogHomepageContent } from "../../lib/blog-homepage-content";
import { encodeRichDocument } from "../../lib/blog-rich-document";
import type { RichDocument } from "../../lib/blog-rich-document";

const initial: RichDocument = {
  format: "fundlenz-rich-1",
  category: "Research",
  blocks: [
    { id: "browser-test", type: "paragraph", runs: [{
      text: "Alpha beta gamma delta", bold: false,
    }] },
    { id: "second-test", type: "paragraph", runs: [{ text: "Second paragraph remains separate" }] },
    { id: "long-test", type: "paragraph", runs: [{ text: Array.from({length:56}, (_, i) => "d".repeat(100) + (i % 7 === 0 ? "wefvhf" : "")).join(" ") }] },
  ],
};
function Fixture() {
  const [value, setValue] = useState<RichDocument>(initial);
  const [dirty, setDirty] = useState(false);
  const [valid, setValid] = useState(true);
  return <>
    <button id="reset-fixture" onClick={() => setValue(initial)}>Reset fixture</button>
    <div id="status" data-dirty={String(dirty)} data-valid={String(valid)}></div>
    <BlogRichEditor value={value} onChange={setValue}
      onDirty={() => setDirty(true)}
      onValidityChange={setValid}/>
    <pre id="serialized">{JSON.stringify(value)}</pre>
  </>;
}
const mode = new URLSearchParams(location.search).get("mode");
const specimen: RichDocument = {
  format: "fundlenz-rich-1", category: "Market structure",
  blocks: [
    { id:"question", type:"heading", runs:[{text:"Start with the right question"}] },
    { id:"lead", type:"paragraph", runs:[{text:"A portfolio is more than a list of investments. Understanding what each holding contributes means looking at its risks, its role and the evidence behind it. This is a design specimen for the private editorial workspace, not a published research finding."}] },
    { id:"quote", type:"quote", runs:[{text:"Good analysis begins with a clear question and ends with an honest account of what the evidence can support."}] },
    { id:"limits", type:"heading", runs:[{text:"Make uncertainty visible"}] },
    { id:"end", type:"paragraph", runs:[{text:"Context matters. State the period covered, explain the assumptions and distinguish an observed association from a causal claim. Clear writing should make these limits easier for the reader to understand."}] },
  ],
};
// Isolated browser-only fake transport. No real credentials, D1 or Drive writes.
if (mode === "dashboard") {
  let version = 1;
  let draft = {id:"fixture-draft", title:"Understanding a portfolio, beyond the headline numbers", summary:"An editorial design specimen.", category:"Research", body_markdown:encodeRichDocument(specimen), status:"draft", version, updated_at:1791453600, created_at:1791453600};
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("homepage-draft")) return Response.json({content:defaultBlogHomepageContent, version:1});
    if (url.includes("article-drafts")) {
      if (init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        if (sent.title === "Simulate conflict") return Response.json({error:"Draft has changed. Reload to continue."}, {status:409});
        draft = {...draft,...sent,version:++version};
        return Response.json({version,updated_at:1791453600});
      }
      return Response.json(url.includes("?id=") ? {draft} : {drafts:[draft]});
    }
    throw new Error("Unexpected fixture request: " + url);
  };
}
document.head.insertAdjacentHTML("beforeend", `<style>*{box-sizing:border-box}body{margin:0;background:#f4f8fa;font-family:Arial,sans-serif;color:#244658;padding:24px}h1,h2,h3,p{margin-top:0}button,input,textarea,select{font:inherit}#serialized{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:600px){body{padding:12px}}</style>`);
createRoot(document.getElementById("root")!).render(mode === "dashboard" ? <BlogEditorDashboard/> :
  mode === "paper" ? <BlogPaper title="Understanding a portfolio, beyond the headline numbers"
    summary="A closer look at evidence, uncertainty and the questions that make financial research useful."
    category={specimen.category} blocks={specimen.blocks} author="Atharva Sahu" updatedAt={1791453600}/> : <Fixture/>);
