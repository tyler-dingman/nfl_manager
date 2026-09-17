# Down & Distance global content scheduler

This Cloudflare Worker makes one authenticated request to the global content dispatcher. It does
not fetch publishers or generate content itself.

Required bindings:

- `DND_AUTOMATION_BASE_URL`: plain-text variable containing `https://www.downdistance.com`
- `DND_AUTOMATION_SECRET`: encrypted secret matching Vercel's `CONTENT_AUTOMATION_SECRET`

The Worker is deployed with this cron trigger:

```cron
*/30 * * * *
```

Manage the trigger through `wrangler.toml` so the scheduled handler and trigger are deployed as
one version. The Vercel kill switch is `CONTENT_AUTOMATION_GLOBAL_ENABLED`. It must equal `true` before any
database or source work occurs. Removing it or setting it to any other value stops processing while
leaving the Worker healthy.

Use this as the sole scheduled ingestion caller. GitHub ingestion is a manual backup.
The 30-minute interval gives Neon time to scale to zero; it is not a guarantee
against compute usage from site traffic or other jobs. Deploy this change to update
the existing live trigger, and check the Cloudflare dashboard afterward.
