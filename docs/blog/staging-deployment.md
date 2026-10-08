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

`vite.config.ts`, `package.json`, and `wrangler.jsonc` are **immutable release-controlled sources and are NOT changed**. The staging build runs the normal Vinext build and then rewrites only the GENERATED (ignored) `dist/server/wrangler.json` to use the staging Worker name, D1 binding and `keep_vars` settings from `wrangler.blog-staging.jsonc`. It fails closed if the generated config is unexpected. The normal build continues using `wrangler.jsonc`. **Neither build uploads or deploys a Worker.**

The guarded commands are:

- `node scripts/verify-blog-staging-config.mjs` — inspect source configuration only.
- `node scripts/build-blog-staging.mjs` — build staging output with the isolated Worker config.
- `node scripts/verify-blog-staging-config.mjs --built` — inspect generated output; abort if it names the live Worker or a wrong database.
- `node scripts/deploy-blog-staging.mjs` — explicit deploy, additionally requires `FUNDLENZ_ALLOW_STAGING_DEPLOY=yes`. Do not run until owner approval and appropriate Cloudflare token permissions.

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

Owner connected existing `fundlenz-blog-staging` Worker to `atharv3169/FundLenz`, choosing production branch `feature/drive-private-submissions-20261008`, build command `node scripts/build-blog-staging.mjs`, and guarded deploy command `FUNDLENZ_ALLOW_STAGING_DEPLOY=yes node scripts/deploy-blog-staging.mjs`.

Cloudflare UI displays an orange warning suggesting changing **`wrangler.jsonc`** to name `fundlenz-blog-staging`. **Do NOT apply or merge this suggestion.** The normal `wrangler.jsonc` must remain named `fundlenz` for the original portfolio lab. The staging builder reads **`wrangler.blog-staging.jsonc`** and applies staging-only changes to the generated `dist/server/wrangler.json`, not the reviewed source files. Check for any Cloudflare-generated PR and decline unwanted changes to the live Worker configuration. An ordinary commit to this existing branch should trigger the first Cloudflare staging build; verify it targets the independent staging Worker and retains its D1 binding before adding credentials.

**Cloudflare UI build command correction (required):** The original connected build settings used `pnpm run build:blog-staging` and `FUNDLENZ_ALLOW_STAGING_DEPLOY=yes pnpm run deploy:blog-staging`. They must now be changed in the **staging Worker's Settings → Builds** to `node scripts/build-blog-staging.mjs` and `FUNDLENZ_ALLOW_STAGING_DEPLOY=yes node scripts/deploy-blog-staging.mjs`. This is necessary because the existing financial-release integrity gate rejects modifying `package.json` and `vite.config.ts`; both were restored byte-for-byte to `main`. Ignore any earlier failed builds triggered before these corrections.

## First staging deployment checkpoint

8 October 2026: Owner confirmed saving the staging Worker's Git build command (`node scripts/build-blog-staging.mjs`) and guarded deploy command (`FUNDLENZ_ALLOW_STAGING_DEPLOY=yes node scripts/deploy-blog-staging.mjs`) in Cloudflare. This documentation-only commit is intended to trigger the first staging build. **Deployment success and resource isolation must still be verified in Cloudflare; a GitHub commit does not prove either.** Do not add administrator secrets, publish visitor forms, or merge PR #4 until those checks complete. Existing financial-data release controls remain unchanged.

## Free staging-only access gate (Zero Trust billing avoided)

Owner declined Cloudflare Zero Trust enrollment because its checkout requested payment authorization for potential future charges. Use a **staging-only HTTP Basic gate** that requires no external subscription or additional SaaS.

Implementation:
- `scripts/blog-staging-gate-core.mjs` verifies a private, long, randomly generated password against the `Authorization: Basic` header, accepting username `fundlenz-staging`. Requests without valid credentials receive an HTTP 401 browser challenge.
- Password stored as `FUNDLENZ_STAGING_GATE_PASSWORD` **encrypted Cloudflare Worker Secret** on **`fundlenz-blog-staging` ONLY**; at least 24 ASCII characters, max 256, and unrelated to the eventual editor/admin password. Never commit it, paste it in chat, or put it in `wrangler.blog-staging.jsonc`. A password manager's random generator is recommended.
- If secret missing/invalid, **all staging requests return HTTP 503 (fail closed)**. This is expected until owner adds the secret. The original `fundlenz` Worker never imports this gate.
- `scripts/build-blog-staging.mjs` builds the original reviewed source unchanged, copies the gate into **generated output only**, wraps the generated Worker fetch entrypoint, and sets `assets.run_worker_first: true`. Cloudflare documents that static assets bypass the Worker by default; without this setting they would be publicly fetchable. See https://developers.cloudflare.com/workers/static-assets/routing/worker-script/.
- `scripts/deploy-blog-staging.mjs` refuses deployment if generated entrypoint and static asset gating are absent. The CI suite validates both the gate behavior and final generated Wrangler config.
- The wrapper removes the Basic Authorization header before forwarding requests to Vinext. It adds no-index and no-store response headers on staging.
- If the admin page is subsequently enabled, the staging Basic password is **additional** to the editor's independent server-backed password and session checks. It does not grant GitHub publishing privileges.
- This is a **development convenience, not enterprise identity management**: everyone knowing this staging password can browse the staging site; browser HTTP Basic credentials can be cached until the browser closes, there is no per-user revocation, and password rotation is manual. No brute-force lockout is implemented for the staging gate. The separate admin login keeps its rate limiting and D1 sessions. Do not expose real subscriber/contributor data or copy production Google credentials to staging merely because the staging gate exists.

**Owner next steps after GitHub checks pass and staging deploys:**
1. Cloudflare → Workers & Pages → **fundlenz-blog-staging** → Settings → Variables and Secrets → Add variable. Name `FUNDLENZ_STAGING_GATE_PASSWORD`, select **Secret**, select staging Worker's **Production** environment, and enter your own 32+ character random printable-ASCII password (do not share with chat).
2. Save / Deploy changes. Check that the staging URL prompts for Basic credentials; username: `fundlenz-staging`, password: privately generated value.
3. After entering Basic credentials, verify `/blogpost` and `/blogpost/admin` load; the admin page should still say login isn't configured.
4. Separately, configure private `FUNDLENZ_ADMIN_PASSWORD_HASH` and `FUNDLENZ_ADMIN_SESSION_SECRET` with the offline setup utility. Test authentication with D1 staging DB. Keep PR in draft until further development and validation.

The live `fundlenz.com` website and original Worker must remain unrestricted and unchanged.
