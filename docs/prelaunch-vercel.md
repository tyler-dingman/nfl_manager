# Private prelaunch deployment

The repository uses standard Next.js 14 commands (`npm run build`, then `npm start`) and contains no `vercel.json` or committed `.vercel` project metadata. It has a GitHub `origin`; reconnect the existing Vercel project rather than creating another one. Vercel's local `.vercel` link metadata is intentionally not committed.

## Environment scopes

Set these for both **Production** and **Preview** while both deployments must remain private:

- `PRELAUNCH_MODE=true`
- `PRELAUNCH_PASSWORD=<strong private password>`
- `PRELAUNCH_SESSION_SECRET=<independent random secret, at least 32 bytes>`
- `DATABASE_URL=<hosted PostgreSQL URL>`
- `AUTH_JWT_SECRET=<random secret, at least 32 characters>`
- `AUTH_BASE_URL=https://downdistance.com` in Production; use the intended stable Preview URL only if testing social login there
- `ADMIN_USER_IDS=<comma-separated internal IDs>`
- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Add enabled social-login, notification, content, and YouTube provider variables from `.env.example`. Keep `OBSERVER_MODE=true` for private observation unless real push delivery is intentionally being tested. Self-hosted localhost services such as Ollama, Chatterbox, Whisper, and the embedding service are not reachable from Vercel; give them deployed authenticated URLs or disable the associated features.

For **Development**, keep `PRELAUNCH_MODE=false` unless testing the gate locally. Never commit `.env.local`.

## Deploy and connect the domain

1. In the existing Vercel project, confirm the GitHub repository is `tyler-dingman/nfl_manager` and the framework preset is Next.js.
2. Keep the default install/build behavior: `npm install` and `npm run build`. No custom output directory is required.
3. Add the scoped environment variables above.
4. Apply database migrations with `npm run auth:migrate` against the hosted database before testing commerce. This repository does not run migrations automatically during build.
5. Deploy and verify the generated Vercel URL shows only the private-preview screen in a fresh browser.
6. Add `downdistance.com` in Vercel Project Settings → Domains and make the DNS changes Vercel displays. DNS is not managed by this repository.
7. Update `AUTH_BASE_URL` and every enabled OAuth provider callback to the final HTTPS domain.
8. In Stripe **Test mode**, create `Down & Distance Commerce Test` at `https://downdistance.com/api/commerce/stripe/webhook`, selecting only `payment_intent.succeeded`, `payment_intent.payment_failed`, and `payment_intent.canceled`. Save the resulting signing secret as `STRIPE_WEBHOOK_SECRET`, then redeploy.

## Privacy verification

- In a fresh/incognito session, `/`, `/the-beat`, `/merch`, and `/admin/commerce` redirect to `/preview` without returning application HTML.
- A random API such as `/api/commerce/catalog` returns `401`, while an unsigned POST to `/api/commerce/stripe/webhook` reaches Stripe verification and returns `400` rather than redirecting.
- `/robots.txt` contains `Disallow: /`.
- Preview and authorized HTML responses contain `X-Robots-Tag: noindex, nofollow, noarchive`; rendered HTML contains equivalent robots and Googlebot meta tags.
- A correct password creates the signed `dnd_preview_access` HttpOnly, Secure, SameSite=Lax cookie. `/preview/logout` clears it.
- Existing admin authentication is still required after preview access is granted.

## Soft-launch reversal

Set `PRELAUNCH_MODE=false` and redeploy. The password gate and noindex headers/meta are removed, and `robots.txt` changes to allow crawling. Keep Stripe in test mode until a separately approved live-payment launch.

There is no Printful webhook route in the repository, so no Printful exemption was added. Vercel Hobby also cannot host the repository's continuously running source watcher; schedule-compatible ingestion or an external worker is required for near-real-time monitoring.
