/** Public homepage copy is explicitly promoted and separate from private D1 drafts. */
import { defaultBlogHomepageContent, validateBlogHomepageContent, type BlogHomepageContent } from "@/lib/blog-homepage-content";
import { BLOG_STAGING_HOST, readStagingHomepageCopy } from "@/lib/blog-staging-homepage";
import type { BlogAdminDatabase } from "@/lib/blog-admin-state";

type HomepagePublicationRow = {
  content_json: string; revision: number; is_published: number; updated_at: number;
};

export async function readPublicHomepageCopy(host: string | null, db?: BlogAdminDatabase): Promise<BlogHomepageContent> {
  if (host === BLOG_STAGING_HOST) return readStagingHomepageCopy(host, db);
  if (!["fundlenz.atharvsahu711.workers.dev", "fundlenz.com"].includes(host || "") || !db?.prepare)
    return defaultBlogHomepageContent;
  try {
    const row = await db.prepare("SELECT content_json FROM blog_homepage_publication WHERE id=1 AND is_published=1")
      .first<{ content_json: string }>();
    return row ? validateBlogHomepageContent(JSON.parse(row.content_json)) : defaultBlogHomepageContent;
  } catch {
    // Missing additive schema never publishes a private draft.
    return defaultBlogHomepageContent;
  }
}

export async function homepagePublicationRow(db: BlogAdminDatabase): Promise<HomepagePublicationRow | null> {
  return db.prepare("SELECT content_json,revision,is_published,updated_at FROM blog_homepage_publication WHERE id=1")
    .first<HomepagePublicationRow>();
}
export type { HomepagePublicationRow };