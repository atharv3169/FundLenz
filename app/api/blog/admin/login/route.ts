import {
  privateAdminResponse, sessionCookie,
} from "@/lib/blog-admin-crypto";
import { checkAdminPassword, AdminUnavailable } from "@/lib/blog-admin-server";
import { BlogAdminRateLimit, startSession } from "@/lib/blog-admin-state";

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("Content-Type") || "";
    const length = Number(request.headers.get("Content-Length") || "0");
    if (!contentType.toLowerCase().includes("application/json") || !Number.isFinite(length) || length > 2048)
      return privateAdminResponse({ error: "Invalid login request." }, 400);
    const text = await request.text();
    if (text.length > 2048) return privateAdminResponse({ error: "Invalid login request." }, 400);
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { return privateAdminResponse({ error: "Invalid login request." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return privateAdminResponse({ error: "Invalid login request." }, 400);
    const { username, password } = body as Record<string, unknown>;
    const result = await checkAdminPassword(request, username, password);
    if (!result.authorized)
      return privateAdminResponse({ error: "Incorrect username or password." }, 401);
    const token = await startSession(result.db, result.secret);
    return privateAdminResponse({ authenticated: true }, 200, sessionCookie(token));
  } catch (error) {
    if (error instanceof BlogAdminRateLimit)
      return privateAdminResponse({ error: "Too many login attempts. Please try again later." }, 429);
    if (error instanceof AdminUnavailable)
      return privateAdminResponse({ error: "Administrator login is currently unavailable." }, 503);
    return privateAdminResponse({ error: "Administrator login is currently unavailable." }, 503);
  }
}
