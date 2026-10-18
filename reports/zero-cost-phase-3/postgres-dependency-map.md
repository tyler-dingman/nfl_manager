# PostgreSQL dependency inventory

Static AST/SQL dependency inventory, all rg-visible application/job/scripts. Dynamic SQL is flagged for manual audit; caller matches are syntactic and do not prove a complete runtime call graph.

Tables declared in migration history: 115. SQL sites (both backends): 878. Connection factories: 19.

| Table | Adapter status | Query sites |
|---|---|---|
| auth_tokens | STAGED_TYPED_SUBSET | 3 |
| bet_markets | POSTGRES_REMAINING | 22 |
| canonical_stories | POSTGRES_REMAINING | 35 |
| commerce_inventory_adjustments | POSTGRES_REMAINING | 2 |
| commerce_order_items | POSTGRES_REMAINING | 9 |
| commerce_orders | POSTGRES_REMAINING | 23 |
| commerce_product_variants | POSTGRES_REMAINING | 21 |
| commerce_products | POSTGRES_REMAINING | 12 |
| commerce_promo_codes | POSTGRES_REMAINING | 4 |
| commerce_refunds | POSTGRES_REMAINING | 9 |
| commerce_stripe_webhook_events | POSTGRES_REMAINING | 5 |
| content_automation_runs | POSTGRES_REMAINING | 2 |
| content_automation_trial_runs | POSTGRES_REMAINING | 3 |
| content_candidates | POSTGRES_REMAINING | 22 |
| content_sources | POSTGRES_REMAINING | 33 |
| crew_activity | POSTGRES_REMAINING | 8 |
| crew_comments | POSTGRES_REMAINING | 2 |
| crew_invites | POSTGRES_REMAINING | 8 |
| crew_media | POSTGRES_REMAINING | 4 |
| crew_members | POSTGRES_REMAINING | 22 |
| crew_reactions | POSTGRES_REMAINING | 2 |
| crew_share_recipients | POSTGRES_REMAINING | 1 |
| crew_shares | POSTGRES_REMAINING | 1 |
| crews | POSTGRES_REMAINING | 8 |
| devices | STAGED_TYPED_SUBSET | 1 |
| email_change_requests | POSTGRES_REMAINING | 3 |
| fan_pulse_reactions | POSTGRES_REMAINING | 3 |
| fanduel_transfer_jobs | POSTGRES_REMAINING | 12 |
| front_office_command_receipts | POSTGRES_REMAINING | 3 |
| front_office_durable_state | POSTGRES_REMAINING | 7 |
| front_office_events | POSTGRES_REMAINING | 12 |
| front_office_recovery_evidence | POSTGRES_REMAINING | 1 |
| front_office_reference_bundles | POSTGRES_REMAINING | 3 |
| front_office_trade_offers | POSTGRES_REMAINING | 6 |
| game_day_activity | POSTGRES_REMAINING | 6 |
| game_day_events | POSTGRES_REMAINING | 1 |
| game_day_predictions | POSTGRES_REMAINING | 3 |
| game_day_reactions | POSTGRES_REMAINING | 2 |
| game_day_room_members | POSTGRES_REMAINING | 8 |
| game_day_rooms | POSTGRES_REMAINING | 8 |
| historical_games | POSTGRES_REMAINING | 14 |
| historical_player_games | POSTGRES_REMAINING | 13 |
| historical_team_games | POSTGRES_REMAINING | 3 |
| historical_team_season_strength | POSTGRES_REMAINING | 5 |
| huddle_enforcement | POSTGRES_REMAINING | 2 |
| huddle_messages | POSTGRES_REMAINING | 12 |
| huddle_poll_votes | POSTGRES_REMAINING | 3 |
| huddle_polls | POSTGRES_REMAINING | 4 |
| huddle_reactions | POSTGRES_REMAINING | 5 |
| huddle_reports | POSTGRES_REMAINING | 2 |
| huddle_user_filters | POSTGRES_REMAINING | 3 |
| ingestion_jobs | POSTGRES_REMAINING | 13 |
| move_the_chains_accounts | POSTGRES_REMAINING | 9 |
| move_the_chains_events | POSTGRES_REMAINING | 4 |
| notification_deliveries | POSTGRES_REMAINING | 1 |
| notification_events | POSTGRES_REMAINING | 1 |
| observer_run_events | POSTGRES_REMAINING | 4 |
| observer_run_items | POSTGRES_REMAINING | 3 |
| observer_runs | POSTGRES_REMAINING | 5 |
| parlay_role_feed_runs | POSTGRES_REMAINING | 2 |
| parlay_role_observations | POSTGRES_REMAINING | 2 |
| provider_player_mappings | POSTGRES_REMAINING | 13 |
| provider_team_mappings | POSTGRES_REMAINING | 4 |
| reward_definitions | POSTGRES_REMAINING | 4 |
| search_documents | POSTGRES_REMAINING | 5 |
| security_audit_events | POSTGRES_REMAINING | 2 |
| sessions | STAGED_TYPED_SUBSET | 13 |
| sportsbook_events | POSTGRES_REMAINING | 21 |
| sportsbook_price_snapshots | POSTGRES_REMAINING | 5 |
| sportsbook_prices | POSTGRES_REMAINING | 14 |
| story_domain_events | POSTGRES_REMAINING | 3 |
| story_editorial_overrides | POSTGRES_REMAINING | 1 |
| story_evidence | POSTGRES_REMAINING | 22 |
| story_publication_decisions | POSTGRES_REMAINING | 4 |
| story_versions | POSTGRES_REMAINING | 6 |
| three_and_out_push_deliveries | POSTGRES_REMAINING | 5 |
| three_and_out_snapshots | POSTGRES_REMAINING | 10 |
| trivia_answers | POSTGRES_REMAINING | 7 |
| trivia_challenges | POSTGRES_REMAINING | 3 |
| trivia_daily_questions | POSTGRES_REMAINING | 2 |
| trivia_daily_views | POSTGRES_REMAINING | 2 |
| trivia_event_registrations | POSTGRES_REMAINING | 4 |
| trivia_events | POSTGRES_REMAINING | 2 |
| trivia_friendships | POSTGRES_REMAINING | 4 |
| trivia_game_participants | POSTGRES_REMAINING | 31 |
| trivia_game_questions | POSTGRES_REMAINING | 17 |
| trivia_games | POSTGRES_REMAINING | 18 |
| trivia_groups | POSTGRES_REMAINING | 7 |
| trivia_invitations | POSTGRES_REMAINING | 3 |
| trivia_questions | POSTGRES_REMAINING | 12 |
| trivia_rank_snapshots | POSTGRES_REMAINING | 3 |
| trivia_stats | POSTGRES_REMAINING | 6 |
| user_consents | POSTGRES_REMAINING | 3 |
| user_content_state | POSTGRES_REMAINING | 3 |
| user_credentials | STAGED_TYPED_SUBSET | 5 |
| user_devices | POSTGRES_REMAINING | 7 |
| user_front_office_saves | POSTGRES_REMAINING | 14 |
| user_identities | STAGED_TYPED_SUBSET | 10 |
| user_notification_preferences | POSTGRES_REMAINING | 7 |
| user_notifications | POSTGRES_REMAINING | 11 |
| user_phone_numbers | POSTGRES_REMAINING | 4 |
| user_player_follows | POSTGRES_REMAINING | 0 |
| user_poll_votes | POSTGRES_REMAINING | 2 |
| user_predictions | POSTGRES_REMAINING | 2 |
| user_preferences | STAGED_TYPED_SUBSET | 10 |
| user_profiles | STAGED_TYPED_SUBSET | 11 |
| user_push_tokens | POSTGRES_REMAINING | 9 |
| user_quiet_hours | POSTGRES_REMAINING | 0 |
| user_rewards | POSTGRES_REMAINING | 6 |
| user_saved_content | STAGED_TYPED_SUBSET | 3 |
| user_team_follows | STAGED_TYPED_SUBSET | 6 |
| user_team_visit_state | POSTGRES_REMAINING | 6 |
| users | STAGED_TYPED_SUBSET | 51 |
| video_source_registry | POSTGRES_REMAINING | 9 |
| web_push_test_limits | POSTGRES_REMAINING | 1 |

