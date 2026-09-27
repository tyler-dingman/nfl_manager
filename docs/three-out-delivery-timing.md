# Three & Out delivery timing

The existing `THREE_AND_OUT_DAILY` preference's `IN_APP` (subscription master) row stores `delivery_time` as HH:mm and `delivery_timezone` as an IANA timezone. Channel preferences remain in their existing rows. PUT saves the channel and timing changes atomically; older clients that omit timing preserve saved values. Unsaved times resolve to 07:00. A saved Three & Out timezone takes priority over the profile timezone; the client uses its device timezone if neither is available.

Apply `047_three_out_delivery_timing.sql` before deploying this code. `npm run three-out:migrate` applies both the daily briefing and timing migrations. It has been applied locally; production is not modified by development work.

The GitHub delivery workflow polls every five minutes all day (Actions may run late). It generates a missing daily snapshot for due subscribers, then delivers eligible push notifications. Delivery uses timezone-local time, catches up later that day, and permits a 20-minute midnight grace period for late-night custom times. A nonexistent spring-forward time becomes due at the next valid clock time. The database claim is unique by user, local delivery date and channel, preventing fall-back repeats and repeated delivery after a same-day time change. Existing delivery records remain honored.

Email and SMS preferences/readiness are preserved. The existing daily worker currently implements **push only**; email/SMS transports remain unimplemented. Future channel dispatchers must use the same saved timing and local-day claim rather than introduce a separate schedule.

Checks: `node --import tsx --test src/features/three-and-out/daily.test.ts src/server/three-and-out/schema.test.ts` and `npx playwright test tests/mobile/notification-settings.spec.ts`.
