/** Explicit, revisioned public snapshots, physically separate from private drafts. */
import type { BlogAdminDatabase } from "@/lib/blog-admin-state";
import { validatePublishedArticles, type PublishedArticle } from "@/lib/blog-publications";

export type PublicRow = {
  slug: string; draft_id: string; revision: number; is_published: number;
  article_json: string; published_at: string; updated_at: number;
};
export type PublicationSummary = {
  slug: string; draftId: string; revision: number; published: boolean; updatedAt: number;
};

export const validPublicationSlug = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

export function parsePublication(raw: string): PublishedArticle {
  const item: unknown = JSON.parse(raw);
  if (!item || typeof item !== "object" || Array.isArray(item))
    throw new Error("Invalid public snapshot.");
  validatePublishedArticles([item as PublishedArticle]);
  return item as PublishedArticle;
}

export async function readPublished(db: BlogAdminDatabase | undefined, slug?: string): Promise<PublishedArticle[]> {
  if (!db?.prepare) return [];
  // A missing additive migration must never crash the existing public portfolio/site.
  try {
    const statement = slug
      ? db.prepare("SELECT article_json FROM blog_publications WHERE is_published=1 AND slug=? LIMIT 1").bind(slug)
      : db.prepare("SELECT article_json FROM blog_publications WHERE is_published=1 ORDER BY updated_at DESC LIMIT 300");
    const result = await statement.all<{ article_json: string }>();
    return (result.results || []).map(row => parsePublication(row.article_json));
  } catch {
    // Fail closed: private D1 data is never exposed as a fallback.
    return [];
  }
}

export async function getPublication(db: BlogAdminDatabase, slug: string): Promise<PublicRow | null> {
  return await db.prepare(
    "SELECT slug,draft_id,revision,is_published,article_json,published_at,updated_at FROM blog_publications WHERE slug=?",
  ).bind(slug).first<PublicRow>();
}

export async function getPublicationForDraft(db: BlogAdminDatabase, draftId: string): Promise<PublicRow | null> {
  return await db.prepare(
    "SELECT slug,draft_id,revision,is_published,article_json,published_at,updated_at FROM blog_publications WHERE draft_id=?",
  ).bind(draftId).first<PublicRow>();
}

export function summarizePublication(row: PublicRow | null): PublicationSummary | null {
  return row ? {
    slug: row.slug, draftId: row.draft_id, revision: row.revision,
    published: row.is_published === 1, updatedAt: row.updated_at,
  } : null;
}

/** D1 batch is transactional: source snapshot and revision ledger are committed together. */
export async function writePublication(
  db: BlogAdminDatabase & Pick<D1Database, "batch">,
  input: { action: "publish"|"update"|"unpublish"|"restore"; slug: string;
    draftId: string; expectedRevision: number; article: PublishedArticle; date: string; now: number },
): Promise<boolean> {
  const { action, slug, draftId, expectedRevision, article, date, now } = input;
  const snapshot = JSON.stringify(article);
  if (expectedRevision === 0 && action === "publish") {
    await db.batch([
      db.prepare("INSERT INTO blog_publications (slug,draft_id,revision,is_published,article_json,published_at,updated_at) VALUES (?,?,1,1,?,?,?)")
        .bind(slug, draftId, snapshot, date, now),
      db.prepare("INSERT INTO blog_publication_revisions (slug,revision,action,article_json,recorded_at) VALUES (?,1,'publish',?,?)")
        .bind(slug, snapshot, now),
    ]);
    return true;
  }
  const status = action === "unpublish" ? 0 : 1;
  const nextRevision = expectedRevision + 1;
  const result = await db.batch([
    db.prepare("UPDATE blog_publications SET revision=?,is_published=?,article_json=?,updated_at=? WHERE slug=? AND draft_id=? AND revision=?")
      .bind(nextRevision, status, snapshot, now, slug, draftId, expectedRevision),
    db.prepare("INSERT INTO blog_publication_revisions (slug,revision,action,article_json,recorded_at) " +
      "SELECT slug,revision,?,?,? FROM blog_publications WHERE slug=? AND draft_id=? AND revision=?")
      .bind(action, snapshot, now, slug, draftId, nextRevision),
  ]);
  return result[0]?.meta?.changes === 1;
}