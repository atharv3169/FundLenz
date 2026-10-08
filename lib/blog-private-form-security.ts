/** Fail-closed controls for public visitor forms. Never log the submitted data. */
export class SubmissionError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "SubmissionError"; }
}
export function allowedEmail(value: unknown): string {
  if (typeof value !== "string") throw new SubmissionError(400, "Enter a valid email.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email))
    throw new SubmissionError(400, "Enter a valid email.");
  return email;
}
export function boundedText(value: unknown, max: number, required: boolean): string {
  if (value == null || value === "") {
    if (required) throw new SubmissionError(400, "A required field is missing.");
    return "";
  }
  if (typeof value !== "string") throw new SubmissionError(400, "Invalid text field.");
  const text = value.trim();
  if (text.length > max || (required && !text)) throw new SubmissionError(400, "Invalid text field.");
  return text;
}
export async function validateHuman(request: Request, token: unknown): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hosts = process.env.FORMS_ALLOWED_HOSTNAMES;
  if (!secret || !hosts) throw new SubmissionError(503, "Form submissions are not configured.");
  if (typeof token !== "string" || !token || token.length > 2048)
    throw new SubmissionError(400, "Please complete the verification.");
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret, response: token,
      ...(request.headers.get("CF-Connecting-IP") ? { remoteip: request.headers.get("CF-Connecting-IP")! } : {}),
    }),
    cache: "no-store",
  });
  if (!result.ok) throw new SubmissionError(503, "Verification is unavailable.");
  const info = await result.json() as { success?: boolean; hostname?: string; action?: string };
  const allowed = hosts.split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!info.success || !info.hostname || !allowed.includes(info.hostname.toLowerCase()))
    throw new SubmissionError(400, "Verification failed. Please retry.");
}
export function privateJSON(data: object, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function privateError(error: unknown): Response {
  if (error instanceof SubmissionError) return privateJSON({ error: error.message }, error.status);
  // Google errors, credentials and form data must not leak into HTTP replies/logs.
  return privateJSON({ error: "Submission storage is temporarily unavailable. Please retry." }, 503);
}
