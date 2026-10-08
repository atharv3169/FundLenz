/** Security boundary for the visitor-facing blog forms. Keep submissions out of logs. */
export class SubmissionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "SubmissionError";
  }
}

function configuredHosts(): string[] {
  return (process.env.FORMS_ALLOWED_HOSTNAMES || "")
    .split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
}

/** Browser-origin CSRF barrier. Turnstile verification below is an additional barrier. */
export function requireAllowedOrigin(request: Request): void {
  const allowed = configuredHosts();
  if (!allowed.length) throw new SubmissionError(503, "Form submissions are not configured.");
  const origin = request.headers.get("Origin");
  if (!origin) throw new SubmissionError(403, "This form must be submitted from FundLenz.");
  let url: URL;
  try { url = new URL(origin); }
  catch { throw new SubmissionError(403, "Invalid request origin."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !allowed.includes(url.hostname.toLowerCase()) || (url.port && url.port !== "443")) {
    throw new SubmissionError(403, "This form must be submitted from FundLenz.");
  }
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

export function optionalSocialUrl(value: unknown): string {
  const social = boundedText(value, 500, false);
  if (!social) return "";
  let url: URL;
  try { url = new URL(social); }
  catch { throw new SubmissionError(400, "Enter a valid social profile link."); }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") ||
      url.username || url.password || url.port && url.port !== "443" && url.port !== "80") {
    throw new SubmissionError(400, "Enter a valid social profile link.");
  }
  return url.toString();
}

/** Limit request bodies before parsing multipart files (including chunked uploads). */
export async function limitedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const advertised = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(advertised) || advertised < 0 || advertised > maxBytes)
    throw new SubmissionError(413, "Request exceeds the upload limit.");
  if (!request.body) throw new SubmissionError(400, "Missing request body.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new SubmissionError(413, "Request exceeds the upload limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function validateHuman(request: Request, token: unknown, expectedAction: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hosts = configuredHosts();
  if (!secret || !hosts.length) throw new SubmissionError(503, "Form submissions are not configured.");
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
  if (!info.success || !info.hostname || !hosts.includes(info.hostname.toLowerCase()) ||
      info.action !== expectedAction) {
    throw new SubmissionError(400, "Verification failed. Please retry.");
  }
}

export function privateJSON(data: object, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function privateError(error: unknown): Response {
  if (error instanceof SubmissionError) return privateJSON({ error: error.message }, error.status);
  // Never reflect Google API errors, secrets, or submitted data to visitors.
  return privateJSON({ error: "Submission storage is temporarily unavailable. Please retry." }, 503);
}
