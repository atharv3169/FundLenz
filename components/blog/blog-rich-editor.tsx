"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  type RichBlock, type RichTextBlock, type RichMediaBlock, type RichRun,
  type RichDocument, safeHttpUrl, BLOG_FONTS, blogFontFamily, mediaWidth,
} from "@/lib/blog-rich-document";
import styles from "./blog-rich-editor.module.css";

function isText(block: RichBlock): block is RichTextBlock { return "runs" in block; }
function blockId(): string { return "b-" + crypto.randomUUID(); }
function rgbToHex(raw: string): string | undefined {
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? "#" + [match[1], match[2], match[3]].map(n =>
    Number(n).toString(16).padStart(2, "0")).join("") : undefined;
}

function safeInlineRuns(root: HTMLElement): RichRun[] {
  const runs: RichRun[] = [];
  function push(text: string, props: Omit<RichRun, "text">) {
    if (!text) return;
    const last = runs[runs.length - 1];
    const values = { ...props, text };
    if (last && Object.entries(props).every(([key, value]) =>
      (last as unknown as Record<string, unknown>)[key] === value) &&
        Object.keys(last).filter(k => k !== "text").length === Object.keys(props).length) {
      last.text += text;
    } else runs.push(values);
  }
  function read(node: Node, marks: Omit<RichRun, "text">, depth = 0) {
    if (depth > 24 || runs.length > 280) return;
    if (node.nodeType === Node.TEXT_NODE) {
      push((node.textContent || "").slice(0, 12000), marks); return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "iframe" || tag === "img") return;
    if (tag === "br") { push("\n", marks); return; }
    const next: Omit<RichRun, "text"> = { ...marks };
    if (tag === "strong" || tag === "b" || node.style.fontWeight === "bold" ||
      parseInt(node.style.fontWeight || "0", 10) >= 600) next.bold = true;
    if (tag === "em" || tag === "i" || node.style.fontStyle === "italic") next.italic = true;
    if (tag === "u" || node.style.textDecoration.includes("underline")) next.underline = true;
    if (tag === "a" && safeHttpUrl(node.getAttribute("href"))) next.href = node.getAttribute("href")!;
    const color = rgbToHex(node.style.color || (tag === "font" ? node.getAttribute("color") || "" : ""));
    if (color) next.color = color;
    const family = (node.style.fontFamily ||
      (tag === "font" ? node.getAttribute("face") || "" : "")).replace(/['"]/g, "").toLowerCase();
    if (family) {
      const matching = BLOG_FONTS.find(font => {
        const name = font.family.split(",")[0].replace(/['"]/g, "").toLowerCase();
        return family.split(",")[0].trim() === name;
      });
      if (matching) next.font = matching.id;
    }
    const size = node.style.fontSize || (tag === "font" ? node.getAttribute("size") || "" : "");
    const px = /^([0-9]+)px$/.exec(size);
    if (px && Number(px[1]) >= 12 && Number(px[1]) <= 72) next.sizePx = Number(px[1]);
    else if (size === "6" || size === "7") next.size = "xlarge";
    else if (size === "5") next.size = "large";
    else if (size === "1" || size === "2") next.size = "small";
    for (const child of Array.from(node.childNodes)) read(child, next, depth + 1);
    if ((tag === "div" || tag === "p") && node.nextSibling) push("\n", marks);
  }
  for (const node of Array.from(root.childNodes)) read(node, {}, 0);
  return runs.length ? runs.slice(0, 280) : [{ text: "" }];
}
function StyledRun({ run }: { run: RichRun }) {
  const text: ReactNode = <span style={{
    fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? "italic" : undefined,
    textDecoration: run.underline ? "underline" : undefined,
    color: run.color,
    fontFamily: blogFontFamily(run.font),
    fontSize: run.sizePx ? run.sizePx + "px" :
      run.size === "xlarge" ? "1.45em" : run.size === "large" ? "1.22em" :
      run.size === "small" ? "0.82em" : undefined,
    whiteSpace: "pre-wrap",
  }}>{run.text}</span>;
  return run.href ? <a href={run.href} target="_blank" rel="noopener noreferrer">{text}</a> : text;
}
export function BlogRichEditor({ value, onChange, disabled }: {
  value: RichDocument;
  onChange: (next: RichDocument) => void;
  disabled?: boolean;
}) {
  const [activeId, setActiveId] = useState(value.blocks[0]?.id || "");
  const [message, setMessage] = useState("");
  const [fontSizePx, setFontSizePx] = useState(18);
  const nodeMap = useRef(new Map<string, HTMLDivElement>());
  const range = useRef<Range | null>(null);
  const textSelection = useRef<{ blockId: string; start: number; end: number } | null>(null);
  const dragging = useRef<string | null>(null);

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const selected = selection.getRangeAt(0);
    const root = nodeMap.current.get(activeId);
    if (!root || !root.contains(selected.startContainer) || !root.contains(selected.endContainer)) return;
    range.current = selected.cloneRange();
    // Preserve offsets in case a preceding onBlur renders new React text nodes.
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(selected.startContainer, selected.startOffset);
    const start = before.toString().length;
    before.setEnd(selected.endContainer, selected.endOffset);
    textSelection.current = { blockId: activeId, start, end: before.toString().length };
  }

  function selectedRange(root: HTMLElement): Range | null {
    const saved = textSelection.current;
    if (saved && saved.blockId === activeId) {
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      function point(offset: number): [Node, number] {
        let remaining = offset;
        for (const node of textNodes) {
          const len = node.textContent?.length || 0;
          if (remaining <= len) return [node, remaining];
          remaining -= len;
        }
        const tail = textNodes[textNodes.length - 1];
        return tail ? [tail, tail.textContent?.length || 0] : [root, 0];
      }
      const total = textNodes.reduce((count, item) => count + (item.textContent?.length || 0), 0);
      if (saved.start <= saved.end && saved.end <= total) {
        const next = document.createRange();
        const [first, firstOffset] = point(saved.start);
        const [last, lastOffset] = point(saved.end);
        next.setStart(first, firstOffset);
        next.setEnd(last, lastOffset);
        return next;
      }
    }
    if (range.current && root.contains(range.current.startContainer) &&
        root.contains(range.current.endContainer)) return range.current.cloneRange();
    return null;
  }
  function patch(blocks: RichBlock[]) { onChange({ ...value, blocks }); setMessage(""); }
  function replaceBlock(id: string, update: (block: RichBlock) => RichBlock) {
    patch(value.blocks.map(block => block.id === id ? update(block) : block));
  }
  function flushText(id: string) {
    const root = nodeMap.current.get(id);
    if (!root) return;
    const updated = safeInlineRuns(root);
    const current = value.blocks.find(block => block.id === id);
    if (current && isText(current) && JSON.stringify(current.runs) !== JSON.stringify(updated))
      replaceBlock(id, block => isText(block) ? { ...block, runs: updated } : block);
  }
  function selectionRestore() {
    const selection = window.getSelection();
    const root = nodeMap.current.get(activeId);
    if (!selection || !root) return;
    const selected = selectedRange(root);
    if (!selected) return;
    try { selection.removeAllRanges(); selection.addRange(selected); } catch { /* stale selection */ }
  }
  function command(name: string, value?: string) {
    const node = nodeMap.current.get(activeId);
    if (!node || disabled) { setMessage("Click inside a text paragraph first."); return; }
    node.focus(); selectionRestore();
    if (!document.execCommand(name, false, value)) {
      setMessage("This browser does not support that formatting command.");
    }
    saveSelection();
  }
  // Font and size use a real styled span, not HTML <font size="3">.
  // A collapsed selection formats the current text block; selecting characters
  // formats only those characters. Both serialize to validated, numeric pixels.
  function applyInlineStyle(key: "fontFamily" | "fontSize", css: string) {
    const root = nodeMap.current.get(activeId);
    if (!root || disabled) { setMessage("Click inside an article text block first."); return; }
    let selected: Range | null = selectedRange(root);
    if (!selected || selected.collapsed) {
      selected = document.createRange();
      selected.selectNodeContents(root);
    }
    try {
      const wrapper = document.createElement("span");
      wrapper.style[key] = css;
      wrapper.appendChild(selected.extractContents());
      selected.insertNode(wrapper);
      // Flush immediately: toolbar controls may retain focus, so blur alone
      // is not sufficient to persist formatting when Save is clicked next.
      flushText(activeId);
      range.current = null;
      textSelection.current = null;
    } catch { setMessage("Select text within one paragraph and try again."); }
  }

  function insert(block: RichBlock) {
    const index = value.blocks.findIndex(item => item.id === activeId);
    const out = [...value.blocks];
    out.splice(index < 0 ? out.length : index + 1, 0, block);
    patch(out); setActiveId(block.id);
  }
  function insertText(type: RichTextBlock["type"]) {
    insert({ id: blockId(), type, runs: [{ text: "" }] });
  }
  function insertMedia(type: RichMediaBlock["type"], preset?: string) {
    const response = preset || window.prompt(type === "image" ? "HTTPS image URL" :
      "HTTPS video URL (YouTube, Vimeo or MP4)") || "";
    if (!response) return;
    if (!safeHttpUrl(response)) {
      setMessage("Use a valid HTTPS URL without a password or embedded credentials.");
      return;
    }
    const caption = window.prompt("Caption (optional, up to 350 characters)", "") || "";
    const alt = type === "image" ? window.prompt("Image alternative text", "") || "" : "";
    let thumbnail = "";
    if (type === "video-thumbnail") {
      thumbnail = window.prompt("HTTPS thumbnail image URL (optional)", "") || "";
      if (thumbnail && !safeHttpUrl(thumbnail)) {
        setMessage("Invalid thumbnail URL."); return;
      }
    }
    insert({ id: blockId(), type, src: response, widthPct: mediaWidth(undefined, type),
      align: "center", caption: caption.slice(0, 350),
      ...(alt ? { alt: alt.slice(0, 350) } : {}),
      ...(thumbnail ? { thumbnail } : {}) });
  }
  function moveBlock(source: string, target: string) {
    if (!source || source === target) return;
    const old = value.blocks.findIndex(item => item.id === source);
    const to = value.blocks.findIndex(item => item.id === target);
    if (old < 0 || to < 0) return;
    const blocks = [...value.blocks];
    const [moving] = blocks.splice(old, 1);
    blocks.splice(to, 0, moving);
    patch(blocks); setActiveId(source);
  }
  function drop(event: DragEvent<HTMLElement>, target: string) {
    event.preventDefault();
    if (dragging.current) {
      moveBlock(dragging.current, target);
      dragging.current = null; return;
    }
    if (event.dataTransfer.files.length) {
      setMessage("Local file uploads require a separate media-storage setup. For now, insert media by HTTPS URL."); return;
    }
    const url = event.dataTransfer.getData("text/uri-list").trim() ||
      event.dataTransfer.getData("text/plain").trim();
    if (safeHttpUrl(url) && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url)) {
      setActiveId(target);
      insertMedia("image", url);
    }
  }
  const toolbar = (label: string, cmd: string, title: string) =>
    <button title={title} aria-label={title} type="button" className={styles.tool}
      onMouseDown={event => event.preventDefault()}
      onClick={() => command(cmd)} disabled={disabled}>{label}</button>;
  return <div className={styles.root}>
    <div className={styles.toolbar} aria-label="Article formatting toolbar">
      <div className={styles.toolSection}>
        <span className={styles.toolLabel}>Text formatting</span>
        <div className={styles.toolLine}>
          {toolbar("B", "bold", "Bold selected text")}
          {toolbar("𝑰", "italic", "Italic selected text")}
          {toolbar("U̲", "underline", "Underline selected text")}
          <button className={styles.tool} type="button" disabled={disabled}
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              const link = window.prompt("HTTPS link URL for selected text");
              if (link && safeHttpUrl(link)) command("createLink", link);
              else if (link) setMessage("Links must be valid HTTPS URLs.");
            }}>🔗 Link</button>
          <label className={styles.toolSelect}>Font family
            <select aria-label="Font family" defaultValue="" disabled={disabled}
              onChange={event => {
                const option = BLOG_FONTS.find(font => font.id === event.target.value);
                if (option) applyInlineStyle("fontFamily", option.family);
                event.target.value = "";
              }}>
              <option value="">Choose a font</option>
              {BLOG_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}
            </select>
          </label>
          <label className={styles.toolSelect}>Text size (px)
            <div className={styles.sizeControl}>
              <input type="number" aria-label="Text size in pixels" min={12} max={72} step={1}
                value={fontSizePx} disabled={disabled}
                onChange={event => setFontSizePx(Number(event.target.value))} />
              <button className={styles.tool} type="button"
                onMouseDown={event => event.preventDefault()}
                disabled={disabled || !Number.isInteger(fontSizePx) || fontSizePx < 12 || fontSizePx > 72}
                onClick={() => applyInlineStyle("fontSize", fontSizePx + "px")}>Apply</button>
            </div>
          </label>
          <label className={styles.toolSelect}>Text color
            <input aria-label="Selected text color" type="color" disabled={disabled}
              defaultValue="#223a4a" onChange={event => command("foreColor", event.target.value)} />
          </label>
        </div>
      </div>
      <div className={styles.toolSection}>
        <span className={styles.toolLabel}>Insert content blocks</span>
        <div className={styles.toolLine}>
          {(["paragraph","heading","subheading","quote"] as const).map(type =>
            <button key={type} className={styles.tool} disabled={disabled}
              type="button" onClick={() => insertText(type)}>+ {type}</button>)}
          <span className={styles.toolDivider} aria-hidden="true"/>
          <button className={styles.tool} type="button" disabled={disabled}
            onClick={() => insertMedia("image")}>+ Image URL</button>
          <button className={styles.tool} type="button" disabled={disabled}
            onClick={() => insertMedia("video")}>+ YouTube / video</button>
          <button className={styles.tool} type="button" disabled={disabled}
            onClick={() => insertMedia("video-thumbnail")}>+ Clickable thumbnail</button>
        </div>
      </div>
    </div>
    <p className={styles.help}>Select words inside a paragraph to style only that text, or click within it to style the entire block. Enter a numeric size (12–72 px), then choose Apply. Media sizes and alignment are adjustable below each media URL. Drag the handle or use arrows to reorder blocks.</p>
    {message && <p className={styles.warning} role="status">{message}</p>}
    <div className={styles.blocks}>
      {value.blocks.map((block, index) => <section key={block.id}
        className={styles.block + (activeId === block.id ? " " + styles.selected : "")}
        onDragOver={event => event.preventDefault()} onDrop={event => drop(event, block.id)}>
        <div className={styles.blockControls}>
          <button type="button" className={styles.handle} title="Drag to reposition block" aria-label="Drag to reposition block"
            draggable={!disabled} onDragStart={event => {
              dragging.current = block.id; event.dataTransfer.setData("text/plain", block.id);
              event.dataTransfer.effectAllowed = "move";
            }} onDragEnd={() => { dragging.current = null; }}>⠿</button>
          <span>{index + 1} · {block.type.replace("-", " ")}</span>
          <button type="button" className={styles.mini} disabled={disabled || index === 0}
            onClick={() => moveBlock(block.id, value.blocks[index - 1].id)}>↑</button>
          <button type="button" className={styles.mini} disabled={disabled || index === value.blocks.length - 1}
            onClick={() => moveBlock(block.id, value.blocks[index + 1].id)}>↓</button>
          <button type="button" className={styles.remove} disabled={disabled}
            onClick={() => patch(value.blocks.filter(item => item.id !== block.id))}>Remove</button>
        </div>
        {isText(block)
          ? <div className={styles.editable + " " + styles[block.type]}
            contentEditable={!disabled} suppressContentEditableWarning
            ref={el => { if (el) nodeMap.current.set(block.id, el); else nodeMap.current.delete(block.id); }}
            onFocus={() => setActiveId(block.id)}
            onBlur={() => flushText(block.id)}
            onMouseUp={saveSelection} onKeyUp={saveSelection}
            role="textbox" aria-multiline="true" aria-label={block.type + " article text"}
            data-placeholder={"Write " + block.type + " here…"}>
            {block.runs.map((run, i) => <StyledRun key={i} run={run} />)}
          </div>
          : <div className={styles.mediaEditor}>
            <label>Media URL<input type="url" required value={block.src} disabled={disabled}
              onChange={event => replaceBlock(block.id, cur => ({ ...cur, src: event.target.value }))}/></label>
            {block.type === "image" || block.type === "video-thumbnail"
              ? <label>{block.type === "image" ? "Alt text" : "Thumbnail alt text"}
                <input value={block.alt || ""} maxLength={350} disabled={disabled}
                  onChange={event => replaceBlock(block.id, cur => ({ ...cur, alt: event.target.value }))}/></label> : null}
            {block.type === "video-thumbnail"
              ? <label>Thumbnail HTTPS URL<input type="url" value={block.thumbnail || ""} disabled={disabled}
                onChange={event => replaceBlock(block.id, cur => ({ ...cur, thumbnail: event.target.value }))}/></label> : null}
            <label>Caption<input value={block.caption || ""} maxLength={350} disabled={disabled}
              onChange={event => replaceBlock(block.id, cur => ({ ...cur, caption: event.target.value }))}/></label>
            <div className={styles.mediaSizeEditor}>
              <div className={styles.mediaSizeHead}>
                <strong>Display size &amp; position</strong>
                <span>{mediaWidth(block.widthPct, block.type)}% of article column</span>
              </div>
              <div className={styles.mediaSizeRow}>
                <input type="range" min={20} max={100} step={5}
                  aria-label={"Width for " + block.type} value={mediaWidth(block.widthPct, block.type)}
                  disabled={disabled}
                  onChange={event => replaceBlock(block.id, cur =>
                    ({ ...cur, widthPct: Number(event.target.value) }))}/>
                <label>Width %
                  <input type="number" min={20} max={100} step={1} disabled={disabled}
                    aria-label="Media width percentage" value={mediaWidth(block.widthPct, block.type)}
                    onChange={event => {
                      const next = Number(event.target.value);
                      if (Number.isInteger(next) && next >= 20 && next <= 100)
                        replaceBlock(block.id, cur => ({ ...cur, widthPct: next }));
                    }}/>
                </label>
                <label>Position
                  <select aria-label="Media alignment" value={block.align || "center"} disabled={disabled}
                    onChange={event => replaceBlock(block.id, cur => ({
                      ...cur, align: event.target.value as RichMediaBlock["align"],
                    }))}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
              <div className={styles.mediaPresets}>
                {[35, 55, 75, 100].map(pct => <button type="button" key={pct}
                  className={styles.tool} disabled={disabled}
                  onClick={() => replaceBlock(block.id, cur => ({ ...cur, widthPct: pct }))}>
                  {pct === 35 ? "Small" : pct === 55 ? "Medium" : pct === 75 ? "Large" : "Full"} ({pct}%)
                </button>)}
              </div>
              <div className={styles.mediaGauge} aria-label="Media width preview">
                <div className={styles.mediaGaugeInner}
                  style={{
                    width: mediaWidth(block.widthPct, block.type) + "%",
                    marginLeft: block.align === "right" ? "auto" :
                      block.align === "left" ? "0" : "auto",
                    marginRight: block.align === "left" ? "auto" :
                      block.align === "right" ? "0" : "auto",
                  }}>{block.type === "image" ? "▣ Image" :
                    block.type === "video" ? "▶ Video" : "▶ Linked thumbnail"}</div>
              </div>
            </div>
          </div>}
      </section>)}
    </div>
    {!value.blocks.length && <button type="button" className={styles.tool} onClick={() => insertText("paragraph")}>
      + Add your first paragraph
    </button>}
  </div>;
}
