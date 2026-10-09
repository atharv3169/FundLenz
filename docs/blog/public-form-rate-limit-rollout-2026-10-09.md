# Public form rate limiting — Workers preview launch gate (9 October 2026)

## Purpose

Protect the two anonymous public submission endpoints against excessive
requests BEFORE multipart parsing, Turnstile verification, and private Drive
writes. Keep `fundlenz.com` on ChatGPT Sites until owner approves cutover.
No Cloudflare Access / Zero Trust, billing authorization, new D1 tables,
website DNS or additional paid service is used.

## Implementation

This app uses Cloudflare Workers' own **Rate Limiting binding** (Wrangler >= 4.36),
not a zone-based WAF rule that may not apply to the Workers preview.

| Route | Binding | Threshold | Window |
| --- | --- | ---: | ---: |
| `POST /api/blog/subscribe` | `BLOG_NEWSLETTER_RATE_LIMIT` | 12 attempts per client IP | 60 seconds |
| `POST /api/blog/contribute` | `BLOG_CONTRIBUTION_RATE_LIMIT` | 4 attempts per client IP | 60 seconds |

- Requests must have an approved HTTPS browser origin; then the rate limiter
  is checked before reading any request body or using Turnstile/Drive.
- Use only Cloudflare's `CF-Connecting-IP`, SHA-256-hashed into a stable key.
  Never trust `X-Forwarded-For`, email addresses or arbitrary user parameters.
  Raw IP addresses, emails, CAPTCHA tokens and Drive details are not written to
  the limiter or logs by this feature.
- Missing binding / missing Cloudflare IP / binding errors => sanitized HTTP
  `503` (fail closed). Exceeded threshold => sanitized `429` with
  `Retry-After: 60`, no-cache response.
- Existing Turnstile action, hostname validation, consent, content restrictions,
  5 MB document cap and Google OAuth storage remain separate safeguards.
- **Limits are approximate per Cloudflare location, eventually consistent**,
  not an exact global throttle, distributed-bot defense or quota accounting.
  Shared NAT/mobile networks may cause legitimate visitors to encounter 429s.

## Production and staging isolation

The two production nonsecret `ratelimits` bindings are declared in the
reviewed `wrangler.jsonc` (namespaces `202610091` and `202610092`).
Staging uses the same thresholds but different counter namespaces
(`202610093`, `202610094`). The stage build script rewrites the **generated**
configuration to stage resources only; no production counter sharing.

The generated production Worker MUST retain the exact bindings; CI's build
guard will reject missing/changed bindings. `keep_vars: true` continues to
preserve privately configured Cloudflare secrets, including Google OAuth and
Turnstile. Never paste secrets into GitHub or change the D1 bindings.

## Verification and rollback

1. Review and run forms security regressions, TypeScript, finance release
   integrity, production & protected staging Worker builds.
2. Check merged commit's Cloudflare Production build succeeds.
3. Open blog and contribution dialogs on the Worker hostname. Confirm Turnstile
   loads and no 503 appears on a valid form submission; an operator can do a
   harmless **single** opt-in test if needed. Do not spam live endpoints to
   force a 429; mocks cover threshold behavior.
4. Check Cloudflare Worker logs for 429 spikes while avoiding visitor data.
5. If valid forms return 503, confirm generated Worker `ratelimits` bindings
   were deployed. Avoid disabling the limiter silently. Revert only the
   affected reviewed deployment to the last known good release, coordinating
   owner acceptance.
6. After the deliberate custom-domain cutover, the same Worker binding applies
   automatically on both hostnames, subject to identical Cloudflare limits.

Official API behavior: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
