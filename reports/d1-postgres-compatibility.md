# PostgreSQL / D1 compatibility occurrence index

September 27, 2026. Static scan of SQL migrations and server/API/scripts, excluding tests. This records every matching source location for the listed dependency families. Hits may include comments and compatible SQLite syntax; use the replacement assessment, not a mechanical rewrite. No production access, query execution or migration.

## Raw PostgreSQL client

**Difficulty:** moderate. Replace postgres.js tagged templates, fragments, array/JSON serializers and result Date/number mapping with typed repositories using D1 bound statements. No ORM adapter exists here.

**Matching files:** 73.

- `src/server/commerce/stripe.ts`: 134, 210, 308
- `src/server/commerce/admin.ts`: 7, 53, 67, 88
- `src/server/commerce/orders.ts`: 31, 58, 91, 171, 281, 318, 337, 346, 370, 378, 393
- `src/server/commerce/catalog.ts`: 14, 45
- `src/server/three-and-out/schema.ts`: 1
- `src/server/three-and-out/daily-service.ts`: 142, 148, 156, 190, 219, 222, 223, 262, 281, 284, 321, 326, 354, 359
- `src/server/schedule/repository.ts`: 7, 53
- `src/server/schedule/enrich.ts`: 9
- `src/server/schedule/ingest.ts`: 82
- `src/server/content-automation/repository.ts`: 8, 21, 29, 51, 53
- `src/server/content-automation/global-repository.ts`: 6, 21, 31
- `src/server/security/audit.ts`: 32, 34
- `src/server/auth/repository.ts`: 33, 40, 48, 60, 78, 86, 87, 91, 97, 152, 175, 179, 196, 216, 230, 242, 269, 273, 277, 281, 298, 317, 318, 326, 333, 334, 338
- `src/server/auth/database.ts`: 1, 6
- `src/server/rewards/repository.ts`: 4, 89, 93, 148, 177
- `src/server/content/content-health.ts`: 32
- `src/server/game-day/repository.ts`: 41, 50, 54, 56, 69, 80, 134, 139, 152, 156, 175, 179
- `src/server/crew/repository.ts`: 24, 77, 97, 165, 174, 213, 264, 284, 295, 299, 304, 311, 321, 330, 335, 343, 350, 358
- `src/server/trivia/game-repository.ts`: 14, 31, 34, 113, 241, 249
- `src/server/trivia/repository.ts`: 10, 20, 37, 45, 52, 55, 75, 109, 116, 130
- `src/server/trivia/event-repository.ts`: 13, 33
- `src/server/trivia/social-repository.ts`: 13, 28, 31, 35, 39, 46, 56, 57, 61, 63, 67, 78, 82, 97, 128, 132, 133, 137, 138, 143, 149, 154, 160, 165, 182, 186, 191
- `src/server/trivia/guest.ts`: 26
- `src/server/trivia/question-pool.ts`: 12
- `src/server/user/repository.ts`: 6, 7, 11, 28, 37, 44, 52, 54, 59, 67, 68, 76, 81, 82, 86
- `src/server/user/account-repository.ts`: 9, 24
- `src/server/user/content-repository.ts`: 23, 41, 60, 78, 80, 87, 91, 98, 124, 186, 190, 201, 207, 228, 247
- `src/server/film-room/video-source-sync.ts`: 511
- `src/server/film-room/discovered.ts`: 70
- `src/server/story-engine/repository.ts`: 74, 75, 79, 88, 92, 141, 144, 154, 162, 167, 174, 198, 212, 218, 222, 232, 262, 273, 397, 413, 470, 515, 518
- `src/server/story-engine/projections.ts`: 37, 101, 202, 262
- `src/server/search/indexer.ts`: 16, 99
- `src/server/search/retrieval.ts`: 37
- `src/server/search/answer-data.ts`: 218, 267
- `src/server/search/database.ts`: 1, 5
- `src/server/search/stored-betting.ts`: 22
- `src/server/odds/repository.ts`: 19, 35, 78, 85, 89, 94, 102, 106, 119, 153
- `src/server/front-office/repository.ts`: 40, 50, 69, 95
- `src/server/front-office/events-repository.ts`: 42, 81, 91, 103, 130, 143, 157, 177, 186, 199, 210
- `src/server/monitoring/observer.ts`: 18, 49, 54, 134, 138
- `src/server/historical-stats/repository.ts`: 9, 43, 58
- `src/server/historical-stats/team-season-strength-service.ts`: 4
- `src/server/historical-stats/team-matchup-service.ts`: 10
- `src/server/historical-stats/importer.ts`: 138
- `src/server/fan-pulse/repository.ts`: 13, 44
- `src/server/notifications/web-push-repository.ts`: 8, 25, 29, 34
- `src/server/notifications/repository.ts`: 16, 25, 41, 50, 65, 69, 77, 87, 105, 126, 136, 145, 149, 162, 172, 201, 238, 247, 252, 256, 260, 284, 285, 306, 310
- `src/app/api/automation/three-and-out/route.ts`: 33
- `src/app/api/parlay-lab/movement/route.ts`: 7
- `src/app/api/parlay-lab/my-plays/grade/route.ts`: 25, 43, 61
- `src/app/api/crew/media/[mediaId]/route.ts`: 11
- `src/app/api/admin/observer/route.ts`: 23
- `src/app/api/three-and-out/preferences/route.ts`: 40, 70
- `scripts/content-ollama-stress-test.ts`: 23, 66, 93
- `scripts/parlay-lab-audit.ts`: 2
- `scripts/capture-beat-semantic-baseline.ts`: 7
- `scripts/sync-parlay-lab-odds-to-production.ts`: 2
- `scripts/audit-trivia-redesign.ts`: 15
- `scripts/seed-trivia.ts`: 4
- `scripts/audit-crew.ts`: 18, 21
- `scripts/verify-beat-semantic-backfill.ts`: 7
- `scripts/sync-production-content-to-local.ts`: 2, 63
- `scripts/backfill-beat-transactions.ts`: 7, 9
- `scripts/migrate-parlay-lab.ts`: 4, 38
- `scripts/migrate-three-and-out.ts`: 4, 29, 35
- `scripts/seed-video-sources.ts`: 2
- `scripts/video-source-health.ts`: 2
- `scripts/backfill-team-content.ts`: 47
- `scripts/backfill-film-room.ts`: 38
- `scripts/migrate-auth.ts`: 4, 81
- `scripts/backfill-beat-semantics.ts`: 29, 94
- `scripts/resolve-youtube-sources.ts`: 2
- `scripts/sync-nfl-schedule.ts`: 13, 18

## Interactive transactions

**Difficulty:** high. D1 batch supports fixed atomic statements, not await-driven read/branch/write transactions. Move invariants into conditional SQL/triggers, preassign IDs and use CAS plus retry; validate every transaction.

**Matching files:** 27.

- `src/server/commerce/stripe.ts`: 135, 211, 267, 320
- `src/server/commerce/admin.ts`: 54, 89
- `src/server/commerce/orders.ts`: 126, 203, 282, 416
- `src/server/schedule/enrich.ts`: 47
- `src/server/schedule/ingest.ts`: 82
- `src/server/auth/repository.ts`: 61, 98, 196, 243
- `src/server/rewards/repository.ts`: 89, 148
- `src/server/game-day/repository.ts`: 41, 157
- `src/server/crew/repository.ts`: 77, 174, 227
- `src/server/trivia/game-repository.ts`: 15, 114
- `src/server/trivia/repository.ts`: 76, 131
- `src/server/trivia/event-repository.ts`: 34
- `src/server/trivia/social-repository.ts`: 14, 98, 166
- `src/server/trivia/question-pool.ts`: 26
- `src/server/user/repository.ts`: 29, 59, 86
- `src/server/user/account-repository.ts`: 25
- `src/server/user/content-repository.ts`: 126, 228
- `src/server/story-engine/repository.ts`: 92, 274, 414, 471
- `src/server/search/indexer.ts`: 132
- `src/server/notifications/web-push-repository.ts`: 8
- `src/server/notifications/repository.ts`: 50
- `src/app/api/three-and-out/preferences/route.ts`: 70
- `scripts/seed-trivia.ts`: 60
- `scripts/audit-crew.ts`: 19
- `scripts/sync-production-content-to-local.ts`: 32, 41
- `scripts/backfill-beat-semantics.ts`: 95
- `scripts/resolve-youtube-sources.ts`: 118

## Row and job locking

**Difficulty:** high. Atomic UPDATE with candidate subquery, claim token, lease expiry and RETURNING; validate status/version predicate. A SELECT then UPDATE in separate requests is not a lock.

**Matching files:** 11.

- `src/server/commerce/stripe.ts`: 117, 143, 220, 331
- `src/server/commerce/orders.ts`: 286
- `src/server/rewards/repository.ts`: 41, 159
- `src/server/game-day/repository.ts`: 160
- `src/server/crew/repository.ts`: 177
- `src/server/trivia/game-repository.ts`: 117, 125
- `src/server/trivia/event-repository.ts`: 35
- `src/server/trivia/social-repository.ts`: 102, 105, 169
- `src/server/user/content-repository.ts`: 134
- `src/server/story-engine/repository.ts`: 133
- `src/server/front-office/events-repository.ts`: 119

## Advisory locking

**Difficulty:** high. Replace commerce checkout/refund locks with unique idempotency keys and transactional state transitions/outbox; preserve payment-provider idempotency.

**Matching files:** 2.

- `src/server/commerce/stripe.ts`: 212
- `src/server/commerce/orders.ts`: 204

## JSONB / PostgreSQL JSON construction

**Difficulty:** moderate. SQLite JSON functions/text validation; normalize membership lists when indexed lookup matters. JSON1 is not binary-compatible with PostgreSQL JSONB. Avoid serializing JSON twice.

**Matching files:** 42.

- `db/migrations/043_beat_transaction_metadata.sql`: 1
- `db/migrations/016_game_day.sql`: 1, 3, 7
- `db/migrations/021_crews.sql`: 57
- `db/migrations/018_monitor_observer.sql`: 16, 45, 47
- `db/migrations/005_security_audit.sql`: 10
- `db/migrations/028_content_automation_global.sql`: 10
- `db/migrations/017_search_documents.sql`: 24
- `db/migrations/044_beat_visual_classification.sql`: 2
- `db/migrations/042_canonical_schedule.sql`: 20
- `db/migrations/023_commerce.sql`: 70
- `db/migrations/003_notifications_and_devices.sql`: 69, 124
- `db/migrations/030_video_source_registry.sql`: 8
- `db/migrations/032_front_office_events.sql`: 9, 40
- `db/migrations/002_user_profiles_and_preferences.sql`: 23
- `db/migrations/012_source_watcher_story_engine.sql`: 24, 36, 61, 62, 66, 88, 127, 128, 142, 150, 151, 152
- `db/migrations/011_move_the_chains_rewards.sql`: 45
- `db/migrations/004_user_content_state.sql`: 38, 52, 53
- `db/migrations/013_story_downstream_projections.sql`: 5, 6
- `db/migrations/033_three_and_out_daily.sql`: 9
- `db/migrations/027_content_automation_trial.sql`: 10
- `db/migrations/039_parlay_lab_research_first.sql`: 6
- `db/migrations/020_notification_center.sql`: 14
- `db/migrations/031_front_office_save_state.sql`: 10, 22
- `db/migrations/001_auth_identity.sql`: 80, 91, 92
- `db/migrations/010_get_caught_up.sql`: 9
- `src/server/commerce/orders.ts`: 333, 334
- `src/server/commerce/catalog.ts`: 49
- `src/server/three-and-out/schema.ts`: 8, 9, 16
- `src/server/three-and-out/daily-service.ts`: 158, 159, 160, 161, 281
- `src/server/schedule/enrich.ts`: 51
- `src/server/content-automation/repository.ts`: 16
- `src/server/content/content-health.ts`: 44
- `src/server/crew/repository.ts`: 45, 46
- `src/server/film-room/discovered.ts`: 85, 93
- `src/server/story-engine/repository.ts`: 106, 174, 232, 382, 518
- `src/server/front-office/events-repository.ts`: 50, 159
- `src/server/monitoring/observer.ts`: 66
- `src/server/historical-stats/repository.ts`: 28
- `scripts/sync-production-content-to-local.ts`: 64
- `scripts/backfill-beat-transactions.ts`: 24
- `scripts/backfill-team-content.ts`: 55
- `scripts/backfill-beat-semantics.ts`: 97

## Arrays and ANY

**Difficulty:** moderate. Child tables or bound IN chunks under 100 parameters; preserve empty/null semantics. Array aggregation to json_group_array, with explicit parse/order.

**Matching files:** 44.

- `src/server/commerce/admin.ts`: 31
- `src/server/commerce/orders.ts`: 61, 102, 190
- `src/server/commerce/catalog.ts`: 17, 39
- `src/server/schedule/repository.ts`: 7
- `src/server/schedule/enrich.ts`: 12, 23
- `src/server/schedule/ingest.ts`: 12
- `src/server/rewards/repository.ts`: 111
- `src/server/content/content-health.ts`: 33
- `src/server/game-day/repository.ts`: 87
- `src/server/crew/repository.ts`: 31, 237
- `src/server/trivia/game-repository.ts`: 253
- `src/server/user/account-repository.ts`: 10
- `src/server/user/content-repository.ts`: 35
- `src/server/film-room/youtube.ts`: 142
- `src/server/story-engine/repository.ts`: 199
- `src/server/story-engine/projections.ts`: 49, 110, 116, 158, 262
- `src/server/search/indexer.ts`: 114, 146
- `src/server/search/answer-engine.ts`: 115
- `src/server/front-office/calendar.ts`: 110
- `src/server/monitoring/observer.ts`: 29
- `src/server/historical-stats/repository.ts`: 38, 67
- `src/server/historical-stats/trending-props-service.ts`: 60
- `src/server/historical-stats/team-matchup-service.ts`: 22
- `src/server/historical-stats/importer.ts`: 114, 148
- `src/server/data-sources/espn-stats.ts`: 275
- `src/app/api/front-office/trade-hub/route.ts`: 24
- `src/app/api/mobile/search/route.ts`: 28
- `src/app/api/mobile/front-office/route.ts`: 29
- `src/app/api/parlay-lab/research/route.ts`: 83
- `src/app/api/parlay-lab/alt-stack/route.ts`: 12
- `src/app/api/parlay-lab/my-plays/grade/route.ts`: 51, 82, 104
- `src/app/api/user/home/route.ts`: 16
- `src/app/api/user/notifications/dev-simulate/route.ts`: 65
- `src/app/api/trivia/stats/route.ts`: 10
- `src/app/api/three-and-out/preferences/route.ts`: 29
- `scripts/parlay-lab-audit.ts`: 79, 123, 124, 147
- `scripts/sync-parlay-lab-odds-to-production.ts`: 149
- `scripts/audit-crew.ts`: 207
- `scripts/sync-production-content-to-local.ts`: 78
- `scripts/run-content-ingestion.ts`: 16
- `scripts/audit-beat-editorial.mjs`: 50
- `scripts/backfill-team-content.ts`: 14, 53, 74
- `scripts/build-front-office-2026-seed.ts`: 421, 489, 497
- `scripts/audit-team-logo.mjs`: 72

## UUID generation

**Difficulty:** low. Preserve UUID strings as TEXT NOT NULL, generate in application crypto.randomUUID; SQL fan-out UUID creation needs precomputed values/design.

**Matching files:** 62.

- `db/migrations/036_nflverse_historical_stats.sql`: 8, 26, 30, 63, 67
- `db/migrations/022_crew_share_recipients.sql`: 4, 5, 6, 19, 20
- `db/migrations/008_trivia_gameplay_hardening.sql`: 22, 23, 31
- `db/migrations/014_story_automation_policy.sql`: 3, 4
- `db/migrations/016_game_day.sql`: 1, 2, 3, 5, 6, 7
- `db/migrations/021_crews.sql`: 4, 7, 13, 14, 15, 28, 29, 30, 31, 49, 50, 51, 63, 64
- `db/migrations/041_crew_feed_and_photos.sql`: 5, 6, 7, 14, 15, 16
- `db/migrations/018_monitor_observer.sql`: 9, 23, 24, 36, 37
- `db/migrations/005_security_audit.sql`: 4, 5
- `db/migrations/028_content_automation_global.sql`: 3
- `db/migrations/024_stripe_webhooks.sql`: 24
- `db/migrations/017_search_documents.sql`: 21
- `db/migrations/009_trivia_buddies.sql`: 11, 12, 13, 14, 34, 35
- `db/migrations/042_canonical_schedule.sql`: 19
- `db/migrations/023_commerce.sql`: 52, 54, 86, 87, 102, 104
- `db/migrations/003_notifications_and_devices.sql`: 4, 5, 19, 20, 21, 34, 35, 48, 49, 60, 61, 75, 76, 88, 89, 104, 105, 107, 118
- `db/migrations/032_front_office_events.sql`: 4, 23
- `db/migrations/046_web_push.sql`: 6
- `db/migrations/029_fan_pulse.sql`: 4, 5
- `db/migrations/007_trivia.sql`: 4, 12, 13, 46, 54, 58, 65, 73, 74, 82, 83, 85, 86, 100, 101, 110, 111, 112, 113, 122, 123, 125, 130
- `db/migrations/002_user_profiles_and_preferences.sql`: 3, 34, 43, 49
- `db/migrations/012_source_watcher_story_engine.sql`: 32, 49, 76, 101, 102, 103, 115, 116, 136, 138
- `db/migrations/011_move_the_chains_rewards.sql`: 36, 37
- `db/migrations/004_user_content_state.sql`: 4, 5, 22, 31, 32, 47, 48, 63, 64
- `db/migrations/034_isolate_video_from_beat.sql`: 36
- `db/migrations/013_story_downstream_projections.sql`: 13, 14
- `db/migrations/026_commerce_payment_hardening.sql`: 25, 26, 27, 35
- `db/migrations/033_three_and_out_daily.sql`: 20
- `db/migrations/045_trivia_scheduled_events.sql`: 3, 5, 15, 16, 17
- `db/migrations/027_content_automation_trial.sql`: 3
- `db/migrations/037_historical_team_season_strength.sql`: 4
- `db/migrations/031_front_office_save_state.sql`: 4
- `db/migrations/025_stripe_checkout_attempts.sql`: 3
- `db/migrations/001_auth_identity.sql`: 4, 21, 22, 37, 47, 48, 58, 59, 60, 62, 63, 76, 77, 89
- `db/migrations/035_parlay_lab_odds.sql`: 4, 44, 45, 65, 66, 83
- `src/server/three-and-out/schema.ts`: 24
- `src/server/schedule/enrich.ts`: 12, 23, 51
- `src/server/content-automation/repository.ts`: 9
- `src/server/trivia/event-repository.ts`: 15
- `src/server/story-engine/repository.ts`: 105, 120, 130, 373
- `src/app/api/push/web-test/route.ts`: 14
- `src/app/api/user/notifications/route.ts`: 14
- `src/app/api/user/devices/tokens/route.ts`: 9
- `src/app/api/trivia/challenges/route.ts`: 19
- `src/app/api/trivia/friends/route.ts`: 20
- `src/app/api/trivia/events/[eventId]/route.ts`: 11
- `src/app/api/trivia/groups/[joinCode]/invite/route.ts`: 13
- `src/app/api/crew/invites/route.ts`: 11
- `src/app/api/crew/share/route.ts`: 12
- `src/app/api/crew/media/[mediaId]/route.ts`: 9
- `src/app/api/crew/members/[userId]/route.ts`: 12
- `src/app/api/crew/activity/[activityId]/route.ts`: 12
- `src/app/api/crew/activity/[activityId]/comments/route.ts`: 12
- `src/app/api/game-day/rooms/[roomId]/actions/route.ts`: 15
- `src/app/api/admin/observer/route.ts`: 33
- `src/app/api/admin/commerce/orders/[orderId]/refunds/route.ts`: 13
- `src/app/api/auth/login/route.ts`: 15
- `src/app/api/auth/mobile/exchange/route.ts`: 13
- `src/app/api/auth/social/[provider]/exchange/route.ts`: 19
- `src/app/api/commerce/stripe/retry/route.ts`: 10
- `src/app/api/commerce/stripe/status/route.ts`: 10
- `src/app/api/commerce/stripe/checkout/route.ts`: 11

## Postgres lexical/vector search

**Difficulty:** high. FTS5 with maintained chunks replaces lexical index; embeddings require separate derived vector service or verified libSQL vector support. Ranking/tokenization parity requires evaluation.

**Matching files:** 3.

- `db/migrations/017_search_documents.sql`: 23, 25, 26, 27, 28, 35, 37
- `src/server/search/indexer.ts`: 138
- `src/server/search/retrieval.ts`: 41, 43, 56

## DISTINCT ON

**Difficulty:** moderate. ROW_NUMBER OVER(PARTITION BY ... ORDER BY ...) then rn=1; deterministic tie-breakers and query-plan checks.

**Matching files:** 4.

- `src/server/content/content-health.ts`: 43
- `src/server/search/indexer.ts`: 21
- `src/server/search/retrieval.ts`: 40, 55
- `src/app/api/parlay-lab/movement/route.ts`: 18

## Date/time and formatting

**Difficulty:** moderate. Store UTC integer milliseconds/consistent ISO text; compute IANA local schedules in application, not SQLite fixed offsets; UTC boundaries bound as parameters.

**Matching files:** 104.

- `db/migrations/036_nflverse_historical_stats.sql`: 20, 21, 57, 58, 91, 92
- `db/migrations/022_crew_share_recipients.sql`: 13, 21
- `db/migrations/008_trivia_gameplay_hardening.sql`: 24, 32
- `db/migrations/014_story_automation_policy.sql`: 9
- `db/migrations/016_game_day.sql`: 1, 2, 3, 5, 6, 7
- `db/migrations/021_crews.sql`: 8, 9, 19, 20, 41, 42, 58, 66
- `db/migrations/041_crew_feed_and_photos.sql`: 10, 18
- `db/migrations/018_monitor_observer.sql`: 13, 18, 40
- `db/migrations/005_security_audit.sql`: 11
- `db/migrations/028_content_automation_global.sql`: 11
- `db/migrations/024_stripe_webhooks.sql`: 26
- `db/migrations/017_search_documents.sql`: 31
- `db/migrations/009_trivia_buddies.sql`: 6, 17, 39
- `db/migrations/023_commerce.sql`: 14, 15, 31, 32, 47, 48, 78, 79, 97, 107
- `db/migrations/003_notifications_and_devices.sql`: 10, 11, 24, 25, 42, 43, 53, 54, 65, 67, 82, 83, 95, 96, 110, 114, 125
- `db/migrations/030_video_source_registry.sql`: 20, 21
- `db/migrations/032_front_office_events.sql`: 15, 16, 45
- `db/migrations/046_web_push.sql`: 7
- `db/migrations/029_fan_pulse.sql`: 11, 12
- `db/migrations/007_trivia.sql`: 8, 19, 39, 40, 59, 61, 91, 103, 115, 126, 139
- `db/migrations/040_fix_passing_rushing_yards.sql`: 10
- `db/migrations/002_user_profiles_and_preferences.sql`: 7, 37, 44, 50
- `db/migrations/012_source_watcher_story_engine.sql`: 21, 25, 26, 39, 43, 44, 58, 67, 68, 92, 93, 108, 130, 143
- `db/migrations/011_move_the_chains_rewards.sql`: 20, 21, 33, 40
- `db/migrations/004_user_content_state.sql`: 14, 24, 26, 39, 54, 67
- `db/migrations/034_isolate_video_from_beat.sql`: 6, 29
- `db/migrations/013_story_downstream_projections.sql`: 8, 22
- `db/migrations/026_commerce_payment_hardening.sql`: 38, 39
- `db/migrations/033_three_and_out_daily.sql`: 12, 27, 28
- `db/migrations/045_trivia_scheduled_events.sql`: 10, 18
- `db/migrations/027_content_automation_trial.sql`: 11, 13
- `db/migrations/037_historical_team_season_strength.sql`: 24, 25
- `db/migrations/031_front_office_save_state.sql`: 13, 14
- `db/migrations/001_auth_identity.sql`: 12, 13, 28, 29, 39, 42, 43, 52, 53, 64, 65, 81, 93, 94
- `db/migrations/010_get_caught_up.sql`: 4, 5
- `db/migrations/035_parlay_lab_odds.sql`: 15, 19, 20, 28, 29, 38, 39, 58, 59, 76, 77, 89
- `src/server/commerce/stripe.ts`: 125, 169, 181, 186, 265, 293, 312, 362, 370, 372, 380, 383, 391, 393, 396, 401
- `src/server/commerce/admin.ts`: 57, 69
- `src/server/commerce/orders.ts`: 34, 130, 142, 217, 233, 248, 271, 307, 311, 419, 425, 429
- `src/server/commerce/catalog.ts`: 16, 35
- `src/server/three-and-out/daily-service.ts`: 224, 228, 329, 332, 355, 360
- `src/server/schedule/ingest.ts`: 86
- `src/server/content-automation/repository.ts`: 17, 19, 31, 53
- `src/server/content-automation/global-repository.ts`: 8, 32
- `src/server/cache/public-read-cache.ts`: 10, 17
- `src/server/auth/repository.ts`: 51, 86, 92, 103, 107, 114, 138, 146, 161, 168, 195, 201, 202, 232, 245, 246, 253, 259, 269, 273, 277, 317, 319, 327, 328, 333, 334, 338
- `src/server/auth/rate-limit.ts`: 5
- `src/server/rewards/repository.ts`: 58, 117, 168, 178
- `src/server/content/refresh-nfl-content.ts`: 45
- `src/server/content/content-health.ts`: 38
- `src/server/game-day/repository.ts`: 20, 54, 86, 163, 170, 179
- `src/server/crew/repository.ts`: 35, 55, 83, 106, 129, 160, 194, 195, 196, 299, 306, 358
- `src/server/trivia/game-repository.ts`: 73, 90, 142, 154, 155, 172, 177
- `src/server/trivia/repository.ts`: 57, 95
- `src/server/trivia/event-repository.ts`: 16, 17, 36, 38
- `src/server/trivia/social-repository.ts`: 41, 57, 65, 82, 102, 105, 114, 123, 138, 156, 169
- `src/server/trivia/question-pool.ts`: 42
- `src/server/user/repository.ts`: 30, 31, 48, 62, 76, 81, 82, 89, 91
- `src/server/user/content-repository.ts`: 54, 100, 101, 153, 168, 191
- `src/server/film-room/video-source-sync.ts`: 533, 541, 542
- `src/server/story-engine/repository.ts`: 95, 136, 141, 144, 154, 162, 213, 262, 278, 382, 397, 423, 427, 474
- `src/server/story-engine/projections.ts`: 118, 122, 124, 126
- `src/server/story-engine/service.ts`: 64, 173, 205, 221, 287
- `src/server/search/fallback.ts`: 32, 126
- `src/server/search/indexer.ts`: 98, 138, 139, 146, 153
- `src/server/search/retrieval.ts`: 36, 38, 46, 51, 60, 76
- `src/server/search/answer-engine.ts`: 82, 730, 733
- `src/server/search/stored-betting.ts`: 32
- `src/server/odds/repository.ts`: 21, 25, 56, 68, 71, 79, 85, 89, 94, 102, 106
- `src/server/odds/sportsbookIngestionService.ts`: 129, 199, 225, 242
- `src/server/api/trades.ts`: 449, 776, 792
- `src/server/api/store.ts`: 1305, 1508, 1594, 1961
- `src/server/front-office/repository.ts`: 82, 102
- `src/server/front-office/calendar.ts`: 51, 84
- `src/server/front-office/events-repository.ts`: 111, 121, 131, 144, 159, 161, 200, 210
- `src/server/monitoring/observer.ts`: 25, 48, 60, 114, 134
- `src/server/historical-stats/team-season-strength-service.ts`: 57
- `src/server/historical-stats/importer.ts`: 140, 144, 213, 239, 262
- `src/server/fan-pulse/repository.ts`: 50
- `src/server/notifications/web-push-repository.ts`: 11, 13, 16, 19, 34, 35, 36
- `src/server/notifications/repository.ts`: 18, 19, 41, 53, 56, 58, 65, 128, 129, 138, 145, 149, 166, 172, 229, 241, 247, 252, 256, 260, 292, 306, 312
- `src/server/notifications/web-push.ts`: 57
- `src/app/api/automation/content/route.ts`: 115
- `src/app/api/automation/content/global/route.ts`: 96
- `src/app/api/parlay-lab/movement/route.ts`: 15, 16
- `src/app/api/parlay-lab/my-plays/grade/route.ts`: 50, 55, 81
- `src/app/api/search/transcribe/route.ts`: 31, 35
- `src/app/api/user/predictions/route.ts`: 29
- `src/app/api/user/notifications/dev-simulate/route.ts`: 64
- `src/app/api/trade-offers/accept/route.ts`: 290, 306
- `src/app/api/three-and-out/preferences/route.ts`: 83
- `scripts/content-ollama-stress-test.ts`: 144, 147, 179, 282
- `scripts/parlay-lab-audit.ts`: 157
- `scripts/sync-parlay-lab-odds-to-production.ts`: 65
- `scripts/audit-trivia-redesign.ts`: 31, 72, 74, 79, 84, 95
- `scripts/monitor-test.ts`: 37, 44
- `scripts/seed-trivia.ts`: 78
- `scripts/audit-crew.ts`: 41, 189
- `scripts/run-content-ingestion.ts`: 35
- `scripts/seed-video-sources.ts`: 18
- `scripts/video-source-health.ts`: 15, 16, 17
- `scripts/backfill-team-content.ts`: 26, 72
- `scripts/resolve-youtube-sources.ts`: 74, 96, 122, 125, 129, 134
- `scripts/sync-tankathon-draft.ts`: 51

## PostgreSQL casts / string matching

**Difficulty:** low. Explicit codecs, CAST and normalized indexed keys. Do not casually replace monetary numeric with floating point. LIKE collation differs.

**Matching files:** 34.

- `db/migrations/019_story_corroboration.sql`: 12, 13, 15
- `src/server/commerce/stripe.ts`: 120, 227
- `src/server/commerce/admin.ts`: 19, 25, 26, 32, 33, 34, 35, 36, 37, 38
- `src/server/commerce/orders.ts`: 124, 211, 373, 374
- `src/server/content-automation/repository.ts`: 30, 31, 32
- `src/server/content-automation/global-repository.ts`: 6
- `src/server/auth/repository.ts`: 177
- `src/server/rewards/repository.ts`: 120, 125
- `src/server/content/content-health.ts`: 38, 40, 46
- `src/server/game-day/repository.ts`: 99
- `src/server/crew/repository.ts`: 35, 36, 57, 106, 168
- `src/server/trivia/game-repository.ts`: 52, 70, 129, 154, 175, 242
- `src/server/trivia/repository.ts`: 57, 119
- `src/server/trivia/event-repository.ts`: 14
- `src/server/trivia/social-repository.ts`: 28, 119, 135, 137, 174
- `src/server/trivia/question-pool.ts`: 15
- `src/server/story-engine/repository.ts`: 74, 75, 97, 108, 154, 162, 212, 374, 376, 378, 379, 381, 382, 418, 419, 421
- `src/server/story-engine/projections.ts`: 39, 110, 112, 114, 116, 129, 131, 141, 147, 204
- `src/server/search/answer-data.ts`: 270, 271, 272
- `src/server/search/stored-betting.ts`: 32
- `src/server/odds/repository.ts`: 43, 130, 131, 132, 133, 134
- `src/server/front-office/events-repository.ts`: 84, 113, 116, 159
- `src/server/monitoring/observer.ts`: 60, 118, 122
- `src/server/historical-stats/repository.ts`: 19, 20, 25, 26, 27, 30, 31, 32, 33, 45, 46, 47, 48, 59, 63, 64, 65
- `src/server/historical-stats/team-season-strength-service.ts`: 7, 8, 9, 10, 11, 16, 17, 18, 19, 27, 28, 29, 30, 31, 32, 33, 34, 59
- `src/server/fan-pulse/repository.ts`: 15
- `src/server/notifications/repository.ts`: 230, 231, 239, 242
- `src/app/api/parlay-lab/movement/route.ts`: 18
- `src/app/api/parlay-lab/my-plays/grade/route.ts`: 27, 45, 50, 55, 62, 67, 68, 70
- `scripts/parlay-lab-audit.ts`: 118, 119, 120, 121, 122, 129, 130, 156, 157, 158, 159, 160, 161
- `scripts/sync-parlay-lab-odds-to-production.ts`: 66, 67
- `scripts/sync-production-content-to-local.ts`: 64, 69
- `scripts/video-source-health.ts`: 12, 13, 14, 15, 16, 17
- `scripts/sync-nfl-schedule.ts`: 28

## Sequences / identity

**Difficulty:** moderate. Integer PK for snapshot IDs or UUID; atomic sequence allocator for commerce order numbers; reset/import counters after migration.

**Matching files:** 4.

- `db/migrations/023_commerce.sql`: 3
- `db/migrations/035_parlay_lab_odds.sql`: 82
- `src/server/commerce/orders.ts`: 124, 211
- `src/server/monitoring/observer.ts`: 27

## Generated columns

**Difficulty:** moderate. SQLite generated columns can retain coalesce(line,-999999) with explicit numeric representation; tsvector generated field becomes FTS5 instead.

**Matching files:** 2.

- `db/migrations/017_search_documents.sql`: 25
- `db/migrations/035_parlay_lab_odds.sql`: 55

## Upsert and RETURNING

**Difficulty:** low. SQLite supports both in many current forms; preserve exact unique/partial-index conflict predicates, null handling and row-change checks. RETURNING cannot blindly replace PostgreSQL data-modifying CTE pipelines.

**Matching files:** 40.

- `db/migrations/023_commerce.sql`: 112
- `db/migrations/002_user_profiles_and_preferences.sql`: 9
- `db/migrations/012_source_watcher_story_engine.sql`: 153
- `db/migrations/011_move_the_chains_rewards.sql`: 33
- `src/server/commerce/stripe.ts`: 139, 178, 242, 312, 324
- `src/server/commerce/admin.ts`: 57, 69
- `src/server/commerce/orders.ts`: 131, 219
- `src/server/commerce/catalog.ts`: 21, 29
- `src/server/three-and-out/daily-service.ts`: 225, 330, 335
- `src/server/schedule/ingest.ts`: 86
- `src/server/auth/repository.ts`: 51, 66, 116, 138, 170, 181, 202, 204, 247, 328
- `src/server/rewards/repository.ts`: 34, 36, 67, 94, 103, 170, 180
- `src/server/game-day/repository.ts`: 54, 139, 152
- `src/server/crew/repository.ts`: 130, 195, 286, 306, 343, 350, 358
- `src/server/trivia/game-repository.ts`: 151, 154, 155
- `src/server/trivia/repository.ts`: 40, 52, 80, 90, 133
- `src/server/trivia/event-repository.ts`: 40
- `src/server/trivia/social-repository.ts`: 35, 41, 56, 65, 67, 80, 137, 176, 191
- `src/server/trivia/question-pool.ts`: 39
- `src/server/user/repository.ts`: 6, 7, 54, 61, 89
- `src/server/user/content-repository.ts`: 47, 55, 81, 82, 101, 102, 144, 154, 170, 193, 210, 211, 233, 234
- `src/server/film-room/video-source-sync.ts`: 535
- `src/server/story-engine/repository.ts`: 88, 136, 169, 324, 332, 356, 392, 416
- `src/server/search/indexer.ts`: 139
- `src/server/odds/repository.ts`: 22, 26, 62, 69, 80, 94, 102
- `src/server/front-office/repository.ts`: 76, 83, 105
- `src/server/front-office/events-repository.ts`: 51, 52, 123, 145, 164, 182, 201
- `src/server/monitoring/observer.ts`: 25, 63, 114
- `src/server/historical-stats/team-season-strength-service.ts`: 48
- `src/server/historical-stats/importer.ts`: 140, 144, 213, 239, 262
- `src/server/fan-pulse/repository.ts`: 47
- `src/server/notifications/web-push-repository.ts`: 12, 13, 17, 19, 35, 36
- `src/server/notifications/repository.ts`: 19, 20, 58, 59, 129, 130, 139, 140, 167, 293, 294
- `src/app/api/three-and-out/preferences/route.ts`: 82
- `scripts/sync-parlay-lab-odds-to-production.ts`: 19, 27, 74, 81, 96, 127
- `scripts/seed-trivia.ts`: 73, 92
- `scripts/audit-crew.ts`: 189
- `scripts/sync-production-content-to-local.ts`: 65
- `scripts/seed-video-sources.ts`: 18
- `scripts/resolve-youtube-sources.ts`: 129

## CTEs / window functions / aggregation

**Difficulty:** moderate. Ordinary/recursive CTEs and window functions generally supported; PostgreSQL data-modifying CTEs and LATERAL need rewrite. Avoid global window/aggregate scans in hot requests.

**Matching files:** 154.

- `db/migrations/019_story_corroboration.sql`: 10, 15
- `src/server/source-registry.ts`: 7
- `src/server/commerce/stripe.ts`: 120, 227
- `src/server/commerce/admin.ts`: 26, 32, 33, 35, 37, 38
- `src/server/commerce/orders.ts`: 333
- `src/server/commerce/catalog.ts`: 49
- `src/server/three-and-out/schema.ts`: 10, 13, 14, 15, 19, 29, 30, 31, 32, 40
- `src/server/three-and-out/daily-service.ts`: 160, 165, 197
- `src/server/schedule/diagnostics.ts`: 6
- `src/server/schedule/enrich.ts`: 10, 20, 23
- `src/server/schedule/resolve.ts`: 32, 50, 114, 122, 125, 128, 145
- `src/server/schedule/ingest.ts`: 26, 70, 79, 91, 92
- `src/server/content-automation/repository.ts`: 31
- `src/server/content-automation/auth.ts`: 24
- `src/server/auth/service.ts`: 30
- `src/server/providers/sportsGameOdds.ts`: 11, 13
- `src/server/ingest/contracts.ts`: 50, 61, 75, 83, 284
- `src/server/ingest/players.ts`: 185, 232, 317
- `src/server/ingest/cap.ts`: 95
- `src/server/rewards/repository.ts`: 120, 125
- `src/server/admin/authorization.ts`: 6
- `src/server/logic/offseason-free-agency.ts`: 56, 128, 188
- `src/server/logic/trade-block.ts`: 133, 171, 239, 369, 384, 476, 477
- `src/server/logic/free-agency-pool.ts`: 176, 177, 218, 380
- `src/server/logic/contract-expiration.ts`: 112, 122, 124, 126, 155, 163, 185, 190, 204, 217
- `src/server/logic/mock-draft-trades.ts`: 13
- `src/server/logic/trade-offer-generator.ts`: 58, 66, 300, 369, 427, 537, 588, 615, 701
- `src/server/logic/expiring-contracts.ts`: 78
- `src/server/content/refresh-nfl-content.ts`: 19, 20, 49, 50, 77
- `src/server/content/content-detail.ts`: 48, 54
- `src/server/content/content-health.ts`: 38, 39, 59, 62, 87, 106, 128, 129, 130, 131, 132, 136
- `src/server/content/beat-transactions.ts`: 14
- `src/server/content/beat-players.ts`: 12
- `src/server/crew/repository.ts`: 35, 46, 55, 57, 245, 274
- `src/server/trivia/game-repository.ts`: 154, 242
- `src/server/trivia/social-repository.ts`: 137
- `src/server/trivia/question-pool.ts`: 21
- `src/server/user/content-state.ts`: 11
- `src/server/film-room/video-source-sync.ts`: 512
- `src/server/film-room/youtube.ts`: 85, 178
- `src/server/story-engine/fetcher.ts`: 23, 63, 86, 102
- `src/server/story-engine/repository.ts`: 421
- `src/server/story-engine/projections.ts`: 43
- `src/server/story-engine/service.ts`: 182
- `src/server/search/deterministic-answer.ts`: 36, 42, 68
- `src/server/search/evidence.ts`: 9, 11, 17, 19, 28, 30, 79, 84
- `src/server/search/fallback.ts`: 12, 92
- `src/server/search/indexer.ts`: 41, 62, 116
- `src/server/search/answer-data.ts`: 121, 125, 195, 240
- `src/server/search/transactions.ts`: 84
- `src/server/search/answer-engine.ts`: 44, 48, 148, 150, 153, 192, 225, 236, 242, 269, 283, 357, 359, 384, 393, 396, 406, 412, 455, 459, 467, 469, 511, 591, 677
- `src/server/search/stored-betting.ts`: 40, 58, 73, 77, 97, 118, 119
- `src/server/search/intent.ts`: 55
- `src/server/odds/repository.ts`: 137
- `src/server/odds/sportsbookIngestionService.ts`: 67, 78, 91, 97
- `src/server/odds/normalization.ts`: 139
- `src/server/odds/next-game-markets.ts`: 6, 12, 23, 27, 38, 40, 54
- `src/server/api/draft.ts`: 188, 256, 277, 279, 283, 387, 389, 507, 513, 535, 677, 681, 688, 696, 703, 706, 710, 711, 722, 731, 733, 742, 746, 752, 795, 800, 819
- `src/server/api/draft-trade.ts`: 106, 110, 115, 135
- `src/server/api/trades.ts`: 399, 401, 404, 406, 755, 756, 759, 762, 824
- `src/server/api/store.ts`: 361, 445, 495, 500, 540, 550, 588, 821, 837, 849, 856, 887, 890, 962, 992, 1093, 1104, 1171, 1193, 1202, 1215, 1232, 1333, 1335, 1339, 1340, 1369, 1372, 1376, 1416, 1418, 1419, 1697, 1818, 1869
- `src/server/front-office/re-sign-ready.ts`: 107
- `src/server/front-office/calendar.ts`: 91, 112
- `src/server/front-office/welcome-messages.ts`: 48
- `src/server/front-office/event-engine.ts`: 82, 106, 151, 153, 193, 209
- `src/server/front-office/events-repository.ts`: 104
- `src/server/front-office/real-world-seed.ts`: 25
- `src/server/monitoring/observer.ts`: 66, 89, 169, 183, 202, 282, 287, 294, 307, 310, 339, 342, 344, 346, 349, 351, 353, 355, 357, 365
- `src/server/historical-stats/line-margin-service.ts`: 43, 48, 49, 60
- `src/server/historical-stats/player-usage-trend-service.ts`: 47, 71
- `src/server/historical-stats/player-consistency-service.ts`: 21, 38, 63
- `src/server/historical-stats/prop-miss-context-service.ts`: 26, 29, 38
- `src/server/historical-stats/repository.ts`: 10, 12
- `src/server/historical-stats/result-distribution-service.ts`: 56, 59, 66
- `src/server/historical-stats/opponent-vs-position-service.ts`: 27, 41, 44, 63, 64, 67
- `src/server/historical-stats/trending-props-service.ts`: 47, 74
- `src/server/historical-stats/venue-insight-service.ts`: 26
- `src/server/historical-stats/team-season-strength-service.ts`: 6, 27, 28, 29, 30, 31, 32, 33, 34
- `src/server/historical-stats/game-by-game-trend-service.ts`: 15
- `src/server/historical-stats/trend-service.ts`: 11, 13, 41, 43, 49, 51, 53, 54
- `src/server/historical-stats/prop-side-research-service.ts`: 102, 104, 108
- `src/server/historical-stats/research-score.ts`: 73, 77, 97, 163
- `src/server/historical-stats/line-ladder-insight-service.ts`: 21
- `src/server/historical-stats/player-environment-trend-service.ts`: 19, 61
- `src/server/historical-stats/game-environment-insight-service.ts`: 43, 55
- `src/server/historical-stats/research-season-stats.ts`: 9, 12, 32, 36
- `src/server/historical-stats/importer.ts`: 71, 105, 116, 177, 183, 225
- `src/server/historical-stats/line-ladder-service.ts`: 16, 44, 48, 57, 62, 69, 106
- `src/server/historical-stats/player-venue-trend-service.ts`: 10, 35, 45, 57, 64
- `src/server/data-sources/consensus-draft.ts`: 165
- `src/server/data-sources/overthecap.ts`: 53
- `src/server/data-sources/overthecap-free-agency.ts`: 250, 260
- `src/server/data-sources/overthecap-contracts.ts`: 172, 196, 250, 272, 366, 524
- `src/server/data-sources/espn.ts`: 148, 240, 305, 320
- `src/server/data-sources/espn-stats.ts`: 290
- `src/server/data-sources/madden-ratings.ts`: 76
- `src/server/data-sources/team-needs.ts`: 72, 105, 139
- `src/server/data-sources/espn-draft.ts`: 284, 345, 356, 414, 478
- `src/server/data/draft-prospects.ts`: 56
- `src/server/notifications/push.ts`: 58, 64
- `src/server/notifications/index.ts`: 85
- `src/server/front-office/draft/draft-intelligence.ts`: 115, 118, 130, 144, 161
- `src/server/front-office/trades/trade-target-engine.ts`: 99
- `src/server/auth/providers/apple.ts`: 28, 64
- `src/server/auth/providers/google.ts`: 38
- `src/app/api/catch-up/route.ts`: 67
- `src/app/api/film-room/route.ts`: 22, 45
- `src/app/api/front-office/simulate/route.ts`: 120, 202
- `src/app/api/front-office/trade-hub/route.ts`: 27, 37, 56
- `src/app/api/front-office/events/route.ts`: 34
- `src/app/api/automation/content/route.ts`: 21, 119, 123, 158
- `src/app/api/automation/content/global/route.ts`: 25, 100, 128
- `src/app/api/mobile/search/route.ts`: 31, 34, 50, 84
- `src/app/api/mobile/merch/route.ts`: 13
- `src/app/api/mobile/front-office/route.ts`: 11, 34, 63
- `src/app/api/mobile/players/[playerId]/route.ts`: 12
- `src/app/api/parlay-lab/research/route.ts`: 122, 184, 244
- `src/app/api/parlay-lab/alt-stack/route.ts`: 21
- `src/app/api/parlay-lab/test-ticket/route.ts`: 39
- `src/app/api/parlay-lab/movement/route.ts`: 8, 10, 11
- `src/app/api/parlay-lab/events/[eventId]/markets/route.ts`: 37, 41, 101
- `src/app/api/parlay-lab/my-plays/grade/route.ts`: 40
- `src/app/api/user/content-state/route.ts`: 22
- `src/app/api/user/notifications/dev-simulate/route.ts`: 82
- `src/app/api/crew/share/route.ts`: 29
- `src/app/api/contracts/expiring/route.ts`: 77, 83
- `src/app/api/trade-offers/accept/route.ts`: 68, 128, 131, 138, 149, 160, 161, 166, 167, 197, 205, 212, 213, 263, 268, 272, 277
- `src/app/api/trade-offers/evaluate/route.ts`: 46, 57, 69, 70, 75, 76
- `src/app/api/draft/trade-offers/accept/route.ts`: 80, 83, 90, 101, 112, 113, 118, 119, 164, 172, 179, 180
- `src/app/api/draft/trade-offers/evaluate/route.ts`: 60, 63, 70, 81, 92, 93, 98, 99
- `src/app/api/three-and-out/preferences/route.ts`: 34
- `scripts/content-ollama-stress-test.ts`: 191, 192, 193, 195, 199, 200, 203, 204, 208, 211, 215, 262, 266
- `scripts/import-nflverse-stats.ts`: 27
- `scripts/parlay-lab-audit.ts`: 93, 119, 129, 137
- `scripts/audit-trivia-redesign.ts`: 126, 127
- `scripts/audit-beat-cards.ts`: 16
- `scripts/seed-trivia.ts`: 32, 54
- `scripts/audit-crew.ts`: 99, 113, 201
- `scripts/verify-beat-semantic-backfill.ts`: 26
- `scripts/sync-production-content-to-local.ts`: 44, 58
- `scripts/backfill-beat-transactions.ts`: 42
- `scripts/migrate-parlay-lab.ts`: 22
- `scripts/run-content-ingestion.ts`: 39, 40, 63
- `scripts/video-source-health.ts`: 13, 14, 15, 16, 17, 25
- `scripts/backfill-team-content.ts`: 22, 81
- `scripts/content-ingestion-request.mjs`: 7, 62
- `scripts/build-front-office-2026-seed.ts`: 173, 209, 227, 263, 279, 433, 492, 501
- `scripts/front-office-seed-audit.ts`: 40, 41, 42, 45, 46, 47, 48, 49, 52, 53, 54, 76, 95, 96, 97, 98, 99, 100, 101, 104, 105, 110
- `scripts/backfill-beat-semantics.ts`: 71, 81, 84, 85, 126
- `scripts/resolve-youtube-sources.ts`: 35, 102
- `scripts/sync-tankathon-draft.ts`: 77, 145
- `scripts/story-engine-demo.ts`: 106, 129
- `scripts/sync-nfl-schedule.ts`: 60
- `scripts/content-ollama-eval.ts`: 67, 68, 69

## Functions / triggers / notifications

**Difficulty:** high. No authored database function/trigger/materialized-view/LISTEN/NOTIFY dependency detected by this scan. D1 SQLite triggers are possible, PL/pgSQL is not.

**Matching files:** 1.

- `src/server/notifications/web-push.ts`: 17

## Extensions

**Difficulty:** high. vector is the declared extension; D1 offers a fixed SQLite extension set, not installable PostgreSQL extensions.

**Matching files:** 1.

- `db/migrations/017_search_documents.sql`: 3

## Binary storage

**Difficulty:** moderate. Crew images currently stored as bytea; move bytes to object storage and retain checksum/ownership/reference. SQLite BLOB is possible but 2MB D1 row limit conflicts with allowed 2MiB images.

**Matching files:** 1.

- `db/migrations/041_crew_feed_and_photos.sql`: 9

## Additional PostgreSQL expressions

**Difficulty:** moderate. Normalize publisher/market strings during import or register an explicitly supported function; SQLite has no built-in PostgreSQL regexp_replace. Scalar max/min replace GREATEST/LEAST only after preserving differing NULL semantics. IS DISTINCT FROM is available in modern SQLite; verify deployed version. JSON existence uses json_type/path with bound paths. Modern SQLite UPDATE FROM is supported, but associated row-lock/CTE claims still need atomic rewrites. WITH ORDINALITY needs json_each keys or explicit ordering. This textual scan includes non-SQL question marks and misses multiline UPDATE FROM; inspect the cited repository transactions too.

**Matching files:** 192.

