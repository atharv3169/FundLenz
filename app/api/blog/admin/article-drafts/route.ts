import { privateAdminResponse } from "@/lib/blog-admin-crypto";
import { validateArticleDraft, type BlogArticleDraft, type BlogDraftSummary } from "@/lib/blog-article-draft";
import { BlogEditorError, assertDraftVersion, isDraftId, readEditorJson, requireBlogEditor, safeEditorError } from "@/lib/blog-editor-auth";

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request);
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null) {
      if (!isDraftId(id)) throw new BlogEditorError(400, "Invalid draft ID.");
      const draft = await db.prepare("SELECT * FROM blog_article_drafts WHERE id=?")
        .bind(id).first<BlogArticleDraft>();
      if (!draft) throw new BlogEditorError(404, "Draft not found.");
      return privateAdminResponse({ draft });
    }
    const result = await db.prepare(
      "SELECT id,title,summary,category,version,updated_at FROM blog_article_drafts ORDER BY updated_at DESC LIMIT 100"
    ).all<BlogDraftSummary>();
    return privateAdminResponse({ drafts: result.results || [] });
  } catch (error) { return safeEditorError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true);
    const data = await readEditorJson(request, 500);
    if (Object.keys(data).length !== 0) throw new BlogEditorError(400, "Unexpected create request.");
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      "INSERT INTO blog_article_drafts (id,title,summary,body_markdown,category,status,version,created_at,updated_at) " +
      "VALUES (?,'Untitled draft','','','Research','draft',1,?,?)"
    ).bind(id, now, now).run();
    return privateAdminResponse({ draft: { id, title: "Untitled draft", summary: "", body_markdown: "",
      category: "Research", status: "draft", version: 1, created_at: now, updated_at: now } }, 201);
  } catch (error) { return safeEditorError(error); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true);
    const data = await readEditorJson(request);
    if (!isDraftId(data.id)) throw new BlogEditorError(400, "Invalid draft ID.");
    const version = assertDraftVersion(data.version);
    if (version === 0) throw new BlogEditorError(400, "Invalid article revision.");
    let validated;
    try { validated = validateArticleDraft({
      title: data.title, summary: data.summary, body_markdown: data.body_markdown, category: data.category,
    }); } catch { throw new BlogEditorError(400, "Invalid article draft fields."); }
    if (Object.keys(data).some(key => !["id","version","title","summary","body_markdown","category"].includes(key)))
      throw new BlogEditorError(400, "Publishing fields are not accepted by this draft-only API.");
    const now = Math.floor(Date.now() / 1000);
    const changed = await db.prepare(
      "UPDATE blog_article_drafts SET title=?,summary=?,body_markdown=?,category=?,version=version+1,updated_at=? " +
      "WHERE id=? AND version=? AND status='draft'"
    ).bind(validated.title, validated.summary, validated.body_markdown, validated.category, now, data.id, version).run();
    if (changed.meta.changes !== 1)
      throw new BlogEditorError(409, "Draft has changed or was removed. Reload to continue.");
    return privateAdminResponse({ saved: true, id: data.id, version: version + 1, updated_at: now, published: false });
  } catch (error) { return safeEditorError(error); }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true);
    const data = await readEditorJson(request, 256);
    if (!isDraftId(data.id)) throw new BlogEditorError(400, "Invalid draft ID.");
    const version = assertDraftVersion(data.version);
    if (Object.keys(data).some(key => !["id","version"].includes(key)))
      throw new BlogEditorError(400, "Invalid delete request.");
    const deleted = await db.prepare(
      "DELETE FROM blog_article_drafts WHERE id=? AND version=? AND status='draft'"
    ).bind(data.id, version).run();
    if (deleted.meta.changes !== 1)
      throw new BlogEditorError(409, "Draft has changed or was already removed.");
    return privateAdminResponse({ deleted: true });
  } catch (error) { return safeEditorError(error); }
}
