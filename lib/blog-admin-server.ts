import { env } from "cloudflare:workers";
import { BLOG_ADMIN_USERNAME, verifyPassword } from "@/lib/blog-admin-crypto";
import {
  type BlogAdminDatabase, validSessionSecret,
  authenticateSession, reserveLoginAttempt, recordLoginFailure,
} from "@/lib/blog-admin-state";

type RuntimeConfig = {
  BLOG_ADMIN_DB?: BlogAdminDatabase;
  FUNDLENZ_ADMIN_PASSWORD_HASH?: string;
  FUNDLENZ_ADMIN_SESSION_SECRET?: string;
  BLOG_ADMIN_ALLOWED_HOSTNAMES?: string;
};
export class AdminUnavailable extends Error {
  constructor(public readonly reason: "runtime" | "missing-client-ip" = "runtime") {
    super("Administrator login is not configured.");
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

export function requireAdminOrigin(request: Request, allowedHosts: string[]): void {
  const origin = request.headers.get("Origin");
  if (!origin) throw new AdminForbidden();
  let url: URL;
  try { url = new URL(origin); }
  catch { throw new AdminForbidden(); }
  const requestURL = new URL(request.url);
  if (url.protocol !== "https:" || url.origin !== requestURL.origin ||
      !allowedHosts.includes(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new AdminForbidden();
  }
}

export async function isAuthenticatedAdmin(request: Request): Promise<boolean> {
  const { db, secret } = adminRuntime();
  return authenticateSession(db, secret, request.headers.get("Cookie"));
}

export async function checkAdminPassword(request: Request, user: unknown, password: unknown): Promise<{
  authorized: boolean; db: BlogAdminDatabase; secret: string;
}> {
  const { db, secret, verifier, hosts } = adminRuntime();
  requireAdminOrigin(request, hosts);
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || ip.length > 64) throw new AdminUnavailable("missing-client-ip");
  const { actorHash, windowId } = await reserveLoginAttempt(db, secret, ip);
  const passwordString = typeof password === "string" && password.length <= 256 ? password : "";
  // Deliberately evaluate the password verifier even for incorrect usernames.
  const isCorrect = await verifyPassword(passwordString, verifier);
  const authorized = user === BLOG_ADMIN_USERNAME && isCorrect && passwordString.length >= 12;
  if (!authorized) await recordLoginFailure(db, actorHash, windowId);
  return { authorized, db, secret };
}
