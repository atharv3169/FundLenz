import { saveSubscriber } from "@/lib/blog-private-drive";
import {
  allowedEmail, limitedBody, privateError, privateJSON,
  requireAllowedOrigin, SubmissionError, validateHuman,
} from "@/lib/blog-private-form-security";

const MAX_BODY = 16_384;
export async function POST(request: Request) {
  try {
    requireAllowedOrigin(request);
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json"))
      throw new SubmissionError(415, "Expected JSON.");
    const bytes = await limitedBody(request, MAX_BODY);
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new SubmissionError(400, "Invalid request."); }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new SubmissionError(400, "Invalid request.");
    const data = value as Record<string, unknown>;
    const email = allowedEmail(data.email);
    if (data.consent !== true) throw new SubmissionError(400, "Consent is required.");
    await validateHuman(request, data.turnstileToken, "blog_subscribe");
    const status = await saveSubscriber(email);
    return privateJSON({ ok: true, status }, 200);
  } catch (error) { return privateError(error); }
}
