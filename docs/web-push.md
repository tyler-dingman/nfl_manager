# Browser push notifications

Browser push uses the existing `sendPush` delivery path, `user_devices`, encrypted
`user_push_tokens`, `user_notifications`, and `notification_deliveries`. Expo delivery
continues alongside Web Push. Notification preferences, including All updates / Recap,
are unchanged. The global push preference still suppresses delivery, including tests.

## Deploy and test

1. Install dependencies (`npm ci`).
2. Generate a VAPID pair once: `npx web-push generate-vapid-keys`.
3. Set `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and
   `WEB_PUSH_VAPID_SUBJECT` (a real `mailto:` contact or HTTPS contact URL) in the
   server environment. Keep the private key secret and retain the pair across deploys.
   The authenticated config endpoint exposes only the public key; no build-time key is needed.
4. Apply `db/migrations/046_web_push.sql` to the app database (or run
   `npm run auth:migrate` for the standard migration sequence). Existing auth/notification
   migrations, including 015 and 020, must already be applied. The normal
   `AUTH_JWT_SECRET` encrypts subscriptions at rest.
5. Deploy and open the site over HTTPS (localhost works for development).
6. Sign in, open **Profile → Notifications**, click **Enable Browser Notifications**,
   and allow the browser prompt. Click **Send Test Notification**.
7. Expect title **Down & Distance**, body **Push notifications are working. 🏈**.
   Click the notification to focus/open the website homepage. Repeat with the tab
   closed to exercise service-worker delivery. OS notification settings / Focus modes
   can prevent visible banners even after the push service accepts a message.

Tests are available on deployed sites, authenticated, limited to the current user's
selected browser subscription, and rate limited in Postgres to one attempt per 30 seconds.
Provider acceptance is recorded as SENT, not proof of display. Failures are recorded with
sanitized codes; HTTP 404/410 deletes the subscription, while transient failures retain it.
Disable/re-enable browser notifications to register again after expiration or VAPID rotation.

Multiple browsers/devices have separate subscriptions. An endpoint has one account owner;
registering it under a different account transfers ownership. Browser logout removes its
server subscription; returning to notification settings restores an existing granted
subscription for the signed-in account. Disabling removes the server subscription and
unsubscribes locally. Permission is never requested automatically or retried after denial.

The worker at `/push-sw.js` does not cache pages or API requests. Click destinations are
restricted to the website origin. Backend endpoints allow only known Chrome/Edge, Firefox,
Safari, and Windows push service hosts to prevent arbitrary server-side requests. New
browser push services may require extending that allowlist.

Protocol references: [Web Push library](https://github.com/web-push-libs/web-push),
[PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).
