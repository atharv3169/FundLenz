import {
  BLOG_ADMIN_COOKIE, BLOG_ADMIN_SESSION_SECONDS,
  hmacHex, parseCookie, makeSessionToken,
} from "@/lib/blog-admin-crypto";

export type BlogAdminDatabase = Pick<D1Database, "prepare">;
type SessionRow = { token_hash: string };
type CountRow = { attempt_count: number; failure_count: number };

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS_PER_WINDOW = 8;

/** The secret is a separate random value: it is NOT the admin password or Google token. */
export function validSessionSecret(raw: unknown): raw is string {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{43,}$/.test(raw) && raw.length <= 256;
}

export async function authenticateSession(db: BlogAdminDatabase, secret: string, cookieHeader: string | null): Promise<boolean> {
  const token = parseCookie(cookieHeader, BLOG_ADMIN_COOKIE);
  if (!token) return false;
  const hash = await hmacHex(secret, "admin-session:" + token);
  const row = await db.prepare(
    "SELECT token_hash FROM blog_admin_sessions WHERE token_hash = ? AND expires_at > ? AND revoked_at IS NULL",
  ).bind(hash, Math.floor(Date.now() / 1000)).first<SessionRow>();
  return Boolean(row?.token_hash);
}

export async function startSession(db: BlogAdminDatabase, secret: string): Promise<string> {
  const token = makeSessionToken();
  const hash = await hmacHex(secret, "admin-session:" + token);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(
    "INSERT INTO blog_admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)",
  ).bind(hash, now, now + BLOG_ADMIN_SESSION_SECONDS).run();
  return token;
}

export async function revokeSession(db: BlogAdminDatabase, secret: string, cookieHeader: string | null): Promise<void> {
  const token = parseCookie(cookieHeader, BLOG_ADMIN_COOKIE);
  if (!token) return;
  const hash = await hmacHex(secret, "admin-session:" + token);
  await db.prepare("UPDATE blog_admin_sessions SET revoked_at = ? WHERE token_hash = ?")
    .bind(Math.floor(Date.now() / 1000), hash).run();
}

export async function reserveLoginAttempt(db: BlogAdminDatabase, secret: string, clientIP: string): Promise<{
  actorHash: string; windowId: number; attempts: number;
}> {
  const actorHash = await hmacHex(secret, "admin-login-IP:" + clientIP);
  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  // SQLite INSERT ... ON CONFLICT is atomic, unlike per-instance JS memory.
  await db.prepare(
    "INSERT INTO blog_admin_attempts (actor_hash, window_id, attempt_count, failure_count) VALUES (?, ?, 1, 0) " +
    "ON CONFLICT(actor_hash, window_id) DO UPDATE SET attempt_count = attempt_count + 1",
  ).bind(actorHash, windowId).run();
  const counter = await db.prepare(
    "SELECT attempt_count, failure_count FROM blog_admin_attempts WHERE actor_hash = ? AND window_id = ?",
  ).bind(actorHash, windowId).first<CountRow>();
  if (!counter || counter.attempt_count > MAX_ATTEMPTS_PER_WINDOW)
    throw new BlogAdminRateLimit();
  return { actorHash, windowId, attempts: counter.attempt_count };
}

export class BlogAdminRateLimit extends Error {
  constructor() { super("Too many login attempts. Please try again later."); }
}

export async function recordLoginFailure(db: BlogAdminDatabase, actorHash: string, windowId: number): Promise<void> {
  await db.prepare(
    "UPDATE blog_admin_attempts SET failure_count = failure_count + 1 WHERE actor_hash = ? AND window_id = ?",
  ).bind(actorHash, windowId).run();
  const row = await db.prepare(
    "SELECT failure_count FROM blog_admin_attempts WHERE actor_hash = ? AND window_id = ?",
  ).bind(actorHash, windowId).first<CountRow>();
  // > 3 failures raises a durable pending event; notification transport will be integrated later.
  if (row && row.failure_count >= 4) {
    const eventId = actorHash + ":" + windowId;
    await db.prepare(
      "INSERT OR IGNORE INTO blog_admin_security_events " +
      "(id, created_at, event_type, actor_hash, failure_count, notification_status) " +
      "VALUES (?, ?, 'four-plus-failed-logins', ?, ?, 'pending')",
    ).bind(eventId, Math.floor(Date.now() / 1000), actorHash, row.failure_count).run();
  }
}
