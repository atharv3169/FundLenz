import { env } from "cloudflare:workers";
import { privateAdminResponse } from "@/lib/blog-admin-crypto";
import { type BlogArticleDraft } from "@/lib/blog-article-draft";
import { decodeRichDocument, storedDraftCategory } from "@/lib/blog-rich-document";
import { type PublishedArticle } from "@/lib/blog-publications";
import {
  getPublication, getPublicationForDraft, summarizePublication, validPublicationSlug,
  parsePublication, writePublication,
} from "@/lib/blog-publication-store";
import { BlogEditorError, isDraftId, readEditorJson, requireBlogEditor, safeEditorError } from "@/lib/blog-editor-auth";

type WriteDb = Awaited<ReturnType<typeof requireBlogEditor>> & Pick<D1Database, "batch">;
const noStore = (data: object, status = 200) => privateAdminResponse(data, status);
const fail = (status: number, message: string): never => { throw new BlogEditorError(status, message); };
const dateToday = () => new Date().toISOString().slice(0, 10);

function requirePublicationSwitch() {
  const config = env as unknown as { BLOG_ADMIN_PUBLICATION_ENABLED?: string };
  if (config.BLOG_ADMIN_PUBLICATION_ENABLED !== "true")
    fail(503, "Publication is disabled until D1 schema, security and browser acceptance are verified.");
}
function mustBeKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some(k => !keys.includes(k))) fail(400, "Unexpected publication field.");
}
function revisionNumber(v: unknown): number {
  if (!Number.isSafeInteger(v) || (v as number) < 0) fail(400, "Invalid public revision.");
  return v as number;
}
function validDraft(draft: BlogArticleDraft, version: unknown) {
  if (draft.version !== version) fail(409, "Draft changed. Save/reload it before publication.");
}
async function loadDraft(db: WriteDb, id: unknown): Promise<BlogArticleDraft> {
  if (!isDraftId(id)) fail(400, "Invalid draft identifier.");
  const draft = await db.prepare("SELECT * FROM blog_article_drafts WHERE id=? AND status='draft'")
    .bind(id).first<BlogArticleDraft>();
  if (!draft) fail(404, "Private draft not found.");
  return draft;
}
function fromDraft(draft: BlogArticleDraft, slug: string, originalDate?: string): PublishedArticle {
  if (!draft.title.trim() || draft.title === "Untitled draft" || !draft.summary.trim())
    fail(400, "Enter a final article title and summary before publishing.");
  const category = storedDraftCategory(draft.body_markdown, draft.category);
  const doc = decodeRichDocument(draft.body_markdown, category);
  if (!doc.blocks.some(b => "runs" in b && b.runs.some(r => r.text.trim())))
    fail(400, "Article must contain text before publishing.");
  const article: PublishedArticle = {
    slug, title: draft.title, summary: draft.summary, category,
    author: doc.author || { name: "FundLenz Editorial" },
    blocks: doc.blocks, publishedAt: originalDate || dateToday(),
  };
  parsePublication(JSON.stringify(article));
  return article;
}
function schemaError(error: unknown): Response {
  if (error instanceof BlogEditorError) return safeEditorError(error);
  return noStore({ error: "Publishing storage unavailable. Verify additive D1 migration 0003 and deployment." }, 503);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request);
    const id = new URL(request.url).searchParams.get("draftId");
    if (id) {
      if (!isDraftId(id)) fail(400, "Invalid draft identifier.");
      return noStore({ publication: summarizePublication(await getPublicationForDraft(db, id)) });
    }
    const records = await db.prepare(
      "SELECT slug,draft_id,revision,is_published,updated_at FROM blog_publications ORDER BY updated_at DESC LIMIT 100",
    ).all<{ slug: string; draft_id: string; revision: number; is_published: number; updated_at: number }>();
    return noStore({ publications: (records.results || []).map(row => summarizePublication({
      ...row, article_json: "{}", published_at: "",
    })) });
  } catch (e) { return schemaError(e); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true) as WriteDb;
    requirePublicationSwitch();
    const data = await readEditorJson(request, 512);
    mustBeKeys(data, ["draftId", "draftVersion", "slug", "expectedRevision"]);
    if (!validPublicationSlug(data.slug)) fail(400, "Use a lowercase hyphenated article URL slug.");
    const expectedRevision = revisionNumber(data.expectedRevision);
    const draft = await loadDraft(db, data.draftId);
    validDraft(draft, data.draftVersion);
    const previous = await getPublicationForDraft(db, draft.id);
    if (previous && (previous.slug !== data.slug || previous.revision !== expectedRevision))
      fail(409, "Publication changed or its permanent slug differs. Reload first.");
    if (!previous && expectedRevision !== 0) fail(409, "Publication revision no longer matches.");
    const article = fromDraft(draft, data.slug, previous?.published_at);
    const now = Math.floor(Date.now() / 1000);
    let changed = false;
    try {
      changed = await writePublication(db, {
        action: previous ? "update" : "publish", slug: data.slug, draftId: draft.id,
        expectedRevision, article, date: article.publishedAt, now,
      });
    } catch { fail(409, "Slug already owned, conflicting publication, or storage unavailable. Check D1 migration."); }
    if (!changed) fail(409, "Publication changed. Reload before updating.");
    return noStore({ publication: {
      slug: data.slug, draftId: draft.id, revision: expectedRevision + 1,
      published: true, updatedAt: now,
    }, url: "/blogpost/" + data.slug });
  } catch (e) { return schemaError(e); }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true) as WriteDb;
    requirePublicationSwitch();
    const data = await readEditorJson(request, 512);
    mustBeKeys(data, ["slug", "expectedRevision"]);
    if (!validPublicationSlug(data.slug)) fail(400, "Invalid article slug.");
    const expectedRevision = revisionNumber(data.expectedRevision);
    const previous = await getPublication(db, data.slug);
    if (!previous || previous.revision !== expectedRevision || !previous.is_published)
      fail(409, "Article already changed or unpublished.");
    const article = parsePublication(previous.article_json);
    const now = Math.floor(Date.now()/1000);
    const changed = await writePublication(db, {
      action: "unpublish", slug: previous.slug, draftId: previous.draft_id,
      expectedRevision, article, date: previous.published_at, now,
    });
    if (!changed) fail(409, "Article changed before unpublishing.");
    return noStore({ publication: {
      slug: previous.slug, draftId: previous.draft_id, revision: expectedRevision + 1,
      published: false, updatedAt: now,
    } });
  } catch (e) { return schemaError(e); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const db = await requireBlogEditor(request, true) as WriteDb;
    requirePublicationSwitch();
    const data = await readEditorJson(request, 512);
    mustBeKeys(data, ["slug", "expectedRevision", "restoreRevision"]);
    if (!validPublicationSlug(data.slug)) fail(400, "Invalid article slug.");
    const expectedRevision = revisionNumber(data.expectedRevision);
    const restoreRevision = revisionNumber(data.restoreRevision);
    if (!restoreRevision || restoreRevision >= expectedRevision)
      fail(400, "Restore a previous published revision only.");
    const previous = await getPublication(db, data.slug);
    if (!previous || previous.revision !== expectedRevision)
      fail(409, "Article changed before restoration.");
    const row = await db.prepare(
      "SELECT article_json,action FROM blog_publication_revisions WHERE slug=? AND revision=?",
    ).bind(data.slug, restoreRevision).first<{ article_json: string; action: string }>();
    if (!row || row.action === "unpublish") fail(404, "Published revision not found.");
    const article = parsePublication(row.article_json);
    const now = Math.floor(Date.now()/1000);
    const changed = await writePublication(db, {
      action: "restore", slug: previous.slug, draftId: previous.draft_id,
      expectedRevision, article, date: previous.published_at, now,
    });
    if (!changed) fail(409, "Article changed before restoration.");
    return noStore({ publication: {
      slug: previous.slug, draftId: previous.draft_id, revision: expectedRevision + 1,
      published: true, updatedAt: now,
    }, url: "/blogpost/" + previous.slug });
  } catch (e) { return schemaError(e); }
}