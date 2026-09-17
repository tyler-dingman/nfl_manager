# Down & Distance global content scheduler

This Cloudflare Worker makes one authenticated request to the global content dispatcher. It does
not fetch publishers or generate content itself.

Required bindings:

- `DND_AUTOMATION_BASE_URL`: plain-text variable containing `https://www.downdistance.com`
- `DND_AUTOMATION_SECRET`: encrypted secret matching Vercel's `CONTENT_AUTOMATION_SECRET`

The configured schedule runs at 6 a.m., 8 a.m., 10 a.m., noon, 2 p.m., 4 p.m.,
6 p.m., and 8 p.m. **fixed CST (UTC-6)** daily. This is eight ingestion calls/day.
It does not shift with daylight saving time (during CDT these are 7 a.m.–9 p.m.
on a Chicago clock). Cloudflare evaluates the following cron in UTC:

```cron
0 0,2,12,14,16,18,20,22 * * *
```

Manage the trigger through `wrangler.toml` so the scheduled handler and trigger are deployed as
one version. The Vercel kill switch is `CONTENT_AUTOMATION_GLOBAL_ENABLED`. Set it to `false` to stop processing before database or source work. The application
defaults to enabled when the variable is absent.

Use this as the sole scheduled ingestion caller. GitHub ingestion is a manual backup.
The two-hour daytime interval and overnight pause give Neon time to scale to zero; it is not a guarantee
against compute usage from site traffic or other jobs. Deploy this change to update
the existing live trigger, and check the Cloudflare dashboard afterward.
