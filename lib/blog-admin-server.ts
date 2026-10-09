import { env } from "cloudflare:workers";
import { BLOG_ADMIN_USERNAME, verifyPassword } from "@/lib/blog-admin-crypto";
import { isReviewedEditorUrl, BLOG_EDITOR_STAGING_HOST } from "@/lib/blog-editor-hosts";
import {
  type BlogAdminDatabase, validSessionSecret,
  authenticateSession, reserveLoginAttempt, recordLoginFailure, BlogAdminRateLimit,
} from "@/lib/blog-admin-state";

type RuntimeConfig = {
  BLOG_ADMIN_DB?: BlogAdminDatabase;
  FUNDLENZ_ADMIN_PASSWORD_HASH?: string;
  FUNDLENZ_ADMIN_SESSION_SECRET?: string;
  BLOG_ADMIN_ALLOWED_HOSTNAMES?: string;
  BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED?: string;
};
export class AdminUnavailable extends Error {
  constructor(public readonly reason: "runtime" | "missing-client-ip" = "runtime") {
    super("Administrator login is not configured.");
  }
}
/** Non-sensitive stage classification: never include raw DB/crypto errors or input. */
export class AdminCredentialStageFailure extends Error {
  constructor(public readonly stage: "d1-reserve" | "password-kdf" | "d1-failure-count") {
    super("Administrator credential stage failed.");
  }
}
export class AdminForbidden extends Error {
  constructor() { super("Cross-origin admin requests are forbidden."); }
}

export function adminRuntime(): {
  db: BlogAdminDatabase; verifier: string; secret: string; hosts: string[];
} {
  const config = env as unknown as RuntimeConfig;
  const db = config.BLOG_ADMIN_DB;
  const verifier = config.FUNDLENZ_ADMIN_PASSWORD_HASH;
  const secret = config.FUNDLENZ_ADMIN_SESSION_SECRET;
  const hosts = (config.BLOG_ADMIN_ALLOWED_HOSTNAMES || "")
    .split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!db || typeof db.prepare !== "function" || !verifier ||
      !validSessionSecret(secret) || !hosts.length)
    throw new AdminUnavailable();
  return { db, verifier, secret, hosts };
}

/** An independent operator switch keeps production editing unavailable
 * until the existing native single-admin security checks pass in real browsers.
 * No Cloudflare Access, Zero Trust, or billing-required service is assumed.
 * Staging retains its existing separate password gate.
 */
export function isActiveEditorHost(request: Request): boolean {
  if (!isReviewedEditorUrl(request.url)) return false;
  if (new URL(request.url).hostname.toLowerCase() === BLOG_EDITOR_STAGING_HOST) return true;
  return (env as unknown as RuntimeConfig).BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED === "true";
}

export function requireAdminOrigin(request: Request, allowedHosts: string[]): void {
  const origin = request.headers.get("Origin");
  if (!origin) throw new AdminForbidden();
  let url: URL;
  try { url = new URL(origin); }
  catch { throw new AdminForbidden(); }
  const requestURL = new URL(request.url);
  if (!isReviewedEditorUrl(request.url) ||
      url.protocol !== "https:" || url.origin !== requestURL.origin ||
      !allowedHosts.includes(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new AdminForbidden();
  }
  if (!isActiveEditorHost(request)) throw new AdminUnavailable();
}

export async function isAuthenticatedAdmin(request: Request): Promise<boolean> {
  // Even a valid cookie may not authorize an unexpected proxy/custom host or
  // a public Worker that the operator has not deliberately activated.
  if (!isActiveEditorHost(request)) return false;
  const { db, secret, hosts } = adminRuntime();
  if (!hosts.includes(new URL(request.url).hostname.toLowerCase())) return false;
  return authenticateSession(db, secret, request.headers.get("Cookie"));
}

export async function checkAdminPassword(request: Request, user: unknown, password: unknown): Promise<{
  authorized: boolean; db: BlogAdminDatabase; secret: string;
}> {
  const { db, secret, verifier, hosts } = adminRuntime();
  requireAdminOrigin(request, hosts);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 64) throw new AdminUnavailable("missing-client-ip");
  let attempt: Awaited<ReturnType<typeof reserveLoginAttempt>>;
  try {
    attempt = await reserveLoginAttempt(db, secret, ip);
  } catch (error) {
    // Do not convert rate limits into 503s or hide the original 429 behavior.
    if (error instanceof BlogAdminRateLimit) throw error;
    throw new AdminCredentialStageFailure("d1-reserve");
  }
  const { actorHash, windowId } = attempt;
  const passwordString = typeof password === "string" && password.length <= 256 ? password : "";
  // Evaluate the verifier even when the username is wrong; don't leak whether it matched.
  let isCorrect: boolean;
  try {
    isCorrect = await verifyPassword(passwordString, verifier);
  } catch {
    throw new AdminCredentialStageFailure("password-kdf");
  }
  const authorized = user === BLOG_ADMIN_USERNAME && isCorrect && passwordString.length >= 12;
  if (!authorized) {
    try {
      await recordLoginFailure(db, actorHash, windowId);
    } catch {
      throw new AdminCredentialStageFailure("d1-failure-count");
    }
  }
  return { authorized, db, secret };
}
