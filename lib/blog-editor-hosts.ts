/** Exact, reviewed editorial origins. These are not wildcard matches.
 * BLOG_ADMIN_ALLOWED_HOSTNAMES must independently authorize the active host.
 * The custom domain stays inactive until the owner's deliberate DNS cutover.
 */
export const BLOG_EDITOR_STAGING_HOST = "fundlenz-blog-staging.atharvsahu711.workers.dev";
export const BLOG_EDITOR_PRODUCTION_HOST = "fundlenz.atharvsahu711.workers.dev";
export const BLOG_EDITOR_FUTURE_HOST = "fundlenz.com";

const REVIEWED_EDITOR_HOSTS = new Set([
  BLOG_EDITOR_STAGING_HOST,
  BLOG_EDITOR_PRODUCTION_HOST,
  BLOG_EDITOR_FUTURE_HOST,
]);

export function isReviewedEditorHost(host: string): boolean {
  return REVIEWED_EDITOR_HOSTS.has(host.toLowerCase());
}

export function isReviewedEditorUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isReviewedEditorHost(url.hostname) &&
      (!url.port || url.port === "443") && !url.username && !url.password;
  } catch {
    return false;
  }
}
