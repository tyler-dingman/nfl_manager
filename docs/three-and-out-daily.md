# Three & Out daily briefing

Three & Out is generated once per team per calendar day and delivered to opted-in users at approximately 5 PM in their profile timezone. The scheduled GitHub Action calls application-owned generation and delivery endpoints; Codex is not involved in routine operation.

Required production setup:

- Apply `db/migrations/033_three_and_out_daily.sql`.
- Configure GitHub Actions secrets `CONTENT_AUTOMATION_BASE_URL` and `CONTENT_AUTOMATION_SECRET`.
- Users opt into Email, SMS, Push, or any combination through the existing notification-preference system. Push uses the existing device infrastructure. Email and SMS delivery adapters are intentionally not added until a no-cost or approved provider is available.

Use the workflow's manual dispatch with `generate` to regenerate all teams, or call the automation endpoint with `team=KC&force=true` for an explicit team/date regeneration. All generation, skipped-edition, and push delivery runs emit structured logs.
