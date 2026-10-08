/**
 * FundLenz staging-only HTTP Basic access gate.
 * Never imported by the public FundLenz Worker. No database, payment or identity provider.
 * All content, including static assets, must traverse this code (run_worker_first=true).
 */
const USERNAME = "fundlenz-staging";
const MIN_SECRET_CHARS = 24;
const encoder = new TextEncoder();

function response(body, status, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...extraHeaders,
    },
  });
}

function failClosedSecret(env) {
  const secret = env?.FUNDLENZ_STAGING_GATE_PASSWORD;
  return typeof secret === "string" &&
    secret.length >= MIN_SECRET_CHARS && secret.length <= 256 &&
    /^[\x21-\x7E]+$/.test(secret) ? secret : null;
}

function basicCredentials(header) {
  if (!header || header.length > 600 || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(header))
    return null;
  try {
    const raw = atob(header.slice(6));
    const colon = raw.indexOf(":");
    if (colon === -1 || raw.length > 300) return null;
    return { username: raw.slice(0, colon), password: raw.slice(colon + 1) };
  } catch { return null; }
}

async function constantTimeMatch(given, expected) {
  // Compare fixed-length digests instead of comparing secret text character by character.
  const [a, b] = await Promise.all([given, expected].map(value =>
    crypto.subtle.digest("SHA-256", encoder.encode(value)).then(v => new Uint8Array(v)),
  ));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

/** Return a denial response or null when the request may reach the application. */
export async function stagingGate(request, env) {
  const secret = failClosedSecret(env);
  if (!secret) {
    return response("FundLenz staging access is not configured yet.", 503);
  }

  const credentials = basicCredentials(request.headers.get("Authorization"));
  // Compare even for wrong user when a syntactically valid Authorization header is present.
  const passOkay = credentials
    ? await constantTimeMatch(credentials.password, secret)
    : false;
  if (!credentials || credentials.username !== USERNAME || !passOkay) {
    return response("FundLenz staging: sign in to view this test site.", 401, {
      "WWW-Authenticate": 'Basic realm="FundLenz Private Staging", charset="UTF-8"',
    });
  }
  return null;
}

export function forwardWithoutBasicHeader(request) {
  // The separate staging password should never enter app routes, instrumentation, or logs.
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  headers.delete("Proxy-Authorization");
  return new Request(request, { headers });
}

/**
 * Authentication MUST happen first. With run_worker_first enabled, static assets
 * must be explicitly fetched from the ASSETS binding after successful auth.
 */
function isStaticAssetPath(pathname) {
  return pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/assets/") ||
    /^\/(?:favicon\.(?:ico|svg|png)|manifest\.webmanifest|robots\.txt|sitemap\.xml)$/.test(pathname);
}

/** Authentication and routing of every staging request. */
export async function serveStagingRequest(request, env, applicationFetch) {
  const denial = await stagingGate(request, env);
  if (denial) return denial;
  const safeRequest = forwardWithoutBasicHeader(request);
  const pathname = new URL(safeRequest.url).pathname;
  if ((safeRequest.method === "GET" || safeRequest.method === "HEAD") &&
      isStaticAssetPath(pathname)) {
    if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return response("Staging static asset binding is unavailable.", 503);
    }
    return env.ASSETS.fetch(safeRequest);
  }
  if (typeof applicationFetch !== "function")
    return response("Staging application is unavailable.", 503);
  return applicationFetch(safeRequest, env);
}
