import { adminRuntime, requireAdminOrigin } from "@/lib/blog-admin-server";
import { clearSessionCookie, privateAdminResponse } from "@/lib/blog-admin-crypto";
import { revokeSession } from "@/lib/blog-admin-state";

export async function POST(request: Request): Promise<Response> {
  try {
    const { db, secret, hosts } = adminRuntime();
    requireAdminOrigin(request, hosts);
    // Database revocation must complete before reporting logout success.
    await revokeSession(db, secret, request.headers.get("Cookie"));
    return privateAdminResponse({ authenticated: false }, 200, clearSessionCookie());
  } catch {
    return privateAdminResponse({ error: "Logout is unavailable. Please retry." }, 503);
  }
}
