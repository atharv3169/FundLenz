# FundLenz single administrator — implementation and owner setup

**STATUS: DRAFT BRANCH ONLY. STAGING D1 DATABASE AND BINDING CREATED AND OWNER-VERIFIED; LOGIN CREDENTIALS NOT CONFIGURED AND WORKER APPLICATION NOT DEPLOYED TO STAGING. NOT MERGED INTO `main`, NOT READY FOR PRODUCTION ADMINISTRATIVE USE.** This design never modifies financial data. It does **not** expose editing or GitHub write endpoints yet.

## Design

- One administrator username: `cookiemonster`. There is no public registration, account recovery endpoint, or default password.
- Admin login page: `/blogpost/admin`.
- APIs:
  - `POST /api/blog/admin/login`
  - `POST /api/blog/admin/logout`
  - `GET /api/blog/admin/session`
- Password: minimum **12 characters** (use a unique, unpredictable password; randomly generated is preferable). Salted PBKDF2-SHA256, **600,000 iterations**, 24-byte random salt, derived 32-byte verifier. We use `crypto.subtle` on the Worker; the offline generator uses Node `crypto.pbkdf2Sync` with matching parameters.
- **Do not send the password, password verifier or session secret to ChatGPT.** The earlier password in prompts must not be reused.
- Sessions: 32-byte unpredictable tokens, sent only as `__Host-fundlenz_admin` Secure, HttpOnly, SameSite=Strict, Path=/ cookies. Only the HMAC-SHA256 of a token is stored in D1. Expiry is eight hours; server-side logout revokes the token immediately.
- Rate limiting: D1-backed, per hashed client IP, at most **8 attempts per 15-minute bucket**. This is a durable protection, but additional Cloudflare WAF and Turnstile login controls should be configured before public activation.
- Fourth failed login in a bucket writes a private `pending` security-notification event to D1. **Delivery has not been implemented.** Do not say alerts are being emailed until a dedicated notification service is connected.
- State is private to a new D1 database. This is separate from the Google Drive contributor system and the Gemini data workflows.
- Fail closed: missing DB binding, password verifier, session secret, allowed hostname, or trusted Cloudflare IP means login unavailable (503). No fallback credentials.
- Cross-site protection: unsafe admin operations require an exact HTTPS `Origin` matching the request host and an admin allowlist. Hostnames must be explicitly added for staging.
- The admin session endpoint is no-store and does not return sensitive content.
- **Every future admin content write endpoint must call `isAuthenticatedAdmin(request)` AND `requireAdminOrigin(request, hosts)` server-side.** A visible admin UI is never permission to write content.

## Owner setup — complete later, after staging has been isolated and tests pass

1. **Preferred, no-command-line option:** download `tools/offline-blog-admin-setup.html` from this reviewed repository onto your own computer, then open the downloaded file locally in a current Chrome or Edge browser. The file has no external assets or network requests and includes a restrictive Content Security Policy. Enter your NEW 12–256 character password privately, confirm it, and click **Generate private credentials**. Copy `FUNDLENZ_ADMIN_PASSWORD_HASH` and `FUNDLENZ_ADMIN_SESSION_SECRET` directly to your password manager or Cloudflare encrypted Worker secrets. Do not paste them into chat, a bug report or GitHub. If secure cryptography is unavailable in file mode, use the offline terminal alternative below.\n\n   **Optional terminal alternative:** with Node.js 22+ and a local copy of this repository, run `node scripts/generate-blog-admin-secrets.mjs`. Its password prompt does not echo typed characters and does not send credentials to the network.
2. **DONE (owner-verified):** Created separate staging D1 database `fundlenz-blog-admin-staging`, bound as `BLOG_ADMIN_DB` to the independent `fundlenz-blog-staging` Worker. The database ID and binding have been added only to `wrangler.blog-staging.jsonc`, not the production Wrangler config.
3. **DONE (owner-verified):** Executed `db/blog-admin/0001_auth.sql` in Cloudflare's D1 SQL Console and confirmed the expected three admin tables using `/tables`.
4. In the **staging** Worker, add:
    - `FUNDLENZ_ADMIN_PASSWORD_HASH` (Secret, generated verifier)
    - `FUNDLENZ_ADMIN_SESSION_SECRET` (Secret, generated random value)
    - `BLOG_ADMIN_ALLOWED_HOSTNAMES` (Text, comma-separated exact HTTPS hostnames without scheme/path)
    - the `BLOG_ADMIN_DB` binding (D1)
5. After staging tests and approval, configure **production** with the appropriate D1 binding and secrets. Treat production and staging as separate D1 databases and secrets where possible.

