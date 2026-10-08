import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BlogRichEditor } from "../../components/blog/blog-rich-editor";
import type { RichDocument } from "../../lib/blog-rich-document";

const initial: RichDocument = {
  format: "fundlenz-rich-1",
  category: "Research",
  blocks: [{ id: "browser-test", type: "paragraph", runs: [{
    text: "Alpha beta gamma delta", bold: false,
  }] }],
};
function Fixture() {
  const [value, setValue] = useState<RichDocument>(initial);
  const [dirty, setDirty] = useState(false);
  const [valid, setValid] = useState(true);
  return <>
    <div id="status" data-dirty={String(dirty)} data-valid={String(valid)}></div>
    <BlogRichEditor value={value} onChange={setValue}
      onDirty={() => setDirty(true)}
      onValidityChange={setValid}/>
    <pre id="serialized">{JSON.stringify(value)}</pre>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
