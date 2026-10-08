/**
 * Read-only staging website preview of *homepage presentation copy*.
 * A saved homepage draft is not a production publication. Only the private,
 * password-gated staging host can display it. Never expose article drafts,
 * subscribers, contributor documents, credentials, or admin/session tables.
 */
import { defaultBlogHomepageContent, validateBlogHomepageContent, type BlogHomepageContent } from "@/lib/blog-homepage-content";
import type { BlogAdminDatabase } from "@/lib/blog-admin-state";

export const BLOG_STAGING_HOST = "fundlenz-blog-staging.atharvsahu711.workers.dev";

export async function readStagingHomepageCopy(host: string | null, db?: BlogAdminDatabase): Promise<BlogHomepageContent> {
  // Main-site traffic always receives the reviewed, source-controlled copy.
  // A spoofed hostname cannot supply a D1 binding or bypass the staging Worker gate.
  if (host !== BLOG_STAGING_HOST) return defaultBlogHomepageContent;
  if (!db?.prepare) throw new Error("Staging homepage preview database is unavailable.");
  const row = await db.prepare("SELECT content_json FROM blog_homepage_draft WHERE id=1")
    .first<{ content_json: string }>();
  return row ? validateBlogHomepageContent(JSON.parse(row.content_json)) : defaultBlogHomepageContent;
}