**Important:** `wrangler.jsonc` has not been modified to refer to a fabricated D1 database ID. The backend intentionally remains inoperative until the owner creates the database and sets the binding. Existing Google OAuth and Turnstile secrets should not be touched.

The generator does not place secrets in repository files. A salt-specific verifier can be replaced through Cloudflare Secrets to change the password; changing `FUNDLENZ_ADMIN_SESSION_SECRET` invalidates existing browser cookies, and the D1 session rows should also be revoked/expired at rotation.

## Security gap / future work

- The staging D1 database and binding exist, and migration tables were manually verified. **Still required:** Deploy staging application, configure admin secrets privately, and perform real integration tests against the existing D1 binding.
- Wire a secure email delivery service (or owner-approved notification) for pending `blog_admin_security_events`, with deduplication and reliable delivery.
- Add login Turnstile and Cloudflare WAF protections (protect login even against distributed guessing).
- Periodic cleanup of expired sessions/old rate-limit buckets.
- Connect protected article and homepage publishing endpoints to approved GitHub paths. Do not expose a public editor or a placeholder Save operation.
- Verify Cloudflare Worker secret propagation in the build/deployment workflow.
- The default blog preview is a **Version URL** that may inherit production resources. Before login experiments, configure a truly isolated Worker/staging environment and confirm no real secrets are unintentionally exposed.
- Validate login/logout/session cookies and session revocation in a real browser on isolated staging; automated unit tests are not proof of production authentication.

No paid plans should be activated without owner approval.

## Temporary staging-only login troubleshooting

Owner confirmed that the staging gate and /blogpost/admin page load and that both admin secrets are stored as encrypted Worker variables, but the first POST login showed "Administrator login is currently unavailable." The GET session request can succeed even if the D1 write path or trusted Cloudflare client-IP header is unavailable. A missing client IP is a fail-closed error; do not bypass D1 rate limiting.

In `app/api/blog/admin/login/route.ts`, only on exact staging hostname, generic 503s now include a **safe, coarse reference code** and `console.error` writes only that code to Cloudflare logs. Neither code nor log contains user input, secrets, IP addresses, passwords, SQL, session tokens or cryptographic values:

- `FL-AIP` — Cloudflare's trusted client IP header is missing. Investigate whether the staging access wrapper forwards the original trusted metadata without spoofing; do not fall back to arbitrary client-supplied IP headers.
- `FL-CFG` — Required admin runtime configuration missing. Check staging bindings and encrypted keys.
- `FL-VER` — Unexpected error during D1 login-attempt reservation or password verification. Examine Cloudflare D1 errors safely through the dashboard; the visitor should see no internals.
- `FL-SES` — Error during D1 session creation after the password is accepted. Check D1 SQL schema and permissions.
- `FL-REQ` — Unexpected request read/parse error (normally returned as HTTP 400 when expected).

Only staging gets the diagnostic text. Production errors remain generic. After the new staging Worker deployment, perform one login attempt and note only the reference code; do not share the password, Network Authorization header or secret values.

## Worker PBKDF2 platform cap (FL-KDF) — compatibility trial

The owner successfully configured encrypted secrets and passed the staging Basic gate. The stage-specific login code `FL-KDF` identified a password-derivation exception even though the generated verifier uses the documented scheme `pbkdf2_sha256$600000$...`. Cloudflare Workers Web Crypto `subtle.deriveBits` enforces a hard ceiling of 100,000 PBKDF2 iterations on deployed Workers (independently documented at https://github.com/cloudflare/workerd/issues/1346), while locally executed Node and browser Web Crypto accept 600,000. This was missed by non-production tests.

**Preserve existing secrets if possible:** `verifyPassword` now attempts `node:crypto.pbkdf2Sync` for the exact same 600,000-round, SHA-256, salted format and uses the existing constant-time comparison. Browser/offline generator and session secret are unchanged. The Worker already has `nodejs_compat`. **This is a compatibility experiment, not yet verified on the deployed Cloudflare free-plan Worker.** The native Node-compatible API may itself have limits or exhaust available Worker CPU; neither lowering the iteration count inside the verifier nor accepting partial hashing is safe. Do not assert login works until the owner's successful real-browser login and logout.

If `FL-KDF` persists after the new staging deploy, investigate actual Cloudflare runtime error *without logging credentials*; instead use a new offline generator with `pbkdf2_sha256$100000$` or a suitable supported KDF, then rotate **only** `FUNDLENZ_ADMIN_PASSWORD_HASH`. This may require user approval; do not touch `FUNDLENZ_ADMIN_SESSION_SECRET`, `FUNDLENZ_STAGING_GATE_PASSWORD`, or the production Worker. Keep PR draft. 
