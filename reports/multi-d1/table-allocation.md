# Complete baseline table allocation

TEAM_OWNER means exactly one owning team shard, not eight copies. LOCAL_INTERNAL is a separate local namespace in each populated DB. FTS shadow tables follow app_search. USER includes transactional social, commerce, trivia and notification state. This is a design allocation, not deployed DDL.

| Table | Allocation | SQL FK targets |
|---|---|---|
| app_ai_cache | SHARED | — |
| app_application_settings | SHARED | — |
| app_assertions | LOCAL_INTERNAL | — |
| app_briefing_mail_jobs | USER | — |
| app_briefing_push_deliveries | USER | app_users |
| app_commerce_counters | SHARED | — |
| app_commerce_inventory_adjustments | SHARED | app_users, app_commerce_product_variants |
| app_commerce_order_items | USER | app_commerce_product_variants, app_commerce_products, app_commerce_orders |
| app_commerce_orders | USER | app_users |
| app_commerce_product_variants | SHARED | app_commerce_products |
| app_commerce_products | SHARED | — |
| app_commerce_promo_codes | SHARED | — |
| app_commerce_refunds | USER | app_users, app_commerce_orders |
| app_commerce_stripe_webhook_events | USER | app_commerce_orders |
| app_consents | USER | app_users |
| app_content_automation_runs | TEAM_OWNER | — |
| app_credentials | USER | app_users |
| app_crew_activity | USER | app_users, app_crews |
| app_crew_comments | USER | app_users, app_crew_activity |
| app_crew_invites | USER | app_users, app_users, app_crews |
| app_crew_media | USER | app_users, app_crews |
| app_crew_members | USER | app_users, app_crews |
| app_crew_reactions | USER | app_users, app_crew_activity |
| app_crew_share_recipients | USER | app_users, app_crew_shares |
| app_crew_shares | USER | app_users, app_crews |
| app_crews | USER | app_users |
| app_daily_briefings | TEAM_OWNER | — |
| app_devices | USER | app_users |
| app_editorial_candidates | TEAM_OWNER | app_editorial_sources |
| app_editorial_decisions | TEAM_OWNER | app_editorial_stories |
| app_editorial_events | TEAM_OWNER | app_editorial_stories |
| app_editorial_evidence | TEAM_OWNER | app_editorial_sources, app_editorial_candidates, app_editorial_stories |
| app_editorial_jobs | TEAM_OWNER | — |
| app_editorial_overrides | TEAM_OWNER | app_users |
| app_editorial_sources | SHARED | — |
| app_editorial_stories | TEAM_OWNER | — |
| app_editorial_versions | TEAM_OWNER | app_editorial_stories |
| app_email_change_requests | USER | app_users |
| app_fan_pulse_reactions | USER | app_users |
| app_franchise_commands | USER | app_franchise_heads, app_franchise_heads, app_users |
| app_franchise_heads | USER | app_users |
| app_franchise_routes | USER | app_franchise_heads, app_franchise_heads |
| app_game_day_activity | USER | app_users, app_game_day_rooms |
| app_game_day_events | USER | app_game_day_rooms |
| app_game_day_predictions | USER | app_users, app_game_day_rooms |
| app_game_day_reactions | USER | app_users, app_game_day_activity |
| app_game_day_room_members | USER | app_users, app_game_day_rooms |
| app_game_day_rooms | USER | app_users |
| app_heads | USER | app_users |
| app_history_packs | SHARED | — |
| app_huddle_enforcement | USER | app_users, app_users |
| app_huddle_messages | USER | app_huddle_messages, app_users |
| app_huddle_poll_votes | USER | app_users, app_huddle_polls |
| app_huddle_polls | USER | — |
| app_huddle_reactions | USER | app_users, app_huddle_messages |
| app_huddle_reports | USER | app_users, app_huddle_messages |
| app_huddle_user_filters | USER | app_users, app_users |
| app_identities | USER | app_users |
| app_imports | SHARED | — |
| app_limits | SHARED | — |
| app_mail | USER | app_users |
| app_notification_deliveries | USER | app_devices, app_notifications |
| app_notification_preferences | USER | app_users |
| app_notifications | USER | app_users |
| app_observer_events | SHARED | app_editorial_stories, app_observer_runs |
| app_observer_items | SHARED | app_editorial_sources, app_editorial_candidates, app_observer_runs |
| app_observer_runs | SHARED | — |
| app_odds_board_history | TEAM_OWNER | app_sportsbook_events |
| app_odds_history | TEAM_OWNER | — |
| app_odds_processing | TEAM_OWNER | — |
| app_odds_publication | TEAM_OWNER | — |
| app_parlay_scores | TEAM_OWNER | app_sportsbook_events |
| app_payload_capacity | LOCAL_INTERNAL | — |
| app_payload_chunks | LOCAL_INTERNAL | app_payload_objects |
| app_payload_objects | LOCAL_INTERNAL | — |
| app_phone_numbers | USER | app_users |
| app_public_stories | TEAM_OWNER | — |
| app_public_story_versions | TEAM_OWNER | — |
| app_public_wire | TEAM_OWNER | — |
| app_push_tokens | USER | app_devices, app_users |
| app_receipts | USER | app_users |
| app_reference_import_lock | SHARED | — |
| app_reference_packs | SHARED | — |
| app_reference_version | SHARED | — |
| app_reward_accounts | USER | app_users |
| app_reward_definitions | SHARED | — |
| app_reward_events | USER | app_users |
| app_reward_notifications | USER | app_reward_definitions, app_users |
| app_saved_content | USER | app_users |
| app_search | TEAM_OWNER | — |
| app_search_config | TEAM_OWNER | — |
| app_search_content | TEAM_OWNER | — |
| app_search_data | TEAM_OWNER | — |
| app_search_docsize | TEAM_OWNER | — |
| app_search_idx | TEAM_OWNER | — |
| app_security_audit | USER | app_users |
| app_sessions | USER | app_devices, app_users |
| app_settings | USER | app_users |
| app_social_notification_outbox | USER | app_users |
| app_sportsbook_events | TEAM_OWNER | — |
| app_sportsbook_market_ids | TEAM_OWNER | app_sportsbook_events |
| app_sportsbook_transfer_jobs | USER | — |
| app_storage_candidate_receipts | LOCAL_INTERNAL | — |
| app_storage_epoch | LOCAL_INTERNAL | — |
| app_storage_gc_audit | LOCAL_INTERNAL | — |
| app_storage_gc_candidates | LOCAL_INTERNAL | app_storage_gc_plans |
| app_storage_gc_plans | LOCAL_INTERNAL | — |
| app_storage_guards | LOCAL_INTERNAL | — |
| app_storage_lifecycle_totals | LOCAL_INTERNAL | — |
| app_storage_pins | LOCAL_INTERNAL | — |
| app_storage_retention_audit | LOCAL_INTERNAL | — |
| app_storage_retention_items | LOCAL_INTERNAL | app_storage_retention_plans |
| app_storage_retention_plans | LOCAL_INTERNAL | — |
| app_story_game_links | TEAM_OWNER | — |
| app_story_overrides | TEAM_OWNER | app_editorial_stories |
| app_subscriptions | USER | app_users |
| app_team_follows | USER | app_users |
| app_tokens | USER | app_users |
| app_trivia_answers | USER | app_trivia_questions, app_trivia_daily, app_users |
| app_trivia_challenges | USER | app_trivia_games, app_users, app_users |
| app_trivia_daily | SHARED | app_trivia_questions |
| app_trivia_event_registrations | USER | app_trivia_games, app_users, app_trivia_events |
| app_trivia_events | USER | app_trivia_games |
| app_trivia_friendships | USER | app_users, app_users |
| app_trivia_game_answers | USER | app_trivia_games, app_trivia_questions, app_users |
| app_trivia_game_participants | USER | app_users, app_trivia_games |
| app_trivia_game_questions | USER | app_trivia_questions, app_trivia_games |
| app_trivia_games | USER | app_users |
| app_trivia_groups | USER | app_users, app_trivia_games |
| app_trivia_invitations | USER | app_users, app_users, app_trivia_games |
| app_trivia_questions | SHARED | — |
| app_trivia_rank_snapshots | USER | app_users, app_trivia_games |
| app_trivia_stats | USER | app_users |
| app_trivia_views | USER | app_trivia_daily, app_users |
| app_user_content_state | USER | app_users |
| app_user_poll_votes | USER | app_users |
| app_user_predictions | USER | app_users |
| app_user_rewards | USER | app_reward_definitions, app_users |
| app_user_team_visit_state | USER | app_users |
| app_users | USER | — |
| app_web_push_test_limits | USER | app_users |
| archive_chunks | TEAM_OWNER | — |
| archive_records | TEAM_OWNER | archive_chunks |
| candidate_teams | TEAM_OWNER | nfl_teams, content_candidates |
| canonical_stories | TEAM_OWNER | nfl_teams |
| content_candidate_revisions | TEAM_OWNER | content_candidates |
| content_candidates | TEAM_OWNER | content_sources |
| content_control | SHARED | — |
| content_outbox | SHARED | — |
| content_run_log | SHARED | — |
| content_sources | SHARED | nfl_teams |
| editorial_blob_fragments | TEAM_OWNER | editorial_blobs |
| editorial_blob_packs | TEAM_OWNER | — |
| editorial_blobs | TEAM_OWNER | editorial_blob_packs |
| editorial_cards | TEAM_OWNER | story_versions, story_versions, canonical_stories |
| film_room_video_teams | TEAM_OWNER | film_room_videos, nfl_teams |
| film_room_videos | TEAM_OWNER | content_sources |
| ingestion_jobs | TEAM_OWNER | nfl_teams, content_candidates, content_sources |
| lean_heads | TEAM_OWNER | — |
| lean_receipts | TEAM_OWNER | — |
| lean_teams | TEAM_OWNER | lean_heads, lean_heads, lean_heads, nfl_teams |
| lean_versions | TEAM_OWNER | lean_heads, lean_heads, lean_heads |
| nfl_teams | SHARED | — |
| observer_run_events | SHARED | canonical_stories, content_run_log |
| observer_run_items | SHARED | content_candidates, content_run_log |
| odds_refresh_slots | TEAM_OWNER | — |
| public_schedule | SHARED | — |
| r2_archive_manifests | TEAM_OWNER | — |
| r2_archive_records | TEAM_OWNER | r2_archive_manifests |
| source_check_daily | SHARED | content_sources |
| source_checkpoints | SHARED | content_sources |
| source_checks | SHARED | content_sources |
| source_teams | SHARED | nfl_teams, content_sources |
| story_domain_events | TEAM_OWNER | canonical_stories |
| story_editorial_overrides | TEAM_OWNER | nfl_teams, canonical_stories |
| story_entities | TEAM_OWNER | canonical_stories |
| story_evidence | TEAM_OWNER | content_candidates, content_candidates, content_sources, content_candidates, canonical_stories |
| story_publication_decisions | TEAM_OWNER | story_versions, story_versions, canonical_stories |
| story_versions | TEAM_OWNER | canonical_stories |
| three_and_out_snapshots | TEAM_OWNER | nfl_teams |
| transaction_assertions | LOCAL_INTERNAL | — |
| video_source_registry | SHARED | content_sources |
