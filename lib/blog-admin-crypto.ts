/** Portable, no-dependency security primitives for the FundLenz single-admin login. */
const encoder = new TextEncoder();
export const BLOG_ADMIN_USERNAME = "cookiemonster";
export const BLOG_ADMIN_ITERATIONS = 100_000;
export const BLOG_ADMIN_SESSION_SECONDS = 8 * 60 * 60;
export const BLOG_ADMIN_COOKIE = "__Host-fundlenz_admin";

export function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function parseB64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid verifier.");
  const encoded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(encoded + "=".repeat((4 - encoded.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function secureRandom(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}

function constantTimeSame(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}

export async function derivePassword(password: string, salt: Uint8Array, iterations = BLOG_ADMIN_ITERATIONS): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", iterations,
    salt: new Uint8Array(salt).buffer,
  }, material, 256);
  return new Uint8Array(bits);
}

export async function createPasswordVerifier(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) throw new Error("Use a password between 12 and 256 characters.");
  const salt = secureRandom(24);
  const digest = await derivePassword(password, salt);
  return ["pbkdf2_sha256", String(BLOG_ADMIN_ITERATIONS), b64url(salt), b64url(digest)].join("$");
}

export async function verifyPassword(password: string, verifier: string): Promise<boolean> {
  // Never accept unrecognised or deliberately weak verifier parameters.
  const parts = verifier.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256" || parts[1] !== String(BLOG_ADMIN_ITERATIONS)) return false;
  let salt: Uint8Array; let expected: Uint8Array;
  try {
    salt = parseB64url(parts[2]);
    expected = parseB64url(parts[3]);
  } catch { return false; }
  if (salt.length !== 24 || expected.length !== 32) return false;
  if (password.length > 256) return false;
  // Cloudflare Workers' deployed PBKDF2 runtime rejects individual
  // derivations above 100,000 rounds. Reject all incompatible/legacy
  // verifier formats instead of silently downgrading them.
  const actual = await derivePassword(password, salt);
  return constantTimeSame(actual, expected);
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
    name: "HMAC", hash: "SHA-256",
  }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(digest, x => x.toString(16).padStart(2, "0")).join("");
}

export function makeSessionToken(): string { return b64url(secureRandom(32)); }

export function parseCookie(header: string | null, cookie: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === cookie && rest.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(rest[0]))
      return rest[0];
  }
  return null;
}

export function sessionCookie(token: string): string {
  return BLOG_ADMIN_COOKIE + "=" + token +
    "; Path=/; Max-Age=" + BLOG_ADMIN_SESSION_SECONDS +
    "; Secure; HttpOnly; SameSite=Strict";
}

export function clearSessionCookie(): string {
  return BLOG_ADMIN_COOKIE + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict";
}

export function privateAdminResponse(data: object, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
