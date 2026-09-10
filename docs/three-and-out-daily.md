# Three & Out daily briefing

Three & Out is generated once per team per calendar day and delivered to opted-in users at approximately 5 PM in their profile timezone. The scheduled GitHub Action calls application-owned generation and delivery endpoints; Codex is not involved in routine operation.

Required production setup:

- Apply `db/migrations/033_three_and_out_daily.sql`.
- Configure GitHub Actions secrets `CONTENT_AUTOMATION_BASE_URL` and `CONTENT_AUTOMATION_SECRET`.
- Keep `THREE_AND_OUT_AUDIO_ENABLED=false` (or unset). The page has no audio control and the audio endpoint rejects work while disabled.

To restore Chatterbox later, first review provider cost/capacity, set `THREE_AND_OUT_AUDIO_ENABLED=true`, restore the audio player import/render, and configure the existing Chatterbox provider variables. The Chatterbox implementation and recorded assets remain in the repository.

Use the workflow's manual dispatch with `generate` to regenerate all teams, or call the automation endpoint with `team=KC&force=true` for an explicit team/date regeneration. All generation, skipped-edition, and push delivery runs emit structured logs.
