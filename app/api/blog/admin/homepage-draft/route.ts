import { defaultBlogHomepageContent, validateBlogHomepageContent } from "@/lib/blog-homepage-content";
import { privateAdminResponse } from "@/lib/blog-admin-crypto";
import { BlogEditorError, assertDraftVersion, readEditorJson, requireBlogEditor, safeEditorError } from "@/lib/blog-editor-auth";

type HomepageRow = { content_json: string; version: number; updated_at: number };

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request);
    const row = await db.prepare("SELECT content_json, version, updated_at FROM blog_homepage_draft WHERE id=1")
      .first<HomepageRow>();
    const initial = row ? validateBlogHomepageContent(JSON.parse(row.content_json)) : defaultBlogHomepageContent;
    return privateAdminResponse({ content: initial, version: row?.version || 0, updated_at: row?.updated_at || null });
  } catch (error) { return safeEditorError(error); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true);
    const input = await readEditorJson(request, 12000);
    if (Object.keys(input).some(key => !["content", "version"].includes(key)))
      throw new BlogEditorError(400, "Unexpected draft field.");
    const version = assertDraftVersion(input.version);
    let content;
    try { content = validateBlogHomepageContent(input.content); }
    catch { throw new BlogEditorError(400, "Invalid homepage wording. Preserve the educational disclaimer."); }
    const now = Math.floor(Date.now() / 1000);
    const json = JSON.stringify(content);
    if (version === 0) {
      const result = await db.prepare(
        "INSERT INTO blog_homepage_draft (id, content_json, version, updated_at) " +
        "VALUES (1, ?, 1, ?) ON CONFLICT(id) DO NOTHING"
      ).bind(json, now).run();
      if (result.meta.changes !== 1)
        throw new BlogEditorError(409, "Another edit was saved first. Reload the latest draft.");
    } else {
      const result = await db.prepare(
        "UPDATE blog_homepage_draft SET content_json=?, version=version+1, updated_at=? WHERE id=1 AND version=?"
      ).bind(json, now, version).run();
      if (result.meta.changes !== 1)
        throw new BlogEditorError(409, "This draft changed elsewhere. Reload before editing.");
    }
    return privateAdminResponse({ saved: true, version: version + 1, updated_at: now, published: false });
  } catch (error) { return safeEditorError(error); }
}
