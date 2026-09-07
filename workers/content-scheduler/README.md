# Down & Distance global content scheduler

This Cloudflare Worker makes one authenticated request to the global content dispatcher. It does
not fetch publishers or generate content itself.

Required bindings:

- `DND_AUTOMATION_BASE_URL`: plain-text variable containing `https://www.downdistance.com`
- `DND_AUTOMATION_SECRET`: encrypted secret matching Vercel's `CONTENT_AUTOMATION_SECRET`

The Worker intentionally ships without a cron trigger. After the global endpoint is deployed,
enabled, migrated, and manually verified, add this trigger in Cloudflare:

```cron
*/5 * * * *
```

The Vercel kill switch is `CONTENT_AUTOMATION_GLOBAL_ENABLED`. It must equal `true` before any
database or source work occurs. Removing it or setting it to any other value stops processing while
leaving the Worker healthy.
