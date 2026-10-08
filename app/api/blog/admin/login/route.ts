import {
  privateAdminResponse, sessionCookie,
} from "@/lib/blog-admin-crypto";
import { checkAdminPassword, AdminUnavailable, AdminForbidden, AdminCredentialStageFailure } from "@/lib/blog-admin-server";
import { limitedBody, SubmissionError } from "@/lib/blog-private-form-security";
import { BlogAdminRateLimit, startSession } from "@/lib/blog-admin-state";

export async function POST(request: Request): Promise<Response> {
  // Only report broad error categories on the password-gated staging hostname.
  // This does not log passwords, request bodies, personal data, or database SQL.
  let phase: "request" | "credentials" | "session" = "request";
  const stagingOnly = new URL(request.url).hostname === "fundlenz-blog-staging.atharvsahu711.workers.dev";
  try {
    const contentType = request.headers.get("Content-Type") || "";
    const length = Number(request.headers.get("Content-Length") || "0");
    if (!contentType.toLowerCase().includes("application/json") || !Number.isFinite(length) || length > 2048)
      return privateAdminResponse({ error: "Invalid login request." }, 400);
    const text = new TextDecoder().decode(await limitedBody(request, 2048));
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { return privateAdminResponse({ error: "Invalid login request." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return privateAdminResponse({ error: "Invalid login request." }, 400);
    const { username, password } = body as Record<string, unknown>;
    phase = "credentials";
    const result = await checkAdminPassword(request, username, password);
    if (!result.authorized)
      return privateAdminResponse({ error: "Incorrect username or password." }, 401);
    phase = "session";
    const token = await startSession(result.db, result.secret);
    return privateAdminResponse({ authenticated: true }, 200, sessionCookie(token));
  } catch (error) {
    if (error instanceof BlogAdminRateLimit)
      return privateAdminResponse({ error: "Too many login attempts. Please try again later." }, 429);
    if (error instanceof AdminForbidden)
      return privateAdminResponse({ error: "Invalid request origin." }, 403);
    if (error instanceof SubmissionError)
      return privateAdminResponse({ error: "Invalid login request." }, error.status === 413 ? 413 : 400);
    // Safe non-sensitive category for debugging the isolated staging deployment.
    // Never return detailed database errors or cryptographic error messages.
    const reference = error instanceof AdminUnavailable
      ? (error.reason === "missing-client-ip" ? "FL-AIP" : "FL-CFG")
      : error instanceof AdminCredentialStageFailure
        ? (error.stage === "d1-reserve" ? "FL-D1R" :
           error.stage === "password-kdf" ? "FL-KDF" : "FL-D1F")
      : phase === "credentials" ? "FL-VER"
      : phase === "session" ? "FL-SES" : "FL-REQ";
    if (stagingOnly) {
      console.error("[FundLenz staging admin login] Safe failure category:", reference);
    }
    return privateAdminResponse({
      error: "Administrator login is currently unavailable." +
        (stagingOnly ? " Reference: " + reference + "." : ""),
    }, 503);
  }
}
