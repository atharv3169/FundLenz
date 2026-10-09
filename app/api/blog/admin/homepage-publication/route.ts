import { env } from "cloudflare:workers";
import { privateAdminResponse } from "@/lib/blog-admin-crypto";
import { validateBlogHomepageContent } from "@/lib/blog-homepage-content";
import { homepagePublicationRow } from "@/lib/blog-public-homepage";
import { BlogEditorError, assertDraftVersion, readEditorJson, requireBlogEditor, safeEditorError } from "@/lib/blog-editor-auth";
type Db = Awaited<ReturnType<typeof requireBlogEditor>> & Pick<D1Database, "batch">;
const respond = (data: object, status = 200) => privateAdminResponse(data, status);
type Draft = { content_json: string; version: number };
function fail(status: number, message: string): never { throw new BlogEditorError(status, message); }
function publicationEnabled() {
  if ((env as unknown as { BLOG_ADMIN_PUBLICATION_ENABLED?: string }).BLOG_ADMIN_PUBLICATION_ENABLED !== "true")
    fail(503, "Homepage publication is off until review and D1 migration are complete.");
}
function only(data: Record<string, unknown>, names: string[]) {
  if (Object.keys(data).some(k => !names.includes(k))) fail(400, "Unexpected homepage publication field.");
}
async function savedDraft(db: Db, draftVersion: unknown): Promise<string> {
  const v = assertDraftVersion(draftVersion);
  const row = await db.prepare("SELECT content_json,version FROM blog_homepage_draft WHERE id=1").first<Draft>();
  if (!row || row.version !== v) fail(409, "Homepage draft has changed. Save and reload before publication.");
  const content = validateBlogHomepageContent(JSON.parse(row.content_json));
  return JSON.stringify(content);
}
function checkRevision(value: unknown) { return assertDraftVersion(value); }
function errorResponse(e: unknown): Response {
  return e instanceof BlogEditorError ? safeEditorError(e) :
    respond({ error: "Homepage publication storage unavailable. Verify additive D1 migration 0003." }, 503);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request);
    const current = await homepagePublicationRow(db);
    return respond({ publication: current ? {
      revision: current.revision, published: current.is_published === 1,
      updatedAt: current.updated_at,
    } : { revision: 0, published: false, updatedAt: null } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true) as Db;
    publicationEnabled();
    const input = await readEditorJson(request, 512);
    only(input, ["draftVersion","expectedRevision"]);
    const version = checkRevision(input.expectedRevision);
    const copy = await savedDraft(db, input.draftVersion);
    const current = await homepagePublicationRow(db);
    if (current?.revision !== version && !(current === null && version === 0))
      fail(409, "Homepage publication changed. Reload first.");
    const now = Math.floor(Date.now()/1000), next = version + 1;
    let results: D1Result[];
    try {
      results = current === null ? await db.batch([
        db.prepare("INSERT INTO blog_homepage_publication (id,revision,is_published,content_json,updated_at) VALUES (1,1,1,?,?)").bind(copy,now),
        db.prepare("INSERT INTO blog_homepage_publication_revisions (revision,action,content_json,recorded_at) VALUES (1,'publish',?,?)").bind(copy,now),
      ]) : await db.batch([
        db.prepare("UPDATE blog_homepage_publication SET revision=?,is_published=1,content_json=?,updated_at=? WHERE id=1 AND revision=?")
          .bind(next,copy,now,version),
        db.prepare("INSERT INTO blog_homepage_publication_revisions (revision,action,content_json,recorded_at) " +
          "SELECT revision,'publish',content_json,? FROM blog_homepage_publication WHERE id=1 AND revision=?")
          .bind(now,next),
      ]);
    } catch { fail(409, "Publication conflict or missing schema; verify D1 and reload."); }
    if (results[0]?.meta.changes !== 1) fail(409,"Homepage changed before publishing.");
    return respond({ publication: { revision: next, published: true, updatedAt: now } });
  } catch (e) { return errorResponse(e); }
}
export async function DELETE(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true) as Db;
    publicationEnabled();
    const input = await readEditorJson(request, 256);
    only(input,["expectedRevision"]);
    const version = checkRevision(input.expectedRevision);
    const current = await homepagePublicationRow(db);
    if (!current || current.revision !== version || !current.is_published)
      fail(409, "Homepage is already reverted or changed.");
    const now = Math.floor(Date.now()/1000), next = version + 1;
    const results = await db.batch([
      db.prepare("UPDATE blog_homepage_publication SET revision=?,is_published=0,updated_at=? WHERE id=1 AND revision=?")
        .bind(next,now,version),
      db.prepare("INSERT INTO blog_homepage_publication_revisions (revision,action,content_json,recorded_at) " +
        "SELECT revision,'revert',content_json,? FROM blog_homepage_publication WHERE id=1 AND revision=?")
        .bind(now,next),
    ]);
    if (results[0]?.meta.changes !== 1) fail(409, "Homepage changed before revert.");
    return respond({ publication: { revision: next, published: false, updatedAt: now } });
  } catch (e) { return errorResponse(e); }
}
export async function PUT(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true) as Db;
    publicationEnabled();
    const input = await readEditorJson(request, 256);
    only(input, ["expectedRevision","restoreRevision"]);
    const version = checkRevision(input.expectedRevision);
    const restore = checkRevision(input.restoreRevision);
    if (!restore || restore >= version) fail(400, "Choose an earlier published revision.");
    const current = await homepagePublicationRow(db);
    if (!current || current.revision !== version) fail(409, "Homepage has changed.");
    const historical = await db.prepare("SELECT content_json,action FROM blog_homepage_publication_revisions WHERE revision=?")
      .bind(restore).first<{ content_json: string; action: string }>();
    if (!historical || historical.action === "revert") fail(404, "Published homepage revision not found.");
    const copy = JSON.stringify(validateBlogHomepageContent(JSON.parse(historical.content_json)));
    const now = Math.floor(Date.now()/1000), next = version+1;
    const results = await db.batch([
      db.prepare("UPDATE blog_homepage_publication SET revision=?,is_published=1,content_json=?,updated_at=? WHERE id=1 AND revision=?")
        .bind(next,copy,now,version),
      db.prepare("INSERT INTO blog_homepage_publication_revisions (revision,action,content_json,recorded_at) " +
        "SELECT revision,'restore',content_json,? FROM blog_homepage_publication WHERE id=1 AND revision=?")
        .bind(now,next),
    ]);
    if (results[0]?.meta.changes !== 1) fail(409, "Homepage changed before restore.");
    return respond({ publication: { revision: next, published: true, updatedAt: now } });
  } catch (e) { return errorResponse(e); }
}