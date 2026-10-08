# FundLenz blog visitor forms — staging implementation

**Status: DRAFT PR #4, NOT MERGED OR DEPLOYED.** The owner has configured Google OAuth + Turnstile production credentials in the Cloudflare dashboard, but no live Google Drive upload has been validated. Do not expose these forms publicly until staging verification is complete.

## Architecture and access

The public GitHub repository stores only application source and eventual public articles. **No visitor PII enters GitHub.** Server-side endpoints use an OAuth refresh token with `https://www.googleapis.com/auth/drive.file` to write directly to the owner's Google Drive. Gemini financial-data credentials and workflows remain independent.

The first successful write creates:

```text
FundLenz Private/
  NEWSLETTERS/
    <sha256-normalized-email>.json
  Contributions/
    <YYYY-MM-DD>_<sanitized-name>_<uuid>/
      details.json
      document.pdf | document.doc | document.docx
```

Newsletter records contain email, timestamp and `mailingEnabled: false`. **There is no newsletter sending.** Contribution metadata contains name, email, optional title/social URL and submission timestamp. Contributor manuscripts do not publish automatically.

## Credentials already configured by owner — not inspected

The owner reports having set the following in **Cloudflare Production**:

- `GOOGLE_OAUTH_CLIENT_ID` — Secret
- `GOOGLE_OAUTH_CLIENT_SECRET` — Secret
- `GOOGLE_OAUTH_REFRESH_TOKEN` — Secret
- `TURNSTILE_SECRET_KEY` — Secret
- `FORMS_ALLOWED_HOSTNAMES` — Variable, currently `fundlenz.com`

Do not ask the owner to paste secrets into chat or GitHub. These values may require deployment-specific secret/variable synchronization when updating the Worker. Do not put secret values in Wrangler JSON.

**Still required:** `TURNSTILE_SITE_KEY` as a **nonsecret server-side Cloudflare runtime variable** containing the matching widget's public site key. The blog page reads that value server-side and passes only the public site key into the form components.

Turnstile widget **FundLenz Blog Forms** has been created with Managed mode and no pre-clearance. The actual widget hostname must be checked. For a Cloudflare workers.dev staging hostname, register that exact hostname in Turnstile or create a separate staging widget and credentials. Extend `FORMS_ALLOWED_HOSTNAMES` to include only verified, expected staging hostname(s). Production credential setup is not evidence that the endpoint works.

The Google OAuth application was reportedly published to Production, the Drive API enabled, and the `drive.file` scope and redirect URI configured. Refresh token was saved privately. Confirm that the token actually renews when testing.

## Public UX on draft branch

- `/blogpost` contains a **temporary empty article listing** and the initial visitor forms. The complete article publishing/admin system is a separate unfinished phase.
- Newsletter component displays purpose, email field, required privacy consent, and Managed Turnstile action `blog_subscribe`.
- Article contribution modal displays required name, email, DOC/DOCX/PDF up to 5 MiB, optional social and title, required privacy consent, and Turnstile action `blog_contribute`.
- Forms submit directly to their server-side endpoints and only show success after HTTP success.
- Public contribution fallback email: `atharva@fundlenz.com`.
- Mobile layouts are present but **not browser-tested**.

The original legal pages `/privacy` and `/terms` were merged to main in PR #5 and the owner reports Work separately published them to the live custom-domain Site. They must be verified as public before collecting user data.

## API contract

`POST /api/blog/subscribe` — JSON:

```json
{"email":"person@example.com","consent":true,"turnstileToken":"TURNSTILE_TOKEN"}
```

`POST /api/blog/contribute` — multipart fields:
`name`, `email`, `document` (required); `title`, `social` (optional);
`consent=true`, `turnstileToken` (required).

Both routes require an allowed HTTPS `Origin` and server-validated Turnstile with exact expected hostname and action. Body limits are enforced before multipart parsing. Successful writes return a JSON status. Server errors do not echo credentials or submissions.

## Security and operational caveats before production

1. **Rate limiting / WAF is not set up.** Configure Cloudflare rate limits for the two API routes. Turnstile alone is not sufficient.
2. **File signature checks are not antivirus scanning.** Quarantine or scan contributed files and avoid auto-opening/untrusted document execution.
3. **No submission notifications yet.** The user wants a message containing contributor name; choose an owner-approved independent notification service.
4. **No durable queue / partial-upload cleanup yet.** A Google API failure between metadata and file upload can leave a partial submission directory. User-facing success is returned only after both writes succeed.
5. **Deduplication is best effort.** Listing and creating a hashed newsletter record is not an atomic uniqueness operation, and parallel submissions may race.
6. **No Drive quota monitoring or 90% fallback yet.** A `drive.file` token may not have sufficient permissions to obtain full storage usage. Do not invent an available quota.
7. **No independently verified 5 MiB end-to-end upload yet.** Confirm Cloudflare Worker request limits and multipart behavior with staging data.
8. **Unpublished/archived article administration is not implemented.** The landing page is an intentionally incomplete draft.
9. **GitHub financial-data/portfolio regression tests still required before merge.** Do not change Gemini permissions or financial catalogues.

## Verification

The isolated pull request workflow `.github/workflows/blog-private-forms-check.yml` runs:
- `node scripts/verify-blog-forms.mjs` for email/origin/body-limit/Turnstile/error-privacy unit checks.
- `pnpm run typecheck`.
- `pnpm run build`.

These are **not** live OAuth, Drive, Turnstile or security penetration tests. After CI passes, use an owner-approved staging Worker with a matching Turnstile widget and safely scoped secrets, run a controlled real submission, verify Drive files and clean up test data. Keep the original portfolio lab stable and do not merge/deploy without review.

References: https://developers.google.com/workspace/drive/api/guides/create-file and https://developers.cloudflare.com/workers/configuration/secrets/
