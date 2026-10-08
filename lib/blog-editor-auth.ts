import { adminRuntime, isAuthenticatedAdmin, requireAdminOrigin, AdminForbidden, AdminUnavailable } from "@/lib/blog-admin-server";
import type { BlogAdminDatabase } from "@/lib/blog-admin-state";
import { privateAdminResponse } from "@/lib/blog-admin-crypto";

// Editorial drafts are intentionally restricted to a separately configured,
// password-gated staging Worker until the publishing workflow is reviewed.
export const BLOG_EDITOR_STAGING_HOST = "fundlenz-blog-staging.atharvsahu711.workers.dev";

export class BlogEditorError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function requireBlogEditor(request: Request, writing = false): Promise<BlogAdminDatabase> {
  const url = new URL(request.url);
  if (url.protocol !== "https:" || url.hostname !== BLOG_EDITOR_STAGING_HOST ||
      (url.port && url.port !== "443")) {
    throw new BlogEditorError(404, "Editorial drafts are not available on this host.");
  }
  const { db, hosts } = adminRuntime();
  if (!hosts.includes(BLOG_EDITOR_STAGING_HOST))
    throw new BlogEditorError(503, "Editorial access is not configured.");
  if (writing) requireAdminOrigin(request, hosts);
  if (!(await isAuthenticatedAdmin(request)))
    throw new BlogEditorError(401, "Administrator sign-in is required.");
  return db;
}

export async function readEditorJson(request: Request, max = 54000): Promise<Record<string, unknown>> {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json"))
    throw new BlogEditorError(415, "Expected JSON.");
  const advertised = Number(request.headers.get("Content-Length") || "0");
  if (!Number.isFinite(advertised) || advertised > max)
    throw new BlogEditorError(413, "Draft exceeds size limit.");
  if (!request.body) throw new BlogEditorError(400, "Missing draft.");
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw new BlogEditorError(413, "Draft exceeds size limit.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buf = new Uint8Array(bytes);
  let pos = 0;
  for (const chunk of chunks) { buf.set(chunk, pos); pos += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buf)); }
  catch { throw new BlogEditorError(400, "Invalid draft JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new BlogEditorError(400, "Invalid draft object.");
  return parsed as Record<string, unknown>;
}

export function safeEditorError(error: unknown): Response {
  if (error instanceof BlogEditorError)
    return privateAdminResponse({ error: error.message }, error.status);
  if (error instanceof AdminForbidden)
    return privateAdminResponse({ error: "Invalid editing origin." }, 403);
  if (error instanceof AdminUnavailable)
    return privateAdminResponse({ error: "Editorial authentication is unavailable." }, 503);
  // Do not leak D1 statements, session data, secrets, or SQL errors.
  return privateAdminResponse({ error: "Draft storage is temporarily unavailable. Verify the staging database migration." }, 503);
}

export function assertDraftVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new BlogEditorError(400, "Invalid draft revision.");
  return value as number;
}

export function isDraftId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}
