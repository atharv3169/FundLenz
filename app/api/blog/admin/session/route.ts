import { isActiveEditorHost, isAuthenticatedAdmin } from "@/lib/blog-admin-server";
import { privateAdminResponse } from "@/lib/blog-admin-crypto";

export async function GET(request: Request): Promise<Response> {
  try {
    if (!isActiveEditorHost(request))
      return privateAdminResponse({ error: "Administrator login is not available on this host." }, 503);
    const authenticated = await isAuthenticatedAdmin(request);
    return privateAdminResponse({ authenticated });
  } catch {
    return privateAdminResponse({ error: "Administrator session service is not configured." }, 503);
  }
}