- `db/migrations/008_trivia_gameplay_hardening.sql`: 26
- `db/migrations/019_story_corroboration.sql`: 13, 14
- `db/migrations/040_fix_passing_rushing_yards.sql`: 5, 11
- `src/server/commerce/stripe.ts`: 77, 86, 258, 371, 383, 396, 401, 410
- `src/server/commerce/admin.ts`: 91, 92
- `src/server/commerce/providers.ts`: 20, 34
- `src/server/commerce/orders.ts`: 139, 242, 425, 435, 451, 453, 455
- `src/server/commerce/catalog.ts`: 10, 36
- `src/server/three-and-out/daily-service.ts`: 41, 48, 160, 353, 355
- `src/server/schedule/diagnostics.ts`: 11, 13
- `src/server/schedule/enrich.ts`: 51
- `src/server/schedule/resolve.ts`: 58, 69, 71
- `src/server/schedule/ingest.ts`: 42, 44, 46, 48
- `src/server/content-automation/trial.ts`: 18, 19
- `src/server/auth/repository.ts`: 21, 201
- `src/server/auth/oauth-state.ts`: 33
- `src/server/auth/crypto.ts`: 23
- `src/server/providers/sportsGameOdds.ts`: 101, 150, 166, 173
- `src/server/ingest/contracts.ts`: 89, 250, 256, 290, 293, 294, 309
- `src/server/logic/offseason-free-agency.ts`: 66, 110, 133, 146, 148, 182, 193, 197, 204, 211, 215, 240
- `src/server/logic/trade-block.ts`: 478, 488
- `src/server/logic/free-agency-pool.ts`: 60, 109, 111, 113, 261, 276
- `src/server/logic/trade-offer-generator.ts`: 149, 151, 243, 338, 340, 419, 584, 591
- `src/server/logic/expiring-contracts.ts`: 65, 90, 93
- `src/server/content/team-briefings.ts`: 11, 19
- `src/server/content/refresh-nfl-content.ts`: 25, 75
- `src/server/content/content-detail.ts`: 24
- `src/server/content/content-health.ts`: 96
- `src/server/content/canonical-surfaces.ts`: 82
- `src/server/content/beat-transactions.ts`: 48
- `src/server/content/beat-players.ts`: 22, 30
- `src/server/game-day/homepage-game.ts`: 42, 71
- `src/server/game-day/repository.ts`: 14, 61
- `src/server/crew/repository.ts`: 13, 132, 245
- `src/server/trivia/game-repository.ts`: 121, 153, 155, 178, 235
- `src/server/trivia/repository.ts`: 57
- `src/server/trivia/social-repository.ts`: 20
- `src/server/trivia/guest.ts`: 8, 12
- `src/server/user/repository.ts`: 13
- `src/server/film-room/video-source-sync.ts`: 524, 530
- `src/server/film-room/discovered.ts`: 24, 40
- `src/server/film-room/youtube.ts`: 121, 164, 171
- `src/server/story-engine/fetcher.ts`: 81, 82, 113, 114
- `src/server/story-engine/repository.ts`: 279, 291, 416, 419, 420, 451, 509, 511
- `src/server/story-engine/projections.ts`: 104, 105, 106, 107, 279, 281, 283, 285
- `src/server/story-engine/service.ts`: 93, 131, 135, 147, 149, 151, 321
- `src/server/search/synthesis.ts`: 12, 17, 51
- `src/server/search/fallback.ts`: 45, 71
- `src/server/search/providers.ts`: 31, 32, 66, 68, 89, 90
- `src/server/search/answer-data.ts`: 42, 44, 90, 92, 93, 94, 174, 201, 202, 204, 239, 292, 293, 294, 295, 296, 297, 298
- `src/server/search/answer-engine.ts`: 137, 187, 198, 203, 234, 249, 273, 277, 292, 305, 307, 342, 367, 374, 390, 402, 487, 489, 491, 493, 495, 497, 499, 501, 520, 566, 618, 634, 647, 649, 651, 666
- `src/server/search/stored-betting.ts`: 49, 100, 102, 104, 107, 109, 111, 114
- `src/server/search/intent.ts`: 16, 75, 78
- `src/server/odds/sportsbookIngestionService.ts`: 124, 188
- `src/server/odds/normalization.ts`: 63, 79, 158, 174, 175, 182, 187, 210, 240, 242
- `src/server/odds/line-classification.ts`: 40
- `src/server/odds/next-game-markets.ts`: 41
- `src/server/api/draft.ts`: 7
- `src/server/api/draft-trade.ts`: 2
- `src/server/api/trades.ts`: 301, 303
- `src/server/api/store.ts`: 229, 942, 975, 1116
- `src/server/front-office/welcome-messages.ts`: 59
- `src/server/front-office/event-engine.ts`: 164, 197, 199, 201, 207, 217
- `src/server/front-office/events-repository.ts`: 83, 142
- `src/server/front-office/real-world-seed.ts`: 14, 18
- `src/server/monitoring/observer.ts`: 24, 60, 222, 224, 232, 237, 242, 248, 252, 256, 261, 266, 268, 272, 274
- `src/server/historical-stats/upcoming-matchup-service.ts`: 7, 9, 11
- `src/server/historical-stats/line-margin-service.ts`: 28, 30, 32
- `src/server/historical-stats/player-usage-trend-service.ts`: 11, 19, 21, 23, 61, 63
- `src/server/historical-stats/saved-play-grading.ts`: 16
- `src/server/historical-stats/game-environment-service.ts`: 42, 52, 54, 56, 72, 75, 77, 79, 90
- `src/server/historical-stats/player-consistency-service.ts`: 54
- `src/server/historical-stats/result-distribution-service.ts`: 13
- `src/server/historical-stats/opponent-vs-position-service.ts`: 58, 61, 63, 69, 78
- `src/server/historical-stats/trending-props-service.ts`: 134
- `src/server/historical-stats/venue-insight-service.ts`: 18, 26
- `src/server/historical-stats/trend-service.ts`: 79, 82, 87, 113, 120
- `src/server/historical-stats/prop-side-research-service.ts`: 49
- `src/server/historical-stats/research-score.ts`: 15, 29, 43, 50, 54, 163, 166, 168
- `src/server/historical-stats/venue-environment-service.ts`: 12, 15
- `src/server/historical-stats/player-environment-trend-service.ts`: 34, 36, 38
- `src/server/historical-stats/game-environment-insight-service.ts`: 24, 26, 28, 30, 32, 34, 37, 39, 41, 61, 63
- `src/server/historical-stats/research-season-stats.ts`: 28, 50, 58
- `src/server/historical-stats/importer.ts`: 74, 144, 173, 201, 248, 268
- `src/server/historical-stats/game-script-context-service.ts`: 26, 28, 30, 32, 44, 46, 97
- `src/server/historical-stats/player-venue-trend-service.ts`: 26, 28, 30
- `src/server/data-sources/consensus-draft.ts`: 103, 105, 153
- `src/server/data-sources/overthecap.ts`: 61, 63, 93, 95, 99, 102, 109, 110, 111, 112
- `src/server/data-sources/tankathon-draft.ts`: 73, 75
- `src/server/data-sources/overthecap-free-agency.ts`: 55, 83, 101, 103, 120, 121, 124, 168, 169, 176, 181, 203
- `src/server/data-sources/overthecap-contracts.ts`: 45, 56, 96, 97, 104, 105, 143, 355, 357, 389, 395, 430, 434
- `src/server/data-sources/espn.ts`: 145, 260, 277, 325, 328
- `src/server/data-sources/espn-stats.ts`: 141, 157, 171, 245
- `src/server/data-sources/madden-ratings.ts`: 68, 75, 78, 82, 88
- `src/server/data-sources/team-needs.ts`: 102, 121
- `src/server/data-sources/espn-draft.ts`: 170, 258, 281, 338, 373, 374
- `src/server/data/draft-prospects.ts`: 63
- `src/server/data/prospects-top32.ts`: 26, 318, 319, 345, 347, 349, 351, 353, 355, 357
- `src/server/notifications/repository.ts`: 128, 289, 290, 291, 311
- `src/server/notifications/index.ts`: 83
- `src/server/front-office/draft/draft-intelligence.ts`: 28, 39, 41, 56, 133, 149, 151, 156, 162
- `src/server/front-office/trades/trade-target-engine.ts`: 70, 73, 107, 109, 111, 113, 142, 144, 146, 148
- `src/app/api/catch-up/route.ts`: 25, 30, 32, 39, 45
- `src/app/api/three-and-out/route.ts`: 11
- `src/app/api/crew/route.ts`: 3, 6
- `src/app/api/film-room/route.ts`: 11, 54
- `src/app/api/search/route.ts`: 36
- `src/app/api/front-office/simulate/route.ts`: 49, 301, 303, 355, 357
- `src/app/api/front-office/events/resolve/route.ts`: 32
- `src/app/api/front-office/events/[eventId]/route.ts`: 40, 43, 49
- `src/app/api/automation/three-and-out/route.ts`: 26
- `src/app/api/automation/content/route.ts`: 14, 54
- `src/app/api/automation/content/global/route.ts`: 24, 130
- `src/app/api/preview/access/route.ts`: 28
- `src/app/api/actions/re-sign/route.ts`: 81, 160, 165
- `src/app/api/actions/offer-contract/route.ts`: 63, 74
- `src/app/api/mobile/search/route.ts`: 23, 24, 68
- `src/app/api/mobile/merch/route.ts`: 10, 15
- `src/app/api/mobile/front-office/route.ts`: 7, 21, 78
- `src/app/api/source-engine/events/route.ts`: 8
- `src/app/api/parlay-lab/research/route.ts`: 63, 150, 162, 174, 200, 230, 237
- `src/app/api/parlay-lab/movement/route.ts`: 22, 23
- `src/app/api/parlay-lab/events/[eventId]/markets/route.ts`: 104
- `src/app/api/parlay-lab/my-plays/grade/route.ts`: 96
- `src/app/api/search/suggestions/route.ts`: 45
- `src/app/api/search/transcribe/route.ts`: 17
- `src/app/api/user/preferences/route.ts`: 4
- `src/app/api/user/team-visit/route.ts`: 15
- `src/app/api/user/profile/route.ts`: 4
- `src/app/api/user/onboarding/route.ts`: 5
- `src/app/api/trivia/daily/route.ts`: 15
- `src/app/api/trivia/friends/route.ts`: 12
- `src/app/api/game-day/homepage/route.ts`: 8
- `src/app/api/content/homepage/route.ts`: 6
- `src/app/api/content/wire/route.ts`: 6
- `src/app/api/content/huddle/route.ts`: 12, 14, 16, 17, 18, 19
- `src/app/api/content/huddle/[briefingId]/route.ts`: 11, 13
- `src/app/api/admin/commerce/route.ts`: 7, 12, 13, 14
- `src/app/api/admin/source-health/route.ts`: 8
- `src/app/api/admin/observer/route.ts`: 13, 19
- `src/app/api/admin/sources/route.ts`: 24
- `src/app/api/admin/story-reviews/route.ts`: 8
- `src/app/api/admin/commerce/products/route.ts`: 25
- `src/app/api/admin/commerce/orders/[orderId]/route.ts`: 15
- `src/app/api/admin/commerce/orders/[orderId]/refunds/route.ts`: 23
- `src/app/api/admin/commerce/inventory/[variantId]/route.ts`: 20
- `src/app/api/admin/commerce/products/[productId]/route.ts`: 6, 17
- `src/app/api/contracts/expiring/route.ts`: 37, 82
- `src/app/api/auth/signup/route.ts`: 17, 37
- `src/app/api/auth/forgot-password/route.ts`: 10
- `src/app/api/auth/change-password/route.ts`: 5, 23
- `src/app/api/auth/login/route.ts`: 21
- `src/app/api/auth/mobile/exchange/route.ts`: 18
- `src/app/api/auth/social/[provider]/exchange/route.ts`: 26
- `src/app/api/auth/social/[provider]/start/route.ts`: 16, 17, 35
- `src/app/api/draft/trade-hub/route.ts`: 3, 22
- `src/app/api/draft/session/route.ts`: 57
- `src/app/api/draft/session/start/route.ts`: 15
- `src/app/api/draft/trade-offers/accept/route.ts`: 219
- `src/app/api/catch-up/complete/route.ts`: 17
- `scripts/source-watcher.ts`: 7
- `scripts/content-ollama-stress-test.ts`: 19, 31, 47, 48, 52, 76, 79, 112, 187, 196, 199, 235, 237, 239, 241, 319, 320, 321, 322, 323, 327, 328, 329, 330, 332, 334
- `scripts/import-nflverse-stats.ts`: 8, 23, 24
- `scripts/parlay-lab-audit.ts`: 58, 96
- `scripts/capture-beat-semantic-baseline.ts`: 10, 13, 16
- `scripts/refresh-nfl-content.ts`: 16
- `scripts/sync-parlay-lab-odds-to-production.ts`: 15, 23
- `scripts/audit-trivia-redesign.ts`: 22, 82
- `scripts/search-index.ts`: 9
- `scripts/audit-beat-cards.ts`: 32
- `scripts/audit-crew.ts`: 9
- `scripts/verify-beat-semantic-backfill.ts`: 22
- `scripts/content-audit.ts`: 17
- `scripts/backfill-beat-transactions.ts`: 11, 16, 24
- `scripts/migrate-parlay-lab.ts`: 27, 29
- `scripts/audit-beat-renderer.ts`: 35
- `scripts/migrate-three-and-out.ts`: 15, 25
- `scripts/front-office-theme-audit.ts`: 31, 33, 36
- `scripts/run-content-ingestion.ts`: 44, 50, 57
- `scripts/audit-team-logo-site.mjs`: 5, 32
- `scripts/import-sportsbook-odds.ts`: 5, 24
- `scripts/backfill-team-content.ts`: 7
- `scripts/content-ingestion-request.mjs`: 62
- `scripts/build-front-office-2026-seed.ts`: 346, 407, 456, 475
- `scripts/front-office-seed-audit.ts`: 108, 109, 122, 123
- `scripts/audit-team-logo.mjs`: 8
- `scripts/backfill-beat-semantics.ts`: 6, 22, 38, 41, 44, 97, 126
- `scripts/resolve-youtube-sources.ts`: 27, 44, 106, 108, 110, 112, 128
- `scripts/sync-tankathon-draft.ts`: 29, 31, 33, 35, 37, 97, 99, 102, 104, 126, 127
- `scripts/story-engine-demo.ts`: 14
- `scripts/sync-nfl-schedule.ts`: 28, 33
- `scripts/content-ollama-eval.ts`: 84, 85, 86, 87, 88, 96, 99
