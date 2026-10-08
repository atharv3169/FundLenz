"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  type RichBlock, type RichTextBlock, type RichMediaBlock, type RichRun,
  type RichDocument, safeHttpUrl,
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
    const family = (node.style.fontFamily || (tag === "font" ? node.getAttribute("face") || "" : "")).toLowerCase();
    if (family.includes("georgia") || family.includes("times")) next.font = "serif";
    else if (family.includes("mono") || family.includes("courier")) next.font = "mono";
    else if (family.includes("arial") || family.includes("helvetica")) next.font = "sans";
    const size = node.style.fontSize || (tag === "font" ? node.getAttribute("size") || "" : "");
    if (size === "5" || size === "6" || size === "7" || /^(22|23|24|25|26|27|28|29|30)px$/.test(size)) next.size = "large";
    else if (size === "1" || size === "2" || /^(10|11|12|13)px$/.test(size)) next.size = "small";
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
    fontFamily: run.font === "serif" ? "Georgia,serif" :
      run.font === "mono" ? "monospace" : run.font === "sans" ? "Arial,sans-serif" : undefined,
    fontSize: run.size === "large" ? "1.22em" : run.size === "small" ? "0.82em" : undefined,
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
  const nodeMap = useRef(new Map<string, HTMLDivElement>());
  const range = useRef<Range | null>(null);
  const dragging = useRef<string | null>(null);

  function saveSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount) range.current = selection.getRangeAt(0).cloneRange();
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
    if (!selection || !range.current) return;
    try { selection.removeAllRanges(); selection.addRange(range.current); } catch { /* stale selection */ }
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
    insert({ id: blockId(), type, src: response, caption: caption.slice(0, 350),
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
      <span className={styles.toolLabel}>FORMAT</span>
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
      <label className={styles.toolSelect}>Font
        <select defaultValue="" disabled={disabled} onChange={event => {
          const fonts: Record<string,string> = { serif: "Georgia", sans: "Arial", mono: "Courier New" };
          if (fonts[event.target.value]) command("fontName", fonts[event.target.value]);
        }}>
          <option value="">Choose</option>
          <option value="serif">Serif</option><option value="sans">Sans</option><option value="mono">Mono</option>
        </select>
      </label>
      <label className={styles.toolSelect}>Size
        <select defaultValue="" disabled={disabled} onChange={event => {
          if (event.target.value) command("fontSize", event.target.value);
        }}>
          <option value="">Choose</option><option value="2">Small</option><option value="3">Normal</option>
          <option value="5">Large</option>
        </select>
      </label>
      <label className={styles.toolSelect}>Color
        <input aria-label="Selected text color" type="color" disabled={disabled}
          defaultValue="#223a4a" onChange={event => command("foreColor", event.target.value)} />
      </label>
      <span className={styles.toolLabel}>INSERT AFTER SELECTION</span>
      {(["paragraph","heading","subheading","quote"] as const).map(type =>
        <button key={type} className={styles.tool} disabled={disabled}
          type="button" onClick={() => insertText(type)}>+ {type}</button>)}
      <button className={styles.tool} type="button" disabled={disabled} onClick={() => insertMedia("image")}>+ Image URL</button>
      <button className={styles.tool} type="button" disabled={disabled} onClick={() => insertMedia("video")}>+ Video</button>
      <button className={styles.tool} type="button" disabled={disabled} onClick={() => insertMedia("video-thumbnail")}>+ Video thumbnail</button>
    </div>
    <p className={styles.help}>Select text to style it. Click a paragraph to choose where new blocks go.
      Drag blocks by the six-dot handle to reorder them. All media currently use HTTPS URLs.</p>
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
          </div>}
      </section>)}
    </div>
    {!value.blocks.length && <button type="button" className={styles.tool} onClick={() => insertText("paragraph")}>
      + Add your first paragraph
    </button>}
  </div>;
}
