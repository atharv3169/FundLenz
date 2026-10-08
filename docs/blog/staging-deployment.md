# FundLenz separate blog staging Worker

**Development branch only. No live release authorized.** The owner created the isolated Cloudflare Worker and D1 database through the dashboard on 8 Oct 2026. Cloudflare dashboard screenshot confirms the D1 binding:

| Resource | Actual configured value |
|---|---|
| Worker | `fundlenz-blog-staging` |
| Host | `fundlenz-blog-staging.atharvsahu711.workers.dev` |
| Binding | `BLOG_ADMIN_DB` |
| D1 database | `fundlenz-blog-admin-staging` |
| D1 database ID | `7849f805-0efa-49d3-b5bb-26c2527e4cfd` |

The three D1 admin tables were created through the Cloudflare SQL console and then verified using `/tables`. This database currently has no password verifier or session secret in Worker settings.

## Never deploy to the live Worker

The existing `wrangler.jsonc` targets **`fundlenz`**, which is the portfolio lab Worker.

The new `wrangler.blog-staging.jsonc` explicitly targets **`fundlenz-blog-staging`**, retains the D1 binding and allowed host, and has `keep_vars: true` so secrets entered in the staging dashboard survive code deploys.

`vite.config.ts` chooses staging config only when `FUNDLENZ_BUILD_TARGET=blog-staging`. The normal production build continues using `wrangler.jsonc`. **Neither build uploads or deploys a Worker.**

The guarded commands are:

- `pnpm run verify:blog-staging` — inspect source configuration only.
- `pnpm run build:blog-staging` — build staging output with the isolated Worker config.
- `node scripts/verify-blog-staging-config.mjs --built` — inspect generated output; abort if it names the live Worker or a wrong database.
- `pnpm run deploy:blog-staging` — explicit deploy, additionally requires `FUNDLENZ_ALLOW_STAGING_DEPLOY=yes`. Do not run until owner approval and appropriate Cloudflare token permissions.

**Do not run the existing `pnpm run deploy` or `pnpm run deploy:preview` to deploy staging.** Those refer to the live Worker.

The pull request workflow runs a regular production build, checks staging configuration, runs a staging build, then validates the generated deploy target. It has no deploy credentials.

## Next steps

1. Confirm GitHub CI completes both builds and verifies the generated target.
2. Decide how to deploy the staging Worker without touching the existing `fundlenz` build automation (a separate, explicit staging-only GitHub connection/deployment process or a reviewed manual Wrangler deployment).
3. If Cloudflare Access is available, protect the staging application before adding real admin secrets. No cross-origin privileged write endpoint may be used without the server-side login.
4. The owner must privately create a new password verifier and session signing secret using `tools/offline-blog-admin-setup.html`. Store them as **encrypted secrets only on `fundlenz-blog-staging`**:
   - `FUNDLENZ_ADMIN_PASSWORD_HASH`
   - `FUNDLENZ_ADMIN_SESSION_SECRET`
5. Allowed hostname `BLOG_ADMIN_ALLOWED_HOSTNAMES` is already included in the staging config as non-sensitive text; no production hostnames permitted here.
6. Add optional login Turnstile/WAF and test invalid/valid login, sessions, logout, timeouts, concurrent attempts and pending notification records. Implement notification delivery before representing that as operational.
7. For the separate Google Drive visitor form tests, use staging-only Turnstile hostname and matching site key and secret; don't copy production Google OAuth credentials without a deliberate security review. The public forms fail closed until configured.
8. Confirm the original portfolio lab Worker and `fundlenz.com` remain unchanged. Deploy to production only with owner approval.

Staging D1 database ID is an application resource identifier, not a secret. Passwords, tokens, session secrets, and Google Drive credentials must never enter this public repository.

## Connected Cloudflare staging repository (8 Oct 2026)

Owner connected existing `fundlenz-blog-staging` Worker to `atharv3169/FundLenz`, choosing production branch `feature/drive-private-submissions-20261008`, build command `pnpm run build:blog-staging`, and guarded deploy command `FUNDLENZ_ALLOW_STAGING_DEPLOY=yes pnpm run deploy:blog-staging`.

Cloudflare UI displays an orange warning suggesting changing **`wrangler.jsonc`** to name `fundlenz-blog-staging`. **Do NOT apply or merge this suggestion.** The normal `wrangler.jsonc` must remain named `fundlenz` for the original portfolio lab; the staging build selects **`wrangler.blog-staging.jsonc`** using `FUNDLENZ_BUILD_TARGET=blog-staging`. Check for any Cloudflare-generated PR and decline unwanted changes to the live Worker configuration. An ordinary commit to this existing branch should trigger the first Cloudflare staging build; verify it targets the independent staging Worker and retains its D1 binding before adding credentials.
