/** Staging-only article drafts. Published content is a separate reviewed workflow. */
import { RICH_PREFIX, decodeRichDocument, isCategory, validateRichDocument } from "@/lib/blog-rich-document";

export const blogDraftCategories = ["Research", "Markets", "Funds", "Learning"] as const;
export type BlogDraftCategory = string;
export type BlogArticleDraft = {
  id: string;
  title: string;
  summary: string;
  body_markdown: string; // legacy Markdown or FLRICH1: versioned structured rich document
  category: string;
  status: "draft";
  version: number;
  created_at: number;
  updated_at: number;
};
export type BlogDraftSummary = Pick<BlogArticleDraft, "id"|"title"|"summary"|"category"|"version"|"updated_at">;
const badChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export function validateArticleDraft(value: unknown): Pick<BlogArticleDraft, "title"|"summary"|"body_markdown"|"category"> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid article draft.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["title","summary","body_markdown","category"].includes(key)))
    throw new Error("Unexpected article draft field.");
  const { title, summary } = data;
  const body = data.body_markdown;
  const category = data.category;
  if (typeof title !== "string" || title.trim().length < 1 || title.length > 160 || badChars.test(title))
    throw new Error("Enter a title under 160 characters.");
  if (typeof summary !== "string" || summary.length > 600 || badChars.test(summary))
    throw new Error("Summary must be under 600 characters.");
  if (typeof body !== "string" || body.length > 50000 || badChars.test(body))
    throw new Error("Article body must be under 50,000 characters.");
  if (!isCategory(category))
    throw new Error("Choose any category name up to 80 characters.");
  if (body.startsWith(RICH_PREFIX)) {
    const doc = decodeRichDocument(body, category);
    if (doc.category !== category.trim())
      throw new Error("Rich article category does not match draft category.");
    validateRichDocument(doc);
  } else if (!blogDraftCategories.some(item => item === category)) {
    // The legacy D1 category column only accepts one of four historic labels.
    // Custom labels are embedded in the rich document, so require it for new labels.
    throw new Error("New category names require the rich article editor.");
  }
  return { title: title.trim(), summary: summary.trim(), body_markdown: body,
    category: category.trim() };
}

/** The old D1 column retains its CHECK constraint. Rich drafts store the true
 * arbitrary category label inside their strict document envelope without needing
 * a table rebuild or risking the owner's existing drafts.
 */
export function legacyDbCategory(category: string): string {
  return blogDraftCategories.some(item => item === category) ? category : "Research";
}
