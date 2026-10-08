/** FundLenz draft-only rich document, embedded in the existing D1 body field.
 * No untrusted HTML. All rendering uses React's escaped text nodes.
 */
export const RICH_PREFIX = "FLRICH1:";

export const BLOG_FONTS = [
  { id: "serif", label: "Georgia", family: "Georgia, serif" },
  { id: "times", label: "Times New Roman", family: "'Times New Roman', serif" },
  { id: "palatino", label: "Palatino", family: "'Palatino Linotype', Palatino, serif" },
  { id: "garamond", label: "Garamond", family: "Garamond, Georgia, serif" },
  { id: "baskerville", label: "Baskerville", family: "Baskerville, Georgia, serif" },
  { id: "cambria", label: "Cambria", family: "Cambria, Georgia, serif" },
  { id: "book-antiqua", label: "Book Antiqua", family: "'Book Antiqua', Palatino, serif" },
  { id: "sans", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { id: "helvetica", label: "Helvetica", family: "Helvetica, Arial, sans-serif" },
  { id: "verdana", label: "Verdana", family: "Verdana, sans-serif" },
  { id: "trebuchet", label: "Trebuchet MS", family: "'Trebuchet MS', sans-serif" },
  { id: "tahoma", label: "Tahoma", family: "Tahoma, sans-serif" },
  { id: "segoe", label: "Segoe UI", family: "'Segoe UI', Arial, sans-serif" },
  { id: "calibri", label: "Calibri", family: "Calibri, Arial, sans-serif" },
  { id: "candara", label: "Candara", family: "Candara, Arial, sans-serif" },
  { id: "century-gothic", label: "Century Gothic", family: "'Century Gothic', Arial, sans-serif" },
  { id: "franklin", label: "Franklin Gothic", family: "'Franklin Gothic Medium', Arial, sans-serif" },
  { id: "impact", label: "Impact", family: "Impact, sans-serif" },
  { id: "mono", label: "Courier New", family: "'Courier New', monospace" },
  { id: "consolas", label: "Consolas", family: "Consolas, 'Courier New', monospace" },
  { id: "lucida", label: "Lucida Console", family: "'Lucida Console', monospace" },
  { id: "comic", label: "Comic Sans MS", family: "'Comic Sans MS', cursive" },
] as const;
export type BlogFontId = (typeof BLOG_FONTS)[number]["id"];
export function blogFontFamily(font?: string): string | undefined {
  return BLOG_FONTS.find(option => option.id === font)?.family;
}
export const mediaWidth = (value: number | undefined, type: RichMediaBlock["type"]) =>
  value ?? (type === "video" ? 72 : type === "video-thumbnail" ? 65 : 85);
export type RichRun = {
  text: string; bold?: boolean; italic?: boolean; underline?: boolean;
  href?: string; color?: string; font?: BlogFontId; size?: "small" | "normal" | "large" | "xlarge"; sizePx?: number;
};
export type RichTextBlock = {
  id: string; type: "paragraph" | "heading" | "subheading" | "quote";
  runs: RichRun[];
};
export type RichMediaBlock = {
  id: string; type: "image" | "video" | "video-thumbnail";
  src: string; caption?: string; alt?: string; thumbnail?: string;
  widthPct?: number; align?: "left" | "center" | "right";
};
export type RichBlock = RichTextBlock | RichMediaBlock;
export type ArticleAuthor = {
  name?: string; socialLabel?: string; socialUrl?: string;
  avatarDataUrl?: string; displayDate?: string; readingMinutes?: number;
};
export type RichDocument = {
  format: "fundlenz-rich-1"; category: string; blocks: RichBlock[];
  author?: ArticleAuthor;
};
export function safeAvatarDataUrl(input: unknown): input is string {
  return typeof input === "string" && input.length <= 20000 &&
    /^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input) &&
    input.length > 30;
}
export function validateArticleAuthor(input: unknown): ArticleAuthor {
  if (!record(input) || !exactKeys(input, [
    "name", "socialLabel", "socialUrl", "avatarDataUrl", "displayDate", "readingMinutes",
  ])) throw new Error("Invalid author details.");
  const v = input as Record<string, unknown>;
  if (v.name !== undefined && (typeof v.name !== "string" || !v.name.trim() ||
    v.name.length > 120 || controls.test(v.name) || /[<>]/.test(v.name))) throw new Error("Invalid author name.");
  if (v.socialLabel !== undefined && (typeof v.socialLabel !== "string" ||
    v.socialLabel.length > 60 || controls.test(v.socialLabel) || /[<>]/.test(v.socialLabel)))
      throw new Error("Invalid social link label.");
  if (v.socialUrl !== undefined && v.socialUrl !== "" && !safeHttpUrl(v.socialUrl))
    throw new Error("Author social link must be HTTPS.");
  if (v.avatarDataUrl !== undefined && !safeAvatarDataUrl(v.avatarDataUrl))
    throw new Error("Avatar must be a small JPEG image.");
  if (v.displayDate !== undefined && (typeof v.displayDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.displayDate) || (Number.isNaN(Date.parse(v.displayDate)) || new Date(v.displayDate).toISOString().slice(0, 10) !== v.displayDate)))
    throw new Error("Invalid article display date.");
  if (v.readingMinutes !== undefined && (!Number.isInteger(v.readingMinutes) ||
    (v.readingMinutes as number) < 1 || (v.readingMinutes as number) > 90))
    throw new Error("Reading time must be 1–90 minutes.");
  return input as ArticleAuthor;
}
const basicId = /^[a-zA-Z0-9_-]{1,80}$/;
const safeColor = /^#[a-fA-F0-9]{6}$/;
const fonts: readonly string[] = BLOG_FONTS.map(option => option.id);
const sizes = ["small", "normal", "large", "xlarge"];
const kinds = ["paragraph", "heading", "subheading", "quote", "image", "video", "video-thumbnail"];
const controls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every(k => allowed.includes(k));
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function safeHttpUrl(input: unknown): input is string {
  if (typeof input !== "string" || input.length > 2048 || controls.test(input)) return false;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && Boolean(url.hostname) &&
      !url.username && !url.password && !/^\d+$/.test(url.hostname);
  } catch { return false; }
}
export function isCategory(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0 &&
    input.trim().length <= 80 && !controls.test(input) && !/[<>]/.test(input);
}
export function validateRichDocument(input: unknown): RichDocument {
  if (!record(input) || !exactKeys(input, ["format", "category", "blocks", "author"]) ||
      input.format !== "fundlenz-rich-1" || !isCategory(input.category) ||
      !Array.isArray(input.blocks) || input.blocks.length > 120) {
    throw new Error("Invalid rich article format.");
  }
  const seen = new Set<string>();
  const blocks: RichBlock[] = [];
  for (const value of input.blocks) {
    if (!record(value) || typeof value.id !== "string" || !basicId.test(value.id) ||
        seen.has(value.id) || !kinds.includes(String(value.type))) {
      throw new Error("Invalid or duplicate article block.");
    }
    seen.add(value.id);
    if (["paragraph", "heading", "subheading", "quote"].includes(String(value.type))) {
      if (!exactKeys(value, ["id", "type", "runs"]) ||
          !Array.isArray(value.runs) || value.runs.length > 300)
        throw new Error("Invalid text block.");
      const runs: RichRun[] = [];
      for (const run of value.runs) {
        if (!record(run) || !exactKeys(run, ["text", "bold", "italic", "underline", "href", "color", "font", "size", "sizePx"]) ||
            typeof run.text !== "string" || run.text.length > 12000 || controls.test(run.text) ||
            (run.bold !== undefined && typeof run.bold !== "boolean") ||
            (run.italic !== undefined && typeof run.italic !== "boolean") ||
            (run.underline !== undefined && typeof run.underline !== "boolean") ||
            (run.href !== undefined && !safeHttpUrl(run.href)) ||
            (run.color !== undefined && (typeof run.color !== "string" || !safeColor.test(run.color))) ||
            (run.font !== undefined && !fonts.includes(String(run.font))) ||
            (run.size !== undefined && !sizes.includes(String(run.size))) ||
            (run.sizePx !== undefined && (!Number.isInteger(run.sizePx) || (run.sizePx as number) < 12 || (run.sizePx as number) > 72)))
          throw new Error("Invalid inline styling or unsafe link.");
        runs.push(run as RichRun);
      }
      blocks.push({ id: value.id, type: value.type as RichTextBlock["type"], runs });
    } else {
      if (!exactKeys(value, ["id", "type", "src", "caption", "alt", "thumbnail", "widthPct", "align"]) ||
          !safeHttpUrl(value.src) ||
          (value.thumbnail !== undefined && !safeHttpUrl(value.thumbnail)) ||
          (value.widthPct !== undefined && (!Number.isInteger(value.widthPct) || (value.widthPct as number) < 20 || (value.widthPct as number) > 100)) ||
          (value.align !== undefined && !["left", "center", "right"].includes(String(value.align))) ||
          (value.alt !== undefined && (typeof value.alt !== "string" || value.alt.length > 350 || controls.test(value.alt))) ||
          (value.caption !== undefined && (typeof value.caption !== "string" ||
            value.caption.length > 350 || controls.test(value.caption))))
        throw new Error("Invalid media block or unsafe media URL.");
      blocks.push({ id: value.id, type: value.type as RichMediaBlock["type"], src: value.src,
        ...(value.alt === undefined ? {} : { alt: value.alt as string }),
        ...(value.caption === undefined ? {} : { caption: value.caption as string }),
        ...(value.thumbnail === undefined ? {} : { thumbnail: value.thumbnail as string }),
        ...(value.widthPct === undefined ? {} : { widthPct: value.widthPct as number }),
        ...(value.align === undefined ? {} : { align: value.align as RichMediaBlock["align"] }) });
    }
  }
  const author = input.author === undefined ? undefined : validateArticleAuthor(input.author);
  if (JSON.stringify({ format: "fundlenz-rich-1", category: input.category, blocks, author }).length > 48000)
    throw new Error("Article content exceeds private draft storage capacity.");
  return { format: "fundlenz-rich-1", category: input.category.trim(), blocks,
    ...(author === undefined ? {} : { author }) };
}
export function emptyRichDocument(category = "Research"): RichDocument {
  return { format: "fundlenz-rich-1", category, blocks: [
    { id: "intro", type: "paragraph", runs: [{ text: "" }] },
  ] };
}
export function legacyArticleDocument(body: string, category: string): RichDocument {
  const lines = body.split(/\n{2,}/);
  // Never silently truncate older Markdown when upgrading it to the rich editor.
  if (lines.length > 120) throw new Error("Legacy draft has more than 120 paragraphs. It needs a reviewed migration.");
  return validateRichDocument({
    format: "fundlenz-rich-1", category,
    blocks: lines.map((part, index) => ({ id: "legacy-" + index,
      type: part.startsWith("## ") ? "subheading" : part.startsWith("# ") ? "heading" : "paragraph",
      runs: [{ text: part.replace(/^#{1,2} /, "") }] })),
  });
}
export function decodeRichDocument(body: string, fallbackCategory = "Research"): RichDocument {
  if (!body.startsWith(RICH_PREFIX)) return legacyArticleDocument(body, fallbackCategory);
  try { return validateRichDocument(JSON.parse(body.slice(RICH_PREFIX.length))); }
  catch { throw new Error("Rich draft is damaged; do not overwrite it."); }
}
export function encodeRichDocument(document: RichDocument): string {
  const str = RICH_PREFIX + JSON.stringify(validateRichDocument(document));
  if (str.length > 50000) throw new Error("Draft exceeds storage limits.");
  return str;
}
export function storedDraftCategory(body: string, dbCategory: string): string {
  if (!body.startsWith(RICH_PREFIX)) return dbCategory;
  // One damaged legacy row must not take down the entire draft list. Its body
  // still fails strict decoding when opened, preventing an accidental overwrite.
  try { return decodeRichDocument(body, dbCategory).category; }
  catch { return dbCategory; }
}
/** Some blocks can point at video hosts; transform only well-defined YouTube/Vimeo URLs. */
export function safeEmbedUrl(raw: string): string | null {
  if (!safeHttpUrl(raw)) return null;
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com")
    id = url.pathname.startsWith("/shorts/") ? url.pathname.split("/")[2] :
      url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
  if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
    return "https://www.youtube-nocookie.com/embed/" + id;
  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    id = url.pathname.split("/").filter(Boolean).pop() || "";
    if (/^\d{6,12}$/.test(id)) return "https://player.vimeo.com/video/" + id;
  }
  return null;
}
