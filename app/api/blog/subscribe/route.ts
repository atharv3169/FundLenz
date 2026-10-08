import { saveSubscriber } from "@/lib/blog-private-drive";
import { allowedEmail, privateError, privateJSON, SubmissionError, validateHuman } from "@/lib/blog-private-form-security";

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 16_384) throw new SubmissionError(413, "Request is too large.");
    if (!(request.headers.get("content-type") || "").includes("application/json"))
      throw new SubmissionError(415, "Expected JSON.");
    const text = await request.text();
    if (text.length > 16_384) throw new SubmissionError(413, "Request is too large.");
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new SubmissionError(400, "Invalid request."); }
    if (!value || typeof value !== "object") throw new SubmissionError(400, "Invalid request.");
    const data = value as Record<string, unknown>;
    const email = allowedEmail(data.email);
    if (data.consent !== true) throw new SubmissionError(400, "Consent is required.");
    await validateHuman(request, data.turnstileToken);
    const status = await saveSubscriber(email);
    return privateJSON({ ok: true, status }, 200);
  } catch (error) { return privateError(error); }
}
