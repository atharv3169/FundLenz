# FundLenz private visitor form storage

STATUS: Development branch only. Not yet connected to Google, integrated into blog pages or deployed. No changes to the portfolio lab, financial data or Gemini permissions.

## Storage architecture

The public FundLenz GitHub repository keeps only website source code and published blog articles. Visitor data is written DIRECTLY to the owner's Google Drive by server-side form endpoints, not committed to GitHub.

On first successful request the Drive API automatically creates these private folders owned by the consenting Google user:

FundLenz Private/
  NEWSLETTERS/
    <email-sha256>.json
  Contributions/
    <YYYY-MM-DD>_<contributor-name>_<UUID>/
      details.json
      uploaded-manuscript.pdf (or .doc/.docx)

Each subscriber file records the email, timestamp and a flag that mailing is disabled. Newsletter delivery is not implemented. Each contribution contains the name, email, title, social URL, timestamp and document (maximum 5 MiB). Drive folder access stays private and Gemini must not receive these credentials.

Subscriber duplicate prevention is best effort; Google Drive listing is not an atomic uniqueness transaction. The server fails closed when required credentials or Turnstile are missing, or Google Drive rejects the write. There is no Google-to-GitHub or GitHub-to-Drive transfer step.

## Required Google account setup (OWNER ACTION)

1. In Google Cloud Console, enable Google Drive API for a Google Cloud project.
2. Configure Google OAuth consent and the least-privileged Drive scope https://www.googleapis.com/auth/drive.file. Grant permission only to the owner account.
3. Complete an offline OAuth consent flow for the owner's account and obtain an OAuth refresh token using the same scope. An external OAuth app left in testing mode may issue refresh tokens with a seven-day lifespan; configure production mode for long-running use, subject to Google's rules.
4. Create Cloudflare Turnstile widgets for forms, allow the website hostname and staging hostname.
5. Store the following server-side values in Cloudflare encrypted Worker secrets, never in GitHub or chat:

    GOOGLE_OAUTH_CLIENT_ID
    GOOGLE_OAUTH_CLIENT_SECRET
    GOOGLE_OAUTH_REFRESH_TOKEN
    TURNSTILE_SECRET_KEY
    FORMS_ALLOWED_HOSTNAMES

The last value is a comma-separated list of exact Turnstile hostnames, e.g. fundlenz.com,www.fundlenz.com,plus-your-actual-staging-hostname.

The public Turnstile site key must be rendered by the future blog frontend. ChatGPT's Google Drive connector DOES NOT provide credentials to FundLenz's Cloudflare Worker. Website OAuth authorization must be configured independently.

## Backend API (ready for frontend wiring)

POST /api/blog/subscribe
Content-Type: application/json
Fields: email (required), consent (boolean true, required), turnstileToken (required).
Example: {"email":"person@example.com","consent":true,"turnstileToken":"TOKEN"}

POST /api/blog/contribute
Content-Type: multipart/form-data
Fields: name (required, max 120 chars), email (required), document (required, PDF/DOC/DOCX, max 5 MiB), title (optional, max 240 chars), social (optional, max 500 chars), turnstileToken (required).

Successful requests return JSON with ok=true after Google Drive confirms the upload. Failed writes return HTTP errors; the frontend must NOT show a false success message.

## Work needed before production

- Build blog UI and connect both forms, including visitor privacy notice/explicit consent and Turnstile.
- Configure WAF rate limits. Magic-byte checking does NOT replace virus scanning or attachment quarantine; never automatically publish user uploads.
- Test OAuth expiry/revocation, Google Drive quota issues, duplicate submissions, Turnstile challenge, 5 MiB limit, and partial upload failures.
- Add a reliable notification service if owner wants an alert containing the submitter's name. Notification is NOT implemented in this draft.
- For frequent submissions, add a durable retry queue. The current endpoints acknowledge only completed Drive writes, and partial files may remain if a later step fails.
- Validate with actual Google credentials against staging, then run all existing catalogue/Gemini/portfolio regression checks before merging. Nothing should affect production until reviewed and deployed.

Reference docs: https://developers.google.com/workspace/drive/api/guides/create-file ; https://developers.google.com/workspace/drive/api/guides/manage-uploads ; https://developers.cloudflare.com/workers/configuration/secrets/