## Connections

- scripts/migrate-fanduel-transfer.ts:9 — main: postgres
- scripts/resolve-youtube-sources.ts:21 — main: postgres
- scripts/migrate-auth.ts:11 — main: postgres
- scripts/migrate-huddle.ts:12 — main: postgres
- scripts/migrate-commerce.ts:13 — main: postgres
- scripts/video-source-health.ts:8 — main: postgres
- scripts/seed-video-sources.ts:9 — main: postgres
- scripts/migrate-three-and-out.ts:19 — main: postgres
- scripts/migrate-parlay-lab.ts:35 — main: postgres
- scripts/sync-production-content-to-local.ts:28 — main: postgres
- scripts/sync-production-content-to-local.ts:29 — main: postgres
- scripts/validate-source-sync.ts:10 — <module/anonymous>: postgres
- scripts/seed-trivia.ts:55 — main: postgres
- scripts/sync-parlay-lab-odds-to-production.ts:57 — main: postgres
- scripts/sync-parlay-lab-odds-to-production.ts:58 — main: postgres
- scripts/migrate-front-office.ts:12 — main: postgres
- scripts/parlay-lab-audit.ts:71 — audit: postgres
- src/server/search/database.ts:11 — searchDb: postgres
- src/server/auth/database.ts:15 — authDb: postgres

The JSON contains every detected SQL text, enclosing function, syntactic callers, table declaration and template-interpolation flag (values and identifiers). Tests, generated dependencies and compiled output are excluded. Each unmigrated operation remains a release blocker; staged typed tables still need full route compatibility qualification.
