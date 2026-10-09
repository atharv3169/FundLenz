# Production blog editor access: dark launch and validation

## Verified owner setup (9 October 2026)

Screenshot shows `fundlenz` → Settings → **Production** runtime:
- `BLOG_ADMIN_ALLOWED_HOSTNAMES` (Text): `fundlenz.atharvsahu711.workers.dev`.
- `FUNDLENZ_ADMIN_PASSWORD_HASH` and `FUNDLENZ_ADMIN_SESSION_SECRET`: present as **encrypted Cloudflare secrets**. Their values were neither requested nor inspected.
- Existing Google OAuth and Turnstile Worker secrets remain present by name.
- `BLOG_ADMIN_DB`: separate Cloudflare D1 `fundlenz-blog-admin-production` with five schema tables independently verified in the owner's D1 Console.
- `wrangler.jsonc` uses `keep_vars: true`. Cloudflare suggests copying nonsecret runtime variable settings into Wrangler, but that is **not** done here: exact operator-provided hostname stays in Cloudflare, while source config declares D1 only.

This is not evidence that login/session creation or editor writes work on deployed Workers. Do not claim they work until real tests.

## Code safeguards

- An exact reviewed-host policy permits **only** `fundlenz-blog-staging.atharvsahu711.workers.dev`, `fundlenz.atharvsahu711.workers.dev`, or eventual `fundlenz.com` (no wildcards or spoofed subdomains). Login, logout, sessions and all D1 draft APIs share the policy.
- The staging Worker remains independently password-gated and bound to **staging D1**, untouched. Production uses **production D1**.
- Both production and future domain require **two independent conditions**: exact host in `BLOG_ADMIN_ALLOWED_HOSTNAMES`, plus Cloudflare Text variable `BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED=true`. Without both, production admin sessions return a safe unavailable response and no draft API is enabled.
- This feature flag is **deliberately not configured by this PR**. Encrypted credentials alone do not turn on the editor; the production Worker remains dark.
- Admin writes require an authenticated, unexpired D1 session and strict HTTPS `Origin` equality. Browser cookies remain `__Host-`, HttpOnly, Secure and SameSite=Strict.
- Production homepage remains **static reviewed public copy**, even when an owner saves a D1 homepage draft. Saving drafts does **not** publish anything, and the public article catalogue remains separate and empty until an explicit publishing system is reviewed.
- No data is copied between the two D1 databases, and no custom domain or DNS changes are made.

## Security requirement before activating on production (NO Cloudflare Zero Trust)

The project handoff `Pasted text(7)(1).txt` explicitly states that Cloudflare Zero Trust Free requested payment authorization; the owner declined and does **not** authorize any paid or card-required access service. Do **not** request Cloudflare Access, Zero Trust setup, billing authorization, or a card as a dependency for launch.

The approved architecture uses **the existing single-administrator username/password login**. Keep the production administrator behind server-side controls already implemented and tested: exact HTTPS hostnames, matching same-origin checks on writes, owner-generated encrypted password verifier and session secret, hashed D1 session tokens, eight-hour expiry, server-side logout, D1-backed eight-attempt/15-minute-per-IP limit, no-default credentials, HttpOnly Secure SameSite=Strict cookies and the independent `BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED` activation flag.

The Worker-compatible PBKDF2-SHA256 100,000-iteration verifier is a known tradeoff; use a long, unique, randomly generated password stored in a password manager. D1 per-IP throttling alone does not eliminate distributed credential attacks. Optional **card-free** hardening can be considered separately, such as using the already configured Turnstile widget on the admin login form, improving alerts, or a path-scoped Worker-owned challenge. Any extra protection must be reviewed and tested and **must not** password-protect public article pages or the rest of the portfolio lab.

Before enabling production editing, test anonymous access to both `/blogpost/admin` and `/api/blog/admin/*`. A publicly accessible login page is acceptable, but anonymous users must never read, edit or publish private drafts, obtain an authenticated session or bypass origin checks. No new external billing dependencies are permitted.

## Operator acceptance sequence

1. Review this code in its draft PR; run all GitHub financial integrity, isolated blog/staging build and authentication/host-security tests.
2. Confirm the production Worker D1 binding remains `BLOG_ADMIN_DB → fundlenz-blog-admin-production`, and the three admin variable/secret names are still present after the code deployment.
3. Verify the existing single-admin login protections on the production Worker URL: anonymous session reports unauthenticated/unavailable as appropriate; anonymous draft API GET/POST/PUT/DELETE never disclose or write D1 data; invalid Origin is rejected; login rate limiting and D1 security events work. Run these tests in a separate browser profile, without exposing tokens or passwords.
4. Once the code and both automated and real-browser authorization tests pass, **the owner** can deliberately add the nonsecret **Text** variable `BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED` with the exact value `true` in Cloudflare Worker **fundlenz** and **Save and Deploy**. Do **not** add `fundlenz.com` to the allowed hostname variable yet; it is still served by ChatGPT Sites.
5. On the Cloudflare Worker preview URL, test in a browser: Access entry; correct owner login (never send password/verifier/cookies to chat); invalid password (401) and rate limit (429); session expiry; draft list; create/save/reload article; simultaneous-version 409; homepage draft save; logout and unauthorized reads; no production draft on public homepage.
6. Verify D1 table rows only on production DB; check no writes on staging. Verify Cloudflare production build and server logs *without inspecting or exposing secrets*.
7. Do not enable **Publish** UI or submit draft content to public pages until a separately reviewed explicit publish/unpublish flow, rollback, XSS sanitization and cache refresh have passed tests.
8. Custom domain `fundlenz.com` stays on ChatGPT Sites. Only after the owner explicitly approves DNS cutover should the routing and `BLOG_ADMIN_ALLOWED_HOSTNAMES` be changed to include the final host. Repeat Access/login/origin/logout tests on the final hostname.

## Rollback

- Immediate disable: remove `BLOG_ADMIN_EDITOR_PRODUCTION_ENABLED` or set it to `false` in Cloudflare Production and redeploy. This leaves blog drafts in the independent production D1; it does not delete them.
- Preserve the last-good Worker version and D1 backup/time-travel checkpoint. Worker rollbacks do not roll back D1 storage state.
- Do not use `fundlenz-blog-staging` secrets or D1 to rescue a failing production login.
- Do not switch `fundlenz.com` away from ChatGPT Sites until the whole site passes final smoke tests.

These are intentionally staged deployment gates, not a claim that production admin has been opened or that the public article-publishing feature is complete.
