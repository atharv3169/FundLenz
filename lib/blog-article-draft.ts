/** Draft schema only. Publishing is deliberately not implemented here. */
export const blogDraftCategories = ["Research", "Markets", "Funds", "Learning"] as const;
export type BlogDraftCategory = (typeof blogDraftCategories)[number];
export type BlogArticleDraft = {
  id: string;
  title: string;
  summary: string;
  body_markdown: string;
  category: BlogDraftCategory;
  status: "draft";
  version: number;
  created_at: number;
  updated_at: number;
};
export type BlogDraftSummary = Pick<BlogArticleDraft, "id"|"title"|"summary"|"category"|"version"|"updated_at">;

const badChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
export function validateArticleDraft(value: unknown): Pick<BlogArticleDraft, "title"|"summary"|"body_markdown"|"category"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid article draft.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["title","summary","body_markdown","category"].includes(key)))
    throw new Error("Unexpected article draft field.");
  const title = data.title, summary = data.summary, body = data.body_markdown;
  if (typeof title !== "string" || title.trim().length < 1 || title.length > 160 || badChars.test(title))
    throw new Error("Enter a title under 160 characters.");
  if (typeof summary !== "string" || summary.length > 600 || badChars.test(summary))
    throw new Error("Summary must be under 600 characters.");
  if (typeof body !== "string" || body.length > 50000 || badChars.test(body))
    throw new Error("Article body must be under 50,000 characters.");
  if (typeof data.category !== "string" || !blogDraftCategories.some(k => k === data.category))
    throw new Error("Choose a valid article category.");
  return { title: title.trim(), summary: summary.trim(), body_markdown: body,
    category: data.category as BlogDraftCategory };
}
