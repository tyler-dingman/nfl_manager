# D1 feasibility — complete table inventory

Snapshot: September 27, 2026. **101 migration-defined tables; 76 present locally, 25 absent locally.** No production queries. Counts below are exact localhost aggregate counts, not production estimates. Local schema is incomplete; absent means unverified, not zero.

Categories: A user/transactional; B public/shared; C ingestion/processing; D search/derived; E cache/rebuildable; F operations/automation. Frequency/retention/transaction notes are code-based assessments, not telemetry. All schema details below are source definitions plus ordered alterations, not an executed final-schema reconstruction. Local catalog metadata provides a second view only for installed tables.

Every table section includes complete CREATE/ALTER/index definitions, thereby retaining PKs, FKs, checks, unique constraints, defaults, JSON, arrays, UUID, dates, large text, generated columns and sequences where declared. No user-defined trigger/function definitions were found in migrations; local catalog reports 0 user triggers. `search_documents` requires vector extension; local has only plpgsql. `commerce_order_number_seq` is declared in migration 023; `sportsbook_price_snapshots.id` uses bigserial. No explicit identity columns found.

## Summary

| Table | Class | Local rows | PostgreSQL table+index bytes | Purpose |
|---|---|---:|---:|---|
| [auth_tokens](#auth-tokens) | A | 0 | 32768 | Expiring single-use verification/reset/OAuth handoff tokens |
| [bet_markets](#bet-markets) | B | 44227 | 98148352 | Normalized event/player prop definitions and alternate lines |
| [canonical_stories](#canonical-stories) | B | 0 | 57344 | Published summarized NFL developments and structured meaning |
| [commerce_inventory_adjustments](#commerce-inventory-adjustments) | A | absent | unknown | Commerce inventory adjustments |
| [commerce_order_items](#commerce-order-items) | A | absent | unknown | Commerce order items |
| [commerce_orders](#commerce-orders) | A | absent | unknown | Checkout ownership, totals, lifecycle and payment identifiers |
| [commerce_product_variants](#commerce-product-variants) | B | absent | unknown | Commerce product variants |
| [commerce_products](#commerce-products) | B | absent | unknown | Commerce products |
| [commerce_promo_codes](#commerce-promo-codes) | B | absent | unknown | Commerce promo codes |
| [commerce_refunds](#commerce-refunds) | A | absent | unknown | Idempotent refund requests and outcomes |
| [commerce_stripe_webhook_events](#commerce-stripe-webhook-events) | A | absent | unknown | Webhook deduplication and processing state |
| [content_automation_runs](#content-automation-runs) | F | absent | unknown | Content automation runs |
| [content_automation_trial_runs](#content-automation-trial-runs) | F | absent | unknown | Content automation trial runs |
| [content_candidates](#content-candidates) | C | 0 | 49152 | Parsed source item, raw text, extracted entities and processing status |
| [content_sources](#content-sources) | B | 3 | 49152 | Content sources |
| [crew_activity](#crew-activity) | A | 1 | 49152 | Crew activity |
| [crew_comments](#crew-comments) | A | 0 | 24576 | Crew comments |
| [crew_invites](#crew-invites) | A | 0 | 40960 | Crew invites |
| [crew_media](#crew-media) | A | 1 | 106496 | Uploaded crew image bytes (currently bytea, not only a reference) |
| [crew_members](#crew-members) | A | 1 | 81920 | Crew members |
| [crew_reactions](#crew-reactions) | A | 0 | 16384 | Crew reactions |
| [crew_share_recipients](#crew-share-recipients) | A | 0 | 16384 | Crew share recipients |
| [crew_shares](#crew-shares) | A | 0 | 32768 | Crew shares |
| [crews](#crews) | A | 1 | 32768 | Crews |
| [devices](#devices) | A | 0 | 16384 | Authentication device ownership |
| [email_change_requests](#email-change-requests) | A | 0 | 32768 | Email change requests |
| [fan_pulse_reactions](#fan-pulse-reactions) | A | absent | unknown | Fan pulse reactions |
| [front_office_events](#front-office-events) | A | 587 | 1105920 | Per-franchise generated news and actionable event state |
| [front_office_trade_offers](#front-office-trade-offers) | A | 0 | 24576 | Per-franchise trade proposals and decision state |
| [game_day_activity](#game-day-activity) | A | absent | unknown | Game day activity |
| [game_day_events](#game-day-events) | A | absent | unknown | Game day events |
| [game_day_predictions](#game-day-predictions) | A | absent | unknown | Game day predictions |
| [game_day_reactions](#game-day-reactions) | A | absent | unknown | Game day reactions |
| [game_day_room_members](#game-day-room-members) | A | absent | unknown | Game day room members |
| [game_day_rooms](#game-day-rooms) | A | absent | unknown | Game day rooms |
| [historical_games](#historical-games) | B | 816 | 425984 | Canonical schedule/results; referenced by historical statistics |
| [historical_player_games](#historical-player-games) | B | 38964 | 16760832 | Per-player per-game historical numeric performance |
| [historical_team_games](#historical-team-games) | B | 1632 | 638976 | Per-team per-game historical statistics |
| [historical_team_season_strength](#historical-team-season-strength) | D | 96 | 106496 | Derived opponent defense ranks and season aggregates |
| [ingestion_jobs](#ingestion-jobs) | C | 0 | 32768 | Ingestion jobs |
| [move_the_chains_accounts](#move-the-chains-accounts) | A | 2 | 24576 | Current yard/touchdown counters |
| [move_the_chains_events](#move-the-chains-events) | A | 4 | 49152 | Idempotent point/yard award ledger |
| [notification_deliveries](#notification-deliveries) | F | 0 | 16384 | Notification deliveries |
| [notification_events](#notification-events) | F | 0 | 32768 | Notification events |
| [observer_run_events](#observer-run-events) | F | absent | unknown | Observer run events |
| [observer_run_items](#observer-run-items) | F | absent | unknown | Observer run items |
| [observer_runs](#observer-runs) | F | absent | unknown | Observer runs |
| [provider_player_mappings](#provider-player-mappings) | B | 2233 | 442368 | Provider player mappings |
| [provider_team_mappings](#provider-team-mappings) | B | 62 | 32768 | Provider team mappings |
| [reward_definitions](#reward-definitions) | B | 8 | 32768 | Reward definitions |
| [search_documents](#search-documents) | D | absent | unknown | Rebuildable chunks, hashes, lexical generated vector and optional embeddings |
| [security_audit_events](#security-audit-events) | F | 0 | 32768 | Security audit events |
| [sessions](#sessions) | A | 4 | 81920 | Refresh token hashes, family rotation and revocation |
| [sportsbook_events](#sportsbook-events) | B | 15 | 65536 | Sportsbook events |
| [sportsbook_price_snapshots](#sportsbook-price-snapshots) | B | 74709 | 8814592 | Append-only historical price captures |
| [sportsbook_prices](#sportsbook-prices) | B | 74709 | 29368320 | Latest per-market/book odds and availability |
| [story_domain_events](#story-domain-events) | F | 0 | 32768 | Story domain events |
| [story_editorial_overrides](#story-editorial-overrides) | B | 0 | 24576 | Story editorial overrides |
| [story_evidence](#story-evidence) | C | 0 | 40960 | Canonical-story/source-candidate associations and provenance |
| [story_publication_decisions](#story-publication-decisions) | F | 0 | 24576 | Story publication decisions |
| [story_versions](#story-versions) | C | 0 | 32768 | Version history of generated canonical summaries |
| [three_and_out_push_deliveries](#three-and-out-push-deliveries) | F | 0 | 24576 | Delivery idempotency claims, attempts and outcomes |
| [three_and_out_snapshots](#three-and-out-snapshots) | E | 0 | 32768 | Published daily briefing versions/items; derived but preserve delivered history |
| [trivia_answers](#trivia-answers) | A | 5 | 98304 | Trivia answers |
| [trivia_challenges](#trivia-challenges) | A | 0 | 24576 | Trivia challenges |
| [trivia_daily_questions](#trivia-daily-questions) | B | 9 | 49152 | Trivia daily questions |
| [trivia_daily_views](#trivia-daily-views) | A | 9 | 24576 | Trivia daily views |
| [trivia_event_registrations](#trivia-event-registrations) | A | absent | unknown | Trivia event registrations |
| [trivia_events](#trivia-events) | B | absent | unknown | Trivia events |
| [trivia_friendships](#trivia-friendships) | A | 0 | 24576 | Trivia friendships |
| [trivia_game_participants](#trivia-game-participants) | A | 8 | 49152 | Trivia game participants |
| [trivia_game_questions](#trivia-game-questions) | A | 75 | 49152 | Trivia game questions |
| [trivia_games](#trivia-games) | A | 8 | 49152 | Trivia games |
| [trivia_groups](#trivia-groups) | A | 2 | 81920 | Trivia groups |
| [trivia_invitations](#trivia-invitations) | A | 1 | 65536 | Trivia invitations |
| [trivia_questions](#trivia-questions) | B | 320 | 229376 | Trivia questions |
| [trivia_rank_snapshots](#trivia-rank-snapshots) | D | 0 | 8192 | Trivia rank snapshots |
| [trivia_stats](#trivia-stats) | D | 2 | 57344 | Trivia stats |
| [user_consents](#user-consents) | A | 0 | 24576 | User consents |
| [user_content_state](#user-content-state) | A | 4 | 65536 | User content state |
| [user_credentials](#user-credentials) | A | 0 | 16384 | Password hashes and lockout state |
| [user_devices](#user-devices) | A | 0 | 24576 | Notification installations and browser devices |
| [user_front_office_saves](#user-front-office-saves) | A | 4 | 131072 | Owned franchise metadata, version and full JSON simulation |
| [user_identities](#user-identities) | A | 1 | 65536 | External/provider login identities and linking |
| [user_notification_preferences](#user-notification-preferences) | A | 6 | 409600 | Per-channel/category/topic settings and Three & Out local delivery schedule |
| [user_notifications](#user-notifications) | A | 0 | 24576 | User notifications |
| [user_phone_numbers](#user-phone-numbers) | A | 0 | 24576 | User phone numbers |
| [user_player_follows](#user-player-follows) | A | 0 | 32768 | User player follows |
| [user_poll_votes](#user-poll-votes) | A | 1 | 49152 | User poll votes |
| [user_predictions](#user-predictions) | A | 0 | 24576 | User predictions |
| [user_preferences](#user-preferences) | A | 1 | 32768 | Favorite team and account-wide preferences |
| [user_profiles](#user-profiles) | A | 3 | 32768 | Locale, timezone, public profile and account settings |
| [user_push_tokens](#user-push-tokens) | A | 0 | 32768 | Encrypted provider credentials / web subscription endpoints |
| [user_quiet_hours](#user-quiet-hours) | A | 0 | 24576 | User quiet hours |
| [user_rewards](#user-rewards) | A | 0 | 40960 | Per-user reward unlock, claim and redemption state |
| [user_saved_content](#user-saved-content) | A | 1 | 65536 | User saved content |
| [user_team_follows](#user-team-follows) | A | 21 | 114688 | User team follows |
| [user_team_visit_state](#user-team-visit-state) | A | 10 | 212992 | User team visit state |
| [users](#users) | A | 3 | 49152 | Identity/status and profile references |
| [video_source_registry](#video-source-registry) | B | absent | unknown | Video source registry |
| [web_push_test_limits](#web-push-test-limits) | F | absent | unknown | Web push test limits |

## auth tokens

**Table:** `auth_tokens` · **Class A** · **Purpose:** Expiring single-use verification/reset/OAuth handoff tokens.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/auth/repository.ts`:317, 318, 327

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| type | text | NO | `none` |
| token_hash | text | NO | `none` |
| payload | jsonb | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| expires_at | timestamptz | NO | `none` |
| consumed_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'OAUTH_STATE')),
  token_hash text NOT NULL UNIQUE,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
```

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE INDEX IF NOT EXISTS auth_tokens_user_type_idx ON auth_tokens(user_id, type);
```


## bet markets

**Table:** `bet_markets` · **Class B** · **Purpose:** Normalized event/player prop definitions and alternate lines.

**Local count:** 44227. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/schedule/next-up.ts`:19; `src/server/search/stored-betting.ts`:27; `src/server/odds/repository.ts`:37, 50, 60, 125; `src/app/api/parlay-lab/movement/route.ts`:13; `scripts/parlay-lab-audit.ts`:15, 153, 158; `scripts/sync-parlay-lab-odds-to-production.ts`:87, 95, 111, 115

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| event_id | uuid | NO | `none` |
| provider_market_id | text | NO | `none` |
| market_type | text | NO | `none` |
| stat_id | text | NO | `''::text` |
| entity_id | text | NO | `''::text` |
| player_id | text | YES | `none` |
| team_id | text | YES | `none` |
| period | text | NO | `'game'::text` |
| side | text | NO | `''::text` |
| line | numeric | YES | `none` |
| line_key | numeric | YES | `COALESCE(line, ('-999999'::integer)::numeric)` |
| normalized_key | text | NO | `none` |
| is_alt_line | bool | NO | `false` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| provider_market_name | text | YES | `none` |
| normalization_status | text | NO | `'KNOWN'::text` |
| raw_provider_metadata | jsonb | NO | `'{}'::jsonb` |

**Declared schema and ordered changes:**

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE TABLE IF NOT EXISTS bet_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES sportsbook_events(id) ON DELETE CASCADE,
  provider_market_id text NOT NULL,
  market_type text NOT NULL,
  stat_id text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  player_id text,
  team_id text,
  period text NOT NULL DEFAULT 'game',
  side text NOT NULL DEFAULT '',
  line numeric,
  line_key numeric GENERATED ALWAYS AS (coalesce(line, -999999)) STORED,
  normalized_key text NOT NULL,
  is_alt_line boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, provider_market_id, side, line_key),
  UNIQUE (event_id, normalized_key)
);
```

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE INDEX IF NOT EXISTS bet_markets_lookup_idx
  ON bet_markets(event_id, market_type, player_id, side, line);
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE bet_markets
  ADD COLUMN IF NOT EXISTS provider_market_name text,
  ADD COLUMN IF NOT EXISTS normalization_status text NOT NULL DEFAULT 'KNOWN',
  ADD COLUMN IF NOT EXISTS raw_provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE bet_markets DROP CONSTRAINT IF EXISTS bet_markets_normalization_status_check;
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE bet_markets ADD CONSTRAINT bet_markets_normalization_status_check
  CHECK (normalization_status IN ('KNOWN', 'PARTIALLY_MAPPED', 'UNMAPPED'));
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
CREATE INDEX IF NOT EXISTS bet_markets_normalization_status_idx
  ON bet_markets (normalization_status, market_type);
```


## canonical stories

**Table:** `canonical_stories` · **Class B** · **Purpose:** Published summarized NFL developments and structured meaning.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/schedule/enrich.ts`:12, 51; `src/server/content/content-health.ts`:41; `src/server/story-engine/repository.ts`:199, 212, 218, 223, 278, 384, 423, 427, 474, 518; `src/server/story-engine/projections.ts`:39, 141, 148, 204; `src/server/search/indexer.ts`:19, 24; `src/server/search/answer-data.ts`:222; `src/server/monitoring/observer.ts`:67, 150; `scripts/content-ollama-stress-test.ts`:95; `scripts/capture-beat-semantic-baseline.ts`:10; `scripts/verify-beat-semantic-backfill.ts`:16; `scripts/sync-production-content-to-local.ts`:8, 45; `scripts/backfill-beat-transactions.ts`:11, 24; `scripts/backfill-beat-semantics.ts`:38, 97, 126; `scripts/sync-nfl-schedule.ts`:28

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| team_id | text | YES | `none` |
| story_type | text | NO | `'ANALYSIS'::text` |
| headline | text | NO | `none` |
| summary | text | NO | `none` |
| what_happened | text | NO | `none` |
| why_it_matters | text | NO | `''::text` |
| whats_next | text | NO | `''::text` |
| status | text | NO | `none` |
| publication_state | text | NO | `'DRAFT'::text` |
| importance_score | int4 | NO | `none` |
| confidence_score | int4 | NO | `none` |
| entities | jsonb | NO | `'[]'::jsonb` |
| first_reported_at | timestamptz | NO | `none` |
| last_meaningful_update_at | timestamptz | NO | `none` |
| version | int4 | NO | `1` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| game_id | uuid | YES | `none` |
| game_resolution | jsonb | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS canonical_stories (
  id uuid PRIMARY KEY,
  team_id text,
  story_type text NOT NULL DEFAULT 'ANALYSIS',
  headline text NOT NULL,
  summary text NOT NULL,
  what_happened text NOT NULL,
  why_it_matters text NOT NULL DEFAULT '',
  whats_next text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('BREAKING','DEVELOPING','HOLDING','RESOLVED')),
  publication_state text NOT NULL DEFAULT 'DRAFT' CHECK (publication_state IN ('DRAFT','AUTO_PUBLISHED','REVIEW_REQUIRED','PUBLISHED','REJECTED')),
  importance_score integer NOT NULL CHECK (importance_score BETWEEN 0 AND 100),
  confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_reported_at timestamptz NOT NULL,
  last_meaningful_update_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS canonical_stories_team_idx ON canonical_stories(team_id,last_meaningful_update_at DESC);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS canonical_stories_status_idx ON canonical_stories(status);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS canonical_stories_importance_idx ON canonical_stories(importance_score DESC);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS canonical_stories_updated_idx ON canonical_stories(last_meaningful_update_at DESC);
```

Source: `db/migrations/019_story_corroboration.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS source_item_count integer NOT NULL DEFAULT 1;
```

Source: `db/migrations/019_story_corroboration.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS publisher_count integer NOT NULL DEFAULT 1;
```

Source: `db/migrations/019_story_corroboration.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS independent_source_count integer NOT NULL DEFAULT 1;
```

Source: `db/migrations/019_story_corroboration.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS hot_read_qualified_at timestamptz;
```

Source: `db/migrations/019_story_corroboration.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS hot_read_until timestamptz;
```

Source: `db/migrations/019_story_corroboration.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS cluster_reason text;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES historical_games(id);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS game_resolution jsonb;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE INDEX IF NOT EXISTS canonical_stories_game_idx ON canonical_stories(game_id);
```

Source: `db/migrations/043_beat_transaction_metadata.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS transaction_metadata jsonb;
```

Source: `db/migrations/044_beat_visual_classification.sql`

```sql
ALTER TABLE canonical_stories ADD COLUMN IF NOT EXISTS visual_classification jsonb;
```


## commerce inventory adjustments

**Table:** `commerce_inventory_adjustments` · **Class A** · **Purpose:** Commerce inventory adjustments.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/commerce/admin.ts`:59, 93

**Declared schema and ordered changes:**

Source: `db/migrations/023_commerce.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_inventory_adjustments (
  id uuid PRIMARY KEY,
  variant_id text NOT NULL REFERENCES commerce_product_variants(id),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  quantity_delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```


## commerce order items

**Table:** `commerce_order_items` · **Class A** · **Purpose:** Commerce order items.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/commerce/stripe.ts`:357, 363, 384, 397; `src/server/commerce/orders.ts`:138, 237, 302, 308, 335, 373

**Declared schema and ordered changes:**

Source: `db/migrations/023_commerce.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES commerce_products(id),
  variant_id text NOT NULL REFERENCES commerce_product_variants(id),
  sku text NOT NULL,
  product_name text NOT NULL,
  variant_label text NOT NULL,
  image_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/023_commerce.sql`

```sql
CREATE INDEX IF NOT EXISTS commerce_order_items_order_idx ON commerce_order_items(order_id);
```


## commerce orders

**Table:** `commerce_orders` · **Class A** · **Purpose:** Checkout ownership, totals, lifecycle and payment identifiers.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/commerce/stripe.ts`:117, 124, 143, 215, 220, 331, 368, 377, 389; `src/server/commerce/admin.ts`:27, 39; `src/server/commerce/orders.ts`:134, 175, 208, 222, 270, 286, 310, 320, 335, 373, 420, 426, 429

**Declared schema and ordered changes:**

Source: `db/migrations/023_commerce.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_orders (
  id uuid PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','PAID','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_status text NOT NULL CHECK (payment_status IN ('PENDING','PAID','DECLINED','REFUNDED')),
  fulfillment_status text NOT NULL DEFAULT 'NEW' CHECK (fulfillment_status IN ('NEW','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_provider text NOT NULL,
  payment_reference text,
  subtotal_cents integer NOT NULL,
  discount_total_cents integer NOT NULL DEFAULT 0,
  shipping_total_cents integer NOT NULL,
  tax_total_cents integer NOT NULL,
  total_cents integer NOT NULL,
  promo_code text,
  shipping_address jsonb NOT NULL,
  shipping_method text NOT NULL,
  carrier text,
  tracking_number text,
  internal_note text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/023_commerce.sql`

```sql
CREATE INDEX IF NOT EXISTS commerce_orders_user_idx ON commerce_orders(user_id,created_at DESC);
```

Source: `db/migrations/023_commerce.sql`

```sql
CREATE INDEX IF NOT EXISTS commerce_orders_status_idx ON commerce_orders(fulfillment_status,created_at DESC);
```

Source: `db/migrations/023_commerce.sql`

```sql
CREATE INDEX IF NOT EXISTS commerce_orders_email_idx ON commerce_orders(lower(email),created_at DESC);
```

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_payment_status_check;
```

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_payment_status_check
  CHECK (payment_status IN (
    'PENDING',
    'PAID',
    'DECLINED',
    'FAILED',
    'CANCELED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
  ));
```

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
```

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';
```

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
```

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS commerce_orders_stripe_payment_intent_idx
  ON commerce_orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
```

Source: `db/migrations/025_stripe_checkout_attempts.sql`

```sql
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS checkout_attempt_id uuid;
```

Source: `db/migrations/025_stripe_checkout_attempts.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS commerce_orders_checkout_attempt_idx
  ON commerce_orders(checkout_attempt_id) WHERE checkout_attempt_id IS NOT NULL;
```

Source: `db/migrations/026_commerce_payment_hardening.sql`

```sql
ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_payment_status_check;
```

Source: `db/migrations/026_commerce_payment_hardening.sql`

```sql
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_payment_status_check
  CHECK (payment_status IN (
    'PENDING','PAID','DECLINED','FAILED','CANCELED','REFUNDED','PARTIALLY_REFUNDED'
  ));
```

Source: `db/migrations/026_commerce_payment_hardening.sql`

```sql
ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS refunded_total_cents integer NOT NULL DEFAULT 0
    CHECK (refunded_total_cents >= 0),
  ADD COLUMN IF NOT EXISTS inventory_reservation_status text NOT NULL DEFAULT 'HELD'
    CHECK (inventory_reservation_status IN ('HELD','RELEASED','CONSUMED')),
  ADD COLUMN IF NOT EXISTS stripe_payment_event_created_at bigint,
  ADD COLUMN IF NOT EXISTS payment_attempt_started_at timestamptz;
```


## commerce product variants

**Table:** `commerce_product_variants` · **Class B** · **Purpose:** Commerce product variants.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/commerce/stripe.ts`:358, 361, 382, 395; `src/server/commerce/admin.ts`:13, 19, 43, 57, 92; `src/server/commerce/orders.ts`:60, 102, 130, 189, 216, 303, 306, 419, 425; `src/server/commerce/catalog.ts`:27, 38, 50

**Declared schema and ordered changes:**

Source: `db/migrations/023_commerce.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_product_variants (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  city_code text,
  city_name text,
  size text,
  color_label text,
  price_cents integer CHECK (price_cents >= 0),
  image_url text,
  inventory_on_hand integer NOT NULL DEFAULT 0 CHECK (inventory_on_hand >= 0),
  inventory_reserved integer NOT NULL DEFAULT 0 CHECK (inventory_reserved >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (inventory_reserved <= inventory_on_hand)
);
```

Source: `db/migrations/023_commerce.sql`

```sql
CREATE INDEX IF NOT EXISTS commerce_variants_product_idx ON commerce_product_variants(product_id,active);
```


## commerce products

**Table:** `commerce_products` · **Class B** · **Purpose:** Commerce products.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/commerce/admin.ts`:13, 19, 43, 69, 90; `src/server/commerce/orders.ts`:60, 102, 189; `src/server/commerce/catalog.ts`:16, 19, 35, 50

**Declared schema and ordered changes:**

Source: `db/migrations/023_commerce.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_products (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  base_price_cents integer NOT NULL CHECK (base_price_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```


## commerce promo codes

**Table:** `commerce_promo_codes` · **Class B** · **Purpose:** Commerce promo codes.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/commerce/admin.ts`:30; `src/server/commerce/orders.ts`:33, 142, 248

**Declared schema and ordered changes:**

Source: `db/migrations/023_commerce.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_promo_codes (
  code text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('PERCENT','FIXED')),
  value integer NOT NULL CHECK (value > 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  minimum_subtotal_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```


## commerce refunds

**Table:** `commerce_refunds` · **Class A** · **Purpose:** Idempotent refund requests and outcomes.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/commerce/stripe.ts`:121, 166, 171, 182, 183, 214, 228, 236, 263, 291; `src/server/commerce/admin.ts`:34, 36; `src/server/commerce/orders.ts`:334

**Declared schema and ordered changes:**

Source: `db/migrations/026_commerce_payment_hardening.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_refunds (
  id uuid PRIMARY KEY,
  request_id uuid UNIQUE,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  stripe_refund_id text UNIQUE,
  stripe_payment_intent_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('PENDING','REQUIRES_ACTION','SUCCEEDED','FAILED','CANCELED')),
  reason text,
  failure_reason text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  stripe_created_at timestamptz,
  stripe_event_created_at bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/026_commerce_payment_hardening.sql`

```sql
ALTER TABLE commerce_refunds ADD COLUMN IF NOT EXISTS stripe_event_created_at bigint;
```

Source: `db/migrations/026_commerce_payment_hardening.sql`

```sql
CREATE INDEX IF NOT EXISTS commerce_refunds_order_idx
  ON commerce_refunds(order_id, created_at DESC);
```


## commerce stripe webhook events

**Table:** `commerce_stripe_webhook_events` · **Class A** · **Purpose:** Webhook deduplication and processing state.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/commerce/stripe.ts`:137, 185, 311, 322, 400

**Declared schema and ordered changes:**

Source: `db/migrations/024_stripe_webhooks.sql`

```sql
CREATE TABLE IF NOT EXISTS commerce_stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  order_id uuid REFERENCES commerce_orders(id) ON DELETE SET NULL,
  result text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
```


## content automation runs

**Table:** `content_automation_runs` · **Class F** · **Purpose:** Content automation runs.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/content-automation/global-repository.ts`:7, 21

**Declared schema and ordered changes:**

Source: `db/migrations/028_content_automation_global.sql`

```sql
CREATE TABLE IF NOT EXISTS content_automation_runs (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  sources_due integer NOT NULL DEFAULT 0 CHECK (sources_due >= 0),
  sources_queued integer NOT NULL DEFAULT 0 CHECK (sources_queued >= 0),
  jobs_processed integer NOT NULL DEFAULT 0 CHECK (jobs_processed >= 0),
  generated_items integer NOT NULL DEFAULT 0 CHECK (generated_items >= 0),
  failed_jobs integer NOT NULL DEFAULT 0 CHECK (failed_jobs >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
```

Source: `db/migrations/028_content_automation_global.sql`

```sql
CREATE INDEX IF NOT EXISTS content_automation_runs_started_at_idx
  ON content_automation_runs(started_at DESC);
```


## content automation trial runs

**Table:** `content_automation_trial_runs` · **Class F** · **Purpose:** Content automation trial runs.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/content-automation/repository.ts`:8, 22, 33, 51

**Declared schema and ordered changes:**

Source: `db/migrations/027_content_automation_trial.sql`

```sql
CREATE TABLE IF NOT EXISTS content_automation_trial_runs (
  id uuid PRIMARY KEY,
  trial_starts_at timestamptz NOT NULL,
  trial_expires_at timestamptz NOT NULL,
  polling_group text NOT NULL CHECK (polling_group IN ('standard','video')),
  status text NOT NULL,
  generated_items integer NOT NULL DEFAULT 0 CHECK (generated_items >= 0),
  ai_spend_usd numeric(10,4) NOT NULL DEFAULT 0 CHECK (ai_spend_usd >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (trial_expires_at = trial_starts_at + interval '72 hours')
);
```

Source: `db/migrations/027_content_automation_trial.sql`

```sql
CREATE INDEX IF NOT EXISTS content_automation_trial_window_idx
  ON content_automation_trial_runs(trial_starts_at,trial_expires_at,started_at);
```


## content candidates

**Table:** `content_candidates` · **Class C** · **Purpose:** Parsed source item, raw text, extracted entities and processing status.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Ingestion-triggered writes; repeated matching/evidence reads (high during batches).

**Reconstructable:** Partly: sources may change/disappear; preserve provenance and hashes.

**Placement:** Compact relational metadata; raw bodies to retention-limited object storage.

**Transactions/locking:** Atomic job claim/story+evidence commit; lease/CAS replaces row locks.

**Code references:** `src/server/content/content-health.ts`:47; `src/server/film-room/discovered.ts`:86; `src/server/story-engine/repository.ts`:104, 118, 129, 169, 174, 225, 232, 262, 312, 417; `src/server/story-engine/projections.ts`:49, 157, 211; `src/server/search/indexer.ts`:23; `src/server/search/answer-data.ts`:223; `src/server/monitoring/observer.ts`:61; `scripts/content-ollama-stress-test.ts`:25, 68; `scripts/sync-production-content-to-local.ts`:7, 46; `scripts/video-source-health.ts`:18; `scripts/backfill-team-content.ts`:52, 63

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| source_id | text | NO | `none` |
| external_id | text | NO | `none` |
| canonical_url | text | NO | `none` |
| title | text | NO | `none` |
| normalized_title | text | NO | `none` |
| author | text | YES | `none` |
| published_at | timestamptz | NO | `none` |
| source_updated_at | timestamptz | YES | `none` |
| discovered_at | timestamptz | NO | `now()` |
| raw_text | text | NO | `''::text` |
| excerpt | text | NO | `''::text` |
| entities | jsonb | NO | `'[]'::jsonb` |
| candidate_teams | jsonb | NO | `'[]'::jsonb` |
| fingerprint | text | NO | `none` |
| status | text | NO | `'NEW'::text` |
| rejection_reason | text | YES | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS content_candidates (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES content_sources(id),
  external_id text NOT NULL,
  canonical_url text NOT NULL,
  title text NOT NULL,
  normalized_title text NOT NULL,
  author text,
  published_at timestamptz NOT NULL,
  source_updated_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  raw_text text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ANALYZED','DUPLICATE','CLUSTERED','REVIEW_REQUIRED','REJECTED','FAILED')),
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id,external_id)
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS content_candidates_fingerprint_idx ON content_candidates(fingerprint);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS content_candidates_source_idx ON content_candidates(source_id,discovered_at DESC);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS content_candidates_source_url_idx ON content_candidates(source_id,canonical_url);
```


## content sources

**Table:** `content_sources` · **Class B** · **Purpose:** Content sources.

**Local count:** 3. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/content/content-health.ts`:36, 47; `src/server/film-room/video-source-sync.ts`:518, 541; `src/server/film-room/discovered.ts`:87; `src/server/story-engine/repository.ts`:74, 75, 79, 99, 110, 119, 154, 162, 232, 422, 515, 518; `src/server/story-engine/projections.ts`:40, 49, 130, 136, 158, 205, 211; `src/server/search/indexer.ts`:23; `src/server/search/answer-data.ts`:223; `src/server/monitoring/observer.ts`:23, 61, 68, 142, 147, 281; `scripts/content-ollama-stress-test.ts`:25, 69; `scripts/sync-production-content-to-local.ts`:6, 65, 70; `scripts/resolve-youtube-sources.ts`:127

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | text | NO | `none` |
| name | text | NO | `none` |
| source_type | text | NO | `none` |
| team_id | text | YES | `none` |
| league_wide | bool | NO | `false` |
| url | text | NO | `none` |
| feed_url | text | YES | `none` |
| fetch_strategy | text | NO | `none` |
| polling_tier | text | NO | `'B'::text` |
| priority | int4 | NO | `50` |
| reliability_score | numeric | NO | `0.800` |
| check_interval_seconds | int4 | NO | `none` |
| enabled | bool | NO | `true` |
| etag | text | YES | `none` |
| last_modified | text | YES | `none` |
| last_checked_at | timestamptz | YES | `none` |
| last_successful_at | timestamptz | YES | `none` |
| next_check_at | timestamptz | NO | `now()` |
| failure_count | int4 | NO | `0` |
| last_error | text | YES | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS content_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('OFFICIAL_TEAM','NFL_OFFICIAL','LOCAL_BEAT','LOCAL_OUTLET','NATIONAL_REPORTER','NATIONAL_OUTLET','RSS','YOUTUBE','PODCAST','OTHER')),
  team_id text,
  league_wide boolean NOT NULL DEFAULT false,
  url text NOT NULL,
  feed_url text,
  fetch_strategy text NOT NULL CHECK (fetch_strategy IN ('RSS','HTML','STRUCTURED_API','FIXTURE')),
  polling_tier text NOT NULL DEFAULT 'B' CHECK (polling_tier IN ('A','B','C')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  reliability_score numeric(4,3) NOT NULL DEFAULT 0.800 CHECK (reliability_score BETWEEN 0 AND 1),
  check_interval_seconds integer NOT NULL CHECK (check_interval_seconds >= 60),
  enabled boolean NOT NULL DEFAULT true,
  etag text,
  last_modified text,
  last_checked_at timestamptz,
  last_successful_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (team_id IS NOT NULL OR league_wide = true)
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS content_sources_due_idx ON content_sources(enabled,next_check_at,priority DESC);
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS last_item_at timestamptz;
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS average_latency_ms numeric(12,2);
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS request_count bigint NOT NULL DEFAULT 0;
```


## crew activity

**Table:** `crew_activity` · **Class A** · **Purpose:** Crew activity.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:47, 84, 197, 233, 285, 336, 343, 350

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| crew_id | uuid | NO | `none` |
| actor_user_id | uuid | YES | `none` |
| type | text | NO | `none` |
| content_id | text | YES | `none` |
| content_type | text | YES | `none` |
| href | text | YES | `none` |
| message | text | YES | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/021_crews.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_activity (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  content_id text,
  content_type text,
  href text,
  message varchar(120),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/021_crews.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_activity_feed_idx ON crew_activity(crew_id,created_at DESC);
```

Source: `db/migrations/041_crew_feed_and_photos.sql`

```sql
ALTER TABLE crew_activity ALTER COLUMN message TYPE text;
```


## crew comments

**Table:** `crew_comments` · **Class A** · **Purpose:** Crew comments.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:45, 343

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| activity_id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| message | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/041_crew_feed_and_photos.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_comments (
  id uuid PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES crew_activity(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/041_crew_feed_and_photos.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_comments_activity_idx ON crew_comments(activity_id,created_at);
```


## crew invites

**Table:** `crew_invites` · **Class A** · **Purpose:** Crew invites.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:52, 106, 128, 160, 169, 177, 188, 196

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| crew_id | uuid | NO | `none` |
| inviter_user_id | uuid | NO | `none` |
| invitee_user_id | uuid | YES | `none` |
| recipient_hash | text | YES | `none` |
| recipient_hint | text | YES | `none` |
| token_hash | text | NO | `none` |
| channel | text | NO | `none` |
| status | text | NO | `'PENDING'::text` |
| delivery_state | text | NO | `'PENDING'::text` |
| expires_at | timestamptz | NO | `none` |
| accepted_at | timestamptz | YES | `none` |
| last_sent_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/021_crews.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_invites (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_hash text,
  recipient_hint text,
  token_hash text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('IN_APP','SMS','EMAIL','SHARE_LINK')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED')),
  delivery_state text NOT NULL DEFAULT 'PENDING' CHECK (delivery_state IN ('PENDING','SENT','FAILED','NOT_CONFIGURED','DELIVERED')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/021_crews.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_invites_crew_idx ON crew_invites(crew_id,status,created_at DESC);
```

Source: `db/migrations/021_crews.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS crew_invites_pending_recipient_idx ON crew_invites(crew_id,recipient_hash)
  WHERE status='PENDING' AND recipient_hash IS NOT NULL;
```


## crew media

**Table:** `crew_media` · **Class A** · **Purpose:** Uploaded crew image bytes (currently bytea, not only a reference).

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:295, 321, 330; `src/app/api/crew/media/[mediaId]/route.ts`:13

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| crew_id | uuid | NO | `none` |
| uploader_user_id | uuid | NO | `none` |
| mime_type | text | NO | `none` |
| content | bytea | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/041_crew_feed_and_photos.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_media (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  uploader_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/041_crew_feed_and_photos.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_media_crew_idx ON crew_media(crew_id);
```


## crew members

**Table:** `crew_members` · **Class A** · **Purpose:** Crew members.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/rewards/repository.ts`:125; `src/server/crew/repository.ts`:27, 37, 56, 79, 83, 100, 121, 168, 192, 194, 215, 221, 236, 267, 268, 285, 306, 313, 358; `src/app/api/crew/media/[mediaId]/route.ts`:13; `scripts/audit-crew.ts`:41, 189

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| crew_id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| role | text | NO | `none` |
| status | text | NO | `'ACTIVE'::text` |
| joined_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/021_crews.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_members (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER','MEMBER')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','LEFT','REMOVED')),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(crew_id,user_id)
);
```

Source: `db/migrations/021_crews.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS crew_members_one_active_crew_idx ON crew_members(user_id)
  WHERE status='ACTIVE';
```

Source: `db/migrations/021_crews.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_members_crew_idx ON crew_members(crew_id,status);
```


## crew reactions

**Table:** `crew_reactions` · **Class A** · **Purpose:** Crew reactions.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:47, 284

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| activity_id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| reaction | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/021_crews.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_reactions (
  activity_id uuid NOT NULL REFERENCES crew_activity(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('FIRE','LAUGH','EYES','LIKE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(activity_id,user_id,reaction)
);
```


## crew share recipients

**Table:** `crew_share_recipients` · **Class A** · **Purpose:** Crew share recipients.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:231

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| share_id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/022_crew_share_recipients.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_share_recipients (
  share_id uuid NOT NULL REFERENCES crew_shares(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(share_id,user_id)
);
```

Source: `db/migrations/022_crew_share_recipients.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_share_recipients_user_idx
  ON crew_share_recipients(user_id,created_at DESC);
```


## crew shares

**Table:** `crew_shares` · **Class A** · **Purpose:** Crew shares.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:228

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| crew_id | uuid | NO | `none` |
| sender_user_id | uuid | NO | `none` |
| visibility | text | NO | `none` |
| content_id | text | NO | `none` |
| content_type | text | NO | `none` |
| href | text | NO | `none` |
| title | varchar | NO | `none` |
| message | varchar | YES | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/022_crew_share_recipients.sql`

```sql
CREATE TABLE IF NOT EXISTS crew_shares (
  id uuid PRIMARY KEY,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('CREW','TARGETED')),
  content_id text NOT NULL,
  content_type text NOT NULL,
  href text NOT NULL,
  title varchar(180) NOT NULL,
  message varchar(120),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/022_crew_share_recipients.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_shares_crew_idx ON crew_shares(crew_id,created_at DESC);
```

Source: `db/migrations/022_crew_share_recipients.sql`

```sql
CREATE INDEX IF NOT EXISTS crew_shares_sender_idx ON crew_shares(sender_user_id,created_at DESC);
```


## crews

**Table:** `crews` · **Class A** · **Purpose:** Crews.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/crew/repository.ts`:25, 27, 29, 56, 82, 100, 169, 214, 267, 299

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| name | text | NO | `none` |
| team_abbr | text | NO | `none` |
| owner_user_id | uuid | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| photo_url | text | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/021_crews.sql`

```sql
CREATE TABLE IF NOT EXISTS crews (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  team_abbr text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/041_crew_feed_and_photos.sql`

```sql
ALTER TABLE crews ADD COLUMN IF NOT EXISTS photo_url text;
```


## devices

**Table:** `devices` · **Class A** · **Purpose:** Authentication device ownership.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/auth/repository.ts`:199, 200, 203, 205; `src/app/api/user/devices/route.ts`:19, 20

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| platform | text | YES | `none` |
| name | text | YES | `none` |
| push_token | text | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| last_seen_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text,
  name text,
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
```


## email change requests

**Table:** `email_change_requests` · **Class A** · **Purpose:** Email change requests.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/repository.ts`:81, 82, 89

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| new_email | text | NO | `none` |
| token_hash | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| expires_at | timestamptz | NO | `none` |
| consumed_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE TABLE IF NOT EXISTS email_change_requests (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email text NOT NULL, token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, consumed_at timestamptz
);
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE INDEX IF NOT EXISTS email_change_requests_user_idx ON email_change_requests(user_id);
```


## fan pulse reactions

**Table:** `fan_pulse_reactions` · **Class A** · **Purpose:** Fan pulse reactions.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/fan-pulse/repository.ts`:16, 26, 45

**Declared schema and ordered changes:**

Source: `db/migrations/029_fan_pulse.sql`

```sql
CREATE TABLE IF NOT EXISTS fan_pulse_reactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  team_id text NOT NULL,
  reaction_type text NOT NULL CHECK (
    reaction_type IN ('FIRED_UP', 'LIKE_IT', 'NOT_SURE', 'DONT_LOVE_IT', 'NO_WAY')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);
```

Source: `db/migrations/029_fan_pulse.sql`

```sql
CREATE INDEX IF NOT EXISTS fan_pulse_reactions_content_idx
  ON fan_pulse_reactions (content_id, reaction_type);
```

Source: `db/migrations/029_fan_pulse.sql`

```sql
CREATE INDEX IF NOT EXISTS fan_pulse_reactions_team_idx
  ON fan_pulse_reactions (team_id, updated_at DESC);
```


## front office events

**Table:** `front_office_events` · **Class A** · **Purpose:** Per-franchise generated news and actionable event state.

**Local count:** 587. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/front-office/events-repository.ts`:46, 82, 92, 105, 121, 131, 144, 158

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| id | text | NO | `none` |
| save_id | text | NO | `none` |
| dedupe_key | text | NO | `none` |
| type | text | NO | `none` |
| priority | text | NO | `none` |
| headline | text | NO | `none` |
| summary | text | NO | `none` |
| team_abbr | text | YES | `none` |
| related_team_abbr | text | YES | `none` |
| player_id | text | YES | `none` |
| prospect_id | text | YES | `none` |
| trade_offer_id | text | YES | `none` |
| simulation_season | int4 | NO | `none` |
| simulation_week | int4 | NO | `none` |
| simulation_phase | text | NO | `none` |
| action_url | text | YES | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| expires_at | timestamptz | YES | `none` |
| read_at | timestamptz | YES | `none` |
| dismissed_at | timestamptz | YES | `none` |
| surfaced_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/032_front_office_events.sql`

```sql
CREATE TABLE IF NOT EXISTS front_office_events (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  save_id text NOT NULL,
  dedupe_key text NOT NULL,
  type text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  headline text NOT NULL,
  summary text NOT NULL,
  team_abbr text,
  related_team_abbr text,
  player_id text,
  prospect_id text,
  trade_offer_id text,
  simulation_season integer NOT NULL,
  simulation_week integer NOT NULL,
  simulation_phase text NOT NULL,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  surfaced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, save_id, dedupe_key, simulation_season, simulation_week),
  FOREIGN KEY (user_id, save_id)
    REFERENCES user_front_office_saves(user_id, save_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, trade_offer_id)
    REFERENCES front_office_trade_offers(user_id, id) ON DELETE SET NULL
);
```

Source: `db/migrations/032_front_office_events.sql`

```sql
CREATE INDEX IF NOT EXISTS front_office_events_inbox_idx
  ON front_office_events(user_id, save_id, read_at, created_at DESC);
```

Source: `db/migrations/032_front_office_events.sql`

```sql
CREATE INDEX IF NOT EXISTS front_office_events_surface_idx
  ON front_office_events(user_id, save_id, surfaced_at, priority, created_at);
```


## front office trade offers

**Table:** `front_office_trade_offers` · **Class A** · **Purpose:** Per-franchise trade proposals and decision state.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/front-office/events-repository.ts`:178, 190, 200, 210

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| id | text | NO | `none` |
| save_id | text | NO | `none` |
| proposing_team_abbr | text | NO | `none` |
| receiving_team_abbr | text | NO | `none` |
| offer_data | jsonb | NO | `none` |
| created_week | int4 | NO | `none` |
| expires_week | int4 | NO | `none` |
| status | text | NO | `'pending'::text` |
| responded_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/032_front_office_events.sql`

```sql
CREATE TABLE IF NOT EXISTS front_office_trade_offers (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  save_id text NOT NULL,
  proposing_team_abbr text NOT NULL,
  receiving_team_abbr text NOT NULL,
  offer_data jsonb NOT NULL,
  created_week integer NOT NULL,
  expires_week integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, save_id)
    REFERENCES user_front_office_saves(user_id, save_id) ON DELETE CASCADE
);
```

Source: `db/migrations/032_front_office_events.sql`

```sql
CREATE INDEX IF NOT EXISTS front_office_trade_offers_pending_idx
  ON front_office_trade_offers(user_id, save_id, status, expires_week);
```


## game day activity

**Table:** `game_day_activity` · **Class A** · **Purpose:** Game day activity.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/game-day/repository.ts`:44, 93, 99, 134, 139, 167

**Declared schema and ordered changes:**

Source: `db/migrations/016_game_day.sql`

```sql
CREATE TABLE IF NOT EXISTS game_day_activity(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES game_day_rooms(id) ON DELETE CASCADE,kind text NOT NULL,user_id uuid REFERENCES users(id) ON DELETE SET NULL,body text NOT NULL,payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
```

Source: `db/migrations/016_game_day.sql`

```sql
CREATE INDEX IF NOT EXISTS game_day_activity_room_time_idx ON game_day_activity(room_id,created_at);
```


## game day events

**Table:** `game_day_events` · **Class A** · **Purpose:** Game day events.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/game-day/repository.ts`:166

**Declared schema and ordered changes:**

Source: `db/migrations/016_game_day.sql`

```sql
CREATE TABLE IF NOT EXISTS game_day_events(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES game_day_rooms(id) ON DELETE CASCADE,event_type text NOT NULL,team_id text,headline text NOT NULL,detail text,importance int NOT NULL,payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
```


## game day predictions

**Table:** `game_day_predictions` · **Class A** · **Purpose:** Game day predictions.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/game-day/repository.ts`:96, 152, 170

**Declared schema and ordered changes:**

Source: `db/migrations/016_game_day.sql`

```sql
CREATE TABLE IF NOT EXISTS game_day_predictions(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES game_day_rooms(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind text NOT NULL,prompt text NOT NULL,selection text NOT NULL,drive_number int,locked_at timestamptz,settled_at timestamptz,correct boolean,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(room_id,user_id,kind,prompt,drive_number));
```


## game day reactions

**Table:** `game_day_reactions` · **Class A** · **Purpose:** Game day reactions.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/game-day/repository.ts`:99, 139

**Declared schema and ordered changes:**

Source: `db/migrations/016_game_day.sql`

```sql
CREATE TABLE IF NOT EXISTS game_day_reactions(activity_id uuid NOT NULL REFERENCES game_day_activity(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,reaction text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(activity_id,user_id,reaction));
```


## game day room members

**Table:** `game_day_room_members` · **Class A** · **Purpose:** Game day room members.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/game-day/repository.ts`:43, 54, 73, 76, 83, 86, 90, 175

**Declared schema and ordered changes:**

Source: `db/migrations/016_game_day.sql`

```sql
CREATE TABLE IF NOT EXISTS game_day_room_members(room_id uuid NOT NULL REFERENCES game_day_rooms(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,role text NOT NULL DEFAULT 'MEMBER',presence text NOT NULL DEFAULT 'HERE',joined_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now(),muted boolean NOT NULL DEFAULT false,PRIMARY KEY(room_id,user_id));
```


## game day rooms

**Table:** `game_day_rooms` · **Class A** · **Purpose:** Game day rooms.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/game-day/repository.ts`:42, 52, 73, 76, 83, 160, 163, 179

**Declared schema and ordered changes:**

Source: `db/migrations/016_game_day.sql`

```sql
CREATE TABLE IF NOT EXISTS game_day_rooms(id uuid PRIMARY KEY,game_id text NOT NULL,team_id text NOT NULL,host_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,join_code varchar(8) NOT NULL UNIQUE,invite_token_hash text NOT NULL UNIQUE,privacy text NOT NULL DEFAULT 'PRIVATE',status text NOT NULL DEFAULT 'TAILGATE',kickoff_at timestamptz NOT NULL,game_state jsonb NOT NULL,muted boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),archived_at timestamptz);
```


## historical games

**Table:** `historical_games` · **Class B** · **Purpose:** Canonical schedule/results; referenced by historical statistics.

**Local count:** 816. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/schedule/repository.ts`:7, 53; `src/server/schedule/enrich.ts`:23; `src/server/schedule/next-up.ts`:9; `src/server/schedule/ingest.ts`:84; `src/server/historical-stats/repository.ts`:14, 16, 35, 66; `src/server/historical-stats/importer.ts`:144, 148; `src/app/api/parlay-lab/my-plays/grade/route.ts`:27, 46, 72; `src/app/api/content/next-game/route.ts`:15; `scripts/parlay-lab-audit.ts`:26, 104, 125, 143, 145

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| season | int4 | NO | `none` |
| week | int4 | NO | `none` |
| season_type | text | NO | `none` |
| provider | text | NO | `'NFLVERSE'::text` |
| provider_game_id | text | NO | `none` |
| game_date | date | NO | `none` |
| kickoff_at | timestamptz | YES | `none` |
| home_team_id | text | NO | `none` |
| away_team_id | text | NO | `none` |
| home_score | int4 | YES | `none` |
| away_score | int4 | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| espn_event_id | text | YES | `none` |
| status | text | NO | `'SCHEDULED'::text` |
| overtime | bool | NO | `false` |
| venue | text | YES | `none` |
| broadcast_network | text | YES | `none` |
| kickoff_confirmed | bool | NO | `true` |

**Declared schema and ordered changes:**

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE TABLE IF NOT EXISTS historical_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  week integer NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('REG', 'POST')),
  provider text NOT NULL DEFAULT 'NFLVERSE',
  provider_game_id text NOT NULL,
  game_date date NOT NULL,
  kickoff_at timestamptz,
  home_team_id text NOT NULL,
  away_team_id text NOT NULL,
  home_score integer,
  away_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_game_id)
);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games DROP CONSTRAINT IF EXISTS historical_games_season_type_check;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD CONSTRAINT historical_games_season_type_check CHECK (season_type IN ('PRE','REG','POST'));
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD COLUMN IF NOT EXISTS espn_event_id text;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','LIVE','FINAL','POSTPONED','CANCELED'));
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD COLUMN IF NOT EXISTS overtime boolean NOT NULL DEFAULT false;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD COLUMN IF NOT EXISTS venue text;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD COLUMN IF NOT EXISTS broadcast_network text;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
ALTER TABLE historical_games ADD COLUMN IF NOT EXISTS kickoff_confirmed boolean NOT NULL DEFAULT true;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS historical_games_identity_idx ON historical_games(season,season_type,week,home_team_id,away_team_id);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS historical_games_espn_idx ON historical_games(espn_event_id) WHERE espn_event_id IS NOT NULL;
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_games_season_week_idx ON historical_games(season,week);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_games_home_idx ON historical_games(home_team_id);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_games_away_idx ON historical_games(away_team_id);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_games_kickoff_idx ON historical_games(kickoff_at);
```

Source: `db/migrations/042_canonical_schedule.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_games_status_idx ON historical_games(status);
```


## historical player games

**Table:** `historical_player_games` · **Class B** · **Purpose:** Per-player per-game historical numeric performance.

**Local count:** 38964. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/search/answer-data.ts`:273; `src/server/historical-stats/repository.ts`:35, 66; `src/server/historical-stats/importer.ts`:262; `src/app/api/parlay-lab/my-plays/grade/route.ts`:47, 71; `scripts/parlay-lab-audit.ts`:31, 104, 125, 131, 134, 144, 145, 146, 147, 148

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| season | int4 | NO | `none` |
| week | int4 | NO | `none` |
| season_type | text | NO | `none` |
| game_id | uuid | NO | `none` |
| player_id | text | YES | `none` |
| provider | text | NO | `'NFLVERSE'::text` |
| provider_player_id | text | NO | `none` |
| provider_player_name | text | NO | `none` |
| team_id | text | NO | `none` |
| opponent_team_id | text | NO | `none` |
| home_away | text | NO | `none` |
| position | text | YES | `none` |
| passing_attempts | int4 | YES | `none` |
| passing_completions | int4 | YES | `none` |
| passing_yards | numeric | YES | `none` |
| passing_tds | int4 | YES | `none` |
| interceptions | int4 | YES | `none` |
| sacks_taken | numeric | YES | `none` |
| carries | int4 | YES | `none` |
| rushing_yards | numeric | YES | `none` |
| rushing_tds | int4 | YES | `none` |
| targets | int4 | YES | `none` |
| receptions | int4 | YES | `none` |
| receiving_yards | numeric | YES | `none` |
| receiving_tds | int4 | YES | `none` |
| fumbles | numeric | YES | `none` |
| fumbles_lost | numeric | YES | `none` |
| fantasy_points | numeric | YES | `none` |
| snap_count | int4 | YES | `none` |
| snap_share | numeric | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE TABLE IF NOT EXISTS historical_player_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  week integer NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('REG', 'POST')),
  game_id uuid NOT NULL REFERENCES historical_games(id) ON DELETE CASCADE,
  player_id text,
  provider text NOT NULL DEFAULT 'NFLVERSE',
  provider_player_id text NOT NULL,
  provider_player_name text NOT NULL,
  team_id text NOT NULL,
  opponent_team_id text NOT NULL,
  home_away text NOT NULL CHECK (home_away IN ('HOME', 'AWAY')),
  position text,
  passing_attempts integer,
  passing_completions integer,
  passing_yards numeric,
  passing_tds integer,
  interceptions integer,
  sacks_taken numeric,
  carries integer,
  rushing_yards numeric,
  rushing_tds integer,
  targets integer,
  receptions integer,
  receiving_yards numeric,
  receiving_tds integer,
  fumbles numeric,
  fumbles_lost numeric,
  fantasy_points numeric,
  snap_count integer,
  snap_share numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, week, season_type, provider, provider_player_id, game_id)
);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_player_games_player_season_week_idx ON historical_player_games(player_id, season, week);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_player_games_player_game_idx ON historical_player_games(player_id, game_id);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_player_games_team_season_idx ON historical_player_games(team_id, season);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_player_games_opponent_season_idx ON historical_player_games(opponent_team_id, season);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_player_games_position_season_idx ON historical_player_games(position, season);
```


## historical team games

**Table:** `historical_team_games` · **Class B** · **Purpose:** Per-team per-game historical statistics.

**Local count:** 1632. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/historical-stats/team-season-strength-service.ts`:12, 20, 21; `src/server/historical-stats/team-matchup-service.ts`:22; `src/server/historical-stats/importer.ts`:239; `scripts/parlay-lab-audit.ts`:37

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| season | int4 | NO | `none` |
| week | int4 | NO | `none` |
| season_type | text | NO | `none` |
| game_id | uuid | NO | `none` |
| team_id | text | NO | `none` |
| opponent_team_id | text | NO | `none` |
| home_away | text | NO | `none` |
| points | int4 | YES | `none` |
| plays | int4 | YES | `none` |
| passing_attempts | int4 | YES | `none` |
| passing_completions | int4 | YES | `none` |
| passing_yards | numeric | YES | `none` |
| passing_tds | int4 | YES | `none` |
| interceptions | int4 | YES | `none` |
| rushing_attempts | int4 | YES | `none` |
| rushing_yards | numeric | YES | `none` |
| rushing_tds | int4 | YES | `none` |
| targets | int4 | YES | `none` |
| receptions | int4 | YES | `none` |
| receiving_yards | numeric | YES | `none` |
| sacks_allowed | numeric | YES | `none` |
| sacks_made | numeric | YES | `none` |
| turnovers | numeric | YES | `none` |
| first_downs | int4 | YES | `none` |
| third_down_attempts | int4 | YES | `none` |
| third_down_conversions | int4 | YES | `none` |
| time_of_possession | interval | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE TABLE IF NOT EXISTS historical_team_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  week integer NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('REG', 'POST')),
  game_id uuid NOT NULL REFERENCES historical_games(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  opponent_team_id text NOT NULL,
  home_away text NOT NULL CHECK (home_away IN ('HOME', 'AWAY')),
  points integer,
  plays integer,
  passing_attempts integer,
  passing_completions integer,
  passing_yards numeric,
  passing_tds integer,
  interceptions integer,
  rushing_attempts integer,
  rushing_yards numeric,
  rushing_tds integer,
  targets integer,
  receptions integer,
  receiving_yards numeric,
  sacks_allowed numeric,
  sacks_made numeric,
  turnovers numeric,
  first_downs integer,
  third_down_attempts integer,
  third_down_conversions integer,
  time_of_possession interval,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, team_id)
);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_team_games_team_season_week_idx ON historical_team_games(team_id, season, week);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_team_games_opponent_season_idx ON historical_team_games(opponent_team_id, season);
```


## historical team season strength

**Table:** `historical_team_season_strength` · **Class D** · **Purpose:** Derived opponent defense ranks and season aggregates.

**Local count:** 96. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Updated by imports/indexing or score events; read by search/rank/research pages.

**Reconstructable:** Yes from canonical records/award-answer history if retained.

**Placement:** Derived relational index/projection; embeddings separate for D1.

**Transactions/locking:** Atomic per-document replacement or aggregate update; replayable checkpoints.

**Code references:** `src/server/search/answer-data.ts`:304; `src/server/historical-stats/repository.ts`:37, 49; `src/server/historical-stats/team-season-strength-service.ts`:37, 59; `scripts/parlay-lab-audit.ts`:38

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| season | int4 | NO | `none` |
| team_id | text | NO | `none` |
| games | int4 | NO | `none` |
| points_per_game | numeric | NO | `none` |
| scoring_offense_rank | int4 | NO | `none` |
| passing_yards_per_game | numeric | NO | `none` |
| passing_offense_rank | int4 | NO | `none` |
| rushing_yards_per_game | numeric | NO | `none` |
| rushing_offense_rank | int4 | NO | `none` |
| total_yards_per_game | numeric | NO | `none` |
| total_offense_rank | int4 | NO | `none` |
| points_allowed_per_game | numeric | NO | `none` |
| scoring_defense_rank | int4 | NO | `none` |
| passing_yards_allowed_per_game | numeric | NO | `none` |
| pass_defense_rank | int4 | NO | `none` |
| rushing_yards_allowed_per_game | numeric | NO | `none` |
| rush_defense_rank | int4 | NO | `none` |
| total_yards_allowed_per_game | numeric | NO | `none` |
| total_defense_rank | int4 | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/037_historical_team_season_strength.sql`

```sql
CREATE TABLE IF NOT EXISTS historical_team_season_strength (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL,
  team_id text NOT NULL,
  games integer NOT NULL,
  points_per_game numeric NOT NULL,
  scoring_offense_rank integer NOT NULL,
  passing_yards_per_game numeric NOT NULL,
  passing_offense_rank integer NOT NULL,
  rushing_yards_per_game numeric NOT NULL,
  rushing_offense_rank integer NOT NULL,
  total_yards_per_game numeric NOT NULL,
  total_offense_rank integer NOT NULL,
  points_allowed_per_game numeric NOT NULL,
  scoring_defense_rank integer NOT NULL,
  passing_yards_allowed_per_game numeric NOT NULL,
  pass_defense_rank integer NOT NULL,
  rushing_yards_allowed_per_game numeric NOT NULL,
  rush_defense_rank integer NOT NULL,
  total_yards_allowed_per_game numeric NOT NULL,
  total_defense_rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, team_id)
);
```

Source: `db/migrations/037_historical_team_season_strength.sql`

```sql
CREATE INDEX IF NOT EXISTS historical_team_season_strength_lookup_idx
  ON historical_team_season_strength(season, team_id);
```


## ingestion jobs

**Table:** `ingestion_jobs` · **Class C** · **Purpose:** Ingestion jobs.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Ingestion-triggered writes; repeated matching/evidence reads (high during batches).

**Reconstructable:** Partly: sources may change/disappear; preserve provenance and hashes.

**Placement:** Compact relational metadata; raw bodies to retention-limited object storage.

**Transactions/locking:** Atomic job claim/story+evidence commit; lease/CAS replaces row locks.

**Code references:** `src/server/story-engine/repository.ts`:88, 93, 136, 141, 144; `scripts/sync-production-content-to-local.ts`:43; `scripts/backfill-team-content.ts`:71

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| job_type | text | NO | `none` |
| status | text | NO | `'PENDING'::text` |
| idempotency_key | text | NO | `none` |
| payload | jsonb | NO | `none` |
| attempts | int4 | NO | `0` |
| max_attempts | int4 | NO | `5` |
| available_at | timestamptz | NO | `now()` |
| locked_at | timestamptz | YES | `none` |
| locked_by | text | YES | `none` |
| last_error | text | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY,
  job_type text NOT NULL CHECK (job_type IN ('SOURCE_FETCH','CANDIDATE_PROCESS')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','DEAD')),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS ingestion_jobs_claim_idx ON ingestion_jobs(status,available_at,created_at);
```


## move the chains accounts

**Table:** `move_the_chains_accounts` · **Class A** · **Purpose:** Current yard/touchdown counters.

**Local count:** 2. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/rewards/repository.ts`:36, 41, 58, 94, 98, 120, 125; `src/server/crew/repository.ts`:38; `src/server/trivia/repository.ts`:111

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| current_drive_yards | int4 | NO | `0` |
| touchdowns | int4 | NO | `0` |
| lifetime_yards | int4 | NO | `0` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS move_the_chains_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_drive_yards integer NOT NULL DEFAULT 0 CHECK (current_drive_yards BETWEEN 0 AND 99),
  touchdowns integer NOT NULL DEFAULT 0 CHECK (touchdowns >= 0),
  lifetime_yards integer NOT NULL DEFAULT 0 CHECK (lifetime_yards >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```


## move the chains events

**Table:** `move_the_chains_events` · **Class A** · **Purpose:** Idempotent point/yard award ledger.

**Local count:** 4. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/rewards/repository.ts`:32, 117; `src/server/crew/repository.ts`:37, 56

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| event_type | text | NO | `none` |
| yards | int4 | NO | `none` |
| source_type | text | NO | `none` |
| source_id | text | NO | `none` |
| idempotency_key | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS move_the_chains_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('DAILY_TRIVIA_CORRECT', 'TRIVIA_CORRECT', 'PREDICTION_CORRECT', 'POLL_PARTICIPATION', 'GAME_DAY_CHECK_IN', 'ADMIN_ADJUSTMENT')),
  yards integer NOT NULL CHECK (yards >= 0),
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
```

Source: `db/migrations/011_move_the_chains_rewards.sql`

```sql
ALTER TABLE move_the_chains_events DROP CONSTRAINT IF EXISTS move_the_chains_events_event_type_check;
```

Source: `db/migrations/011_move_the_chains_rewards.sql`

```sql
ALTER TABLE move_the_chains_events ADD CONSTRAINT move_the_chains_events_event_type_check CHECK (event_type IN (
  'DAILY_TRIVIA_CORRECT','TRIVIA_CORRECT','TRIVIA_GAME_COMPLETE','TRIVIA_BUDDY_WIN',
  'CATCH_UP_COMPLETE','PREDICTION_SUBMITTED','PREDICTION_CORRECT','GAME_DAY_CHECKIN',
  'POLL_PARTICIPATION','GAME_DAY_CHECK_IN','ADMIN_ADJUSTMENT'
));
```


## notification deliveries

**Table:** `notification_deliveries` · **Class F** · **Purpose:** Notification deliveries.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/notifications/repository.ts`:306

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| notification_id | uuid | NO | `none` |
| channel | text | NO | `none` |
| device_id | uuid | YES | `none` |
| provider | text | NO | `none` |
| state | text | NO | `none` |
| attempted_at | timestamptz | NO | `now()` |
| delivered_at | timestamptz | YES | `none` |
| failed_at | timestamptz | YES | `none` |
| failure_code | text | YES | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('PUSH', 'SMS', 'EMAIL', 'IN_APP')),
  device_id uuid REFERENCES user_devices(id) ON DELETE SET NULL,
  provider text NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```


## notification events

**Table:** `notification_events` · **Class F** · **Purpose:** Notification events.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/story-engine/repository.ts`:356

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| event_type | text | NO | `none` |
| team_id | text | YES | `none` |
| player_id | text | YES | `none` |
| story_id | text | YES | `none` |
| priority | text | NO | `none` |
| payload | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| dedupe_key | text | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,
  team_id text,
  player_id text,
  story_id text,
  priority text NOT NULL CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE INDEX IF NOT EXISTS notification_events_type_idx ON notification_events(event_type, created_at DESC);
```

Source: `db/migrations/014_story_automation_policy.sql`

```sql
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS dedupe_key text;
```

Source: `db/migrations/014_story_automation_policy.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS notification_events_dedupe_idx ON notification_events(dedupe_key) WHERE dedupe_key IS NOT NULL;
```


## observer run events

**Table:** `observer_run_events` · **Class F** · **Purpose:** Observer run events.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/monitoring/observer.ts`:102, 113, 122, 150

**Declared schema and ordered changes:**

Source: `db/migrations/018_monitor_observer.sql`

```sql
CREATE TABLE IF NOT EXISTS observer_run_events (
  run_id uuid NOT NULL REFERENCES observer_runs(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  story_version integer NOT NULL,
  event_creation_time timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,
  confidence integer NOT NULL,
  importance_score integer NOT NULL,
  score numeric(7,2) NOT NULL,
  sources jsonb NOT NULL,
  proposed_push text,
  proposed_story jsonb NOT NULL,
  notification_decision text NOT NULL,
  suppression_reason text,
  time_to_proposed_notification_ms bigint,
  PRIMARY KEY(run_id,story_id,story_version)
);
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
CREATE INDEX IF NOT EXISTS observer_events_filter_idx ON observer_run_events(run_id,notification_decision,category,confidence,captured_at);
```


## observer run items

**Table:** `observer_run_items` · **Class F** · **Purpose:** Observer run items.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/monitoring/observer.ts`:57, 118, 142

**Declared schema and ordered changes:**

Source: `db/migrations/018_monitor_observer.sql`

```sql
CREATE TABLE IF NOT EXISTS observer_run_items (
  run_id uuid NOT NULL REFERENCES observer_runs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES content_candidates(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES content_sources(id),
  source_tier integer NOT NULL CHECK (source_tier BETWEEN 1 AND 3),
  content_type text NOT NULL,
  publication_time timestamptz NOT NULL,
  detection_time timestamptz NOT NULL,
  time_to_detection_ms bigint NOT NULL,
  PRIMARY KEY(run_id,candidate_id)
);
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
CREATE INDEX IF NOT EXISTS observer_items_source_idx ON observer_run_items(run_id,source_id,publication_time);
```


## observer runs

**Table:** `observer_runs` · **Class F** · **Purpose:** Observer runs.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/monitoring/observer.ts`:49, 55, 134, 139; `src/app/api/admin/observer/route.ts`:23

**Declared schema and ordered changes:**

Source: `db/migrations/018_monitor_observer.sql`

```sql
CREATE TABLE IF NOT EXISTS observer_runs (
  id uuid PRIMARY KEY,
  team_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED','CANCELLED')),
  observer_mode boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  scheduled_end_at timestamptz NOT NULL,
  completed_at timestamptz,
  thresholds jsonb NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/018_monitor_observer.sql`

```sql
CREATE INDEX IF NOT EXISTS observer_runs_team_time_idx ON observer_runs(team_id,started_at DESC);
```


## provider player mappings

**Table:** `provider_player_mappings` · **Class B** · **Purpose:** Provider player mappings.

**Local count:** 2233. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/search/stored-betting.ts`:29; `src/server/odds/repository.ts`:102, 127; `src/server/historical-stats/importer.ts`:152, 213; `scripts/parlay-lab-audit.ts`:23; `scripts/sync-parlay-lab-odds-to-production.ts`:23, 26

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| provider | text | NO | `none` |
| provider_player_id | text | NO | `none` |
| player_id | text | NO | `none` |
| provider_name | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| confidence | text | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE TABLE IF NOT EXISTS provider_player_mappings (
  provider text NOT NULL,
  provider_player_id text NOT NULL,
  player_id text NOT NULL,
  provider_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_player_id)
);
```

Source: `db/migrations/036_nflverse_historical_stats.sql`

```sql
ALTER TABLE provider_player_mappings
  ADD COLUMN IF NOT EXISTS confidence text
  CHECK (confidence IS NULL OR confidence IN ('EXACT_ID', 'NAME_TEAM_POSITION', 'NAME_POSITION'));
```


## provider team mappings

**Table:** `provider_team_mappings` · **Class B** · **Purpose:** Provider team mappings.

**Local count:** 62. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/odds/repository.ts`:94; `src/server/historical-stats/importer.ts`:140; `scripts/parlay-lab-audit.ts`:22; `scripts/sync-parlay-lab-odds-to-production.ts`:15, 18

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| provider | text | NO | `none` |
| provider_team_id | text | NO | `none` |
| team_id | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE TABLE IF NOT EXISTS provider_team_mappings (
  provider text NOT NULL,
  provider_team_id text NOT NULL,
  team_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_team_id)
);
```


## reward definitions

**Table:** `reward_definitions` · **Class B** · **Purpose:** Reward definitions.

**Local count:** 8. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/rewards/repository.ts`:60, 101, 109, 158

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | text | NO | `none` |
| threshold_yards | int4 | NO | `none` |
| type | text | NO | `none` |
| title | text | NO | `none` |
| description | text | NO | `none` |
| discount_percent | int4 | YES | `none` |
| usage_limit | int4 | NO | `1` |
| active | bool | NO | `true` |
| stackable | bool | NO | `false` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/011_move_the_chains_rewards.sql`

```sql
CREATE TABLE IF NOT EXISTS reward_definitions (
  id text PRIMARY KEY,
  threshold_yards integer NOT NULL CHECK (threshold_yards >= 0),
  type text NOT NULL CHECK (type IN ('DISCOUNT','STICKER_PACK')),
  title text NOT NULL,
  description text NOT NULL,
  discount_percent integer CHECK (discount_percent BETWEEN 1 AND 100),
  usage_limit integer NOT NULL DEFAULT 1 CHECK (usage_limit > 0),
  active boolean NOT NULL DEFAULT true,
  stackable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```


## search documents

**Table:** `search_documents` · **Class D** · **Purpose:** Rebuildable chunks, hashes, lexical generated vector and optional embeddings.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Updated by imports/indexing or score events; read by search/rank/research pages.

**Reconstructable:** Yes from canonical records/award-answer history if retained.

**Placement:** Derived relational index/projection; embeddings separate for D1.

**Transactions/locking:** Atomic per-document replacement or aggregate update; replayable checkpoints.

**Code references:** `src/server/search/indexer.ts`:114, 136, 139, 146; `src/server/search/retrieval.ts`:42, 57

**Declared schema and ordered changes:**

Source: `db/migrations/017_search_documents.sql`

```sql
CREATE TABLE IF NOT EXISTS search_documents (
  id text PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  team_id text,
  result_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text NOT NULL DEFAULT '',
  url text NOT NULL,
  source_name text,
  source_url text,
  published_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  image_url text,
  canonical_story_id uuid,
  content_hash text NOT NULL,
  embedding vector(384),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED,
  active boolean NOT NULL DEFAULT true,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id, chunk_index)
);
```

Source: `db/migrations/017_search_documents.sql`

```sql
CREATE INDEX IF NOT EXISTS search_documents_lexical_idx ON search_documents USING gin(search_vector);
```

Source: `db/migrations/017_search_documents.sql`

```sql
CREATE INDEX IF NOT EXISTS search_documents_team_idx ON search_documents(team_id, active, source_updated_at DESC);
```

Source: `db/migrations/017_search_documents.sql`

```sql
CREATE INDEX IF NOT EXISTS search_documents_embedding_idx ON search_documents USING hnsw (embedding vector_cosine_ops);
```


## security audit events

**Table:** `security_audit_events` · **Class F** · **Purpose:** Security audit events.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/security/audit.ts`:33; `src/server/user/account-repository.ts`:26

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | YES | `none` |
| event_type | text | NO | `none` |
| actor_type | text | NO | `'USER'::text` |
| ip_hash | text | YES | `none` |
| user_agent_family | text | YES | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/005_security_audit.sql`

```sql
CREATE TABLE IF NOT EXISTS security_audit_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'USER' CHECK (actor_type IN ('USER', 'SYSTEM', 'ADMIN')),
  ip_hash text,
  user_agent_family text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/005_security_audit.sql`

```sql
CREATE INDEX IF NOT EXISTS security_audit_user_created_idx
  ON security_audit_events(user_id, created_at DESC);
```

Source: `db/migrations/005_security_audit.sql`

```sql
CREATE INDEX IF NOT EXISTS security_audit_type_created_idx
  ON security_audit_events(event_type, created_at DESC);
```


## sessions

**Table:** `sessions` · **Class A** · **Purpose:** Refresh token hashes, family rotation and revocation.

**Local count:** 4. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/auth/repository.ts`:207, 225, 231, 245, 251, 253, 260, 263, 269, 273, 277, 294; `src/app/api/auth/sessions/route.ts`:8; `src/app/api/draft/session/active/route.ts`:19, 20

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| device_id | uuid | YES | `none` |
| refresh_token_hash | text | NO | `none` |
| token_family_id | uuid | NO | `none` |
| replaced_by_session_id | uuid | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| last_used_at | timestamptz | NO | `now()` |
| expires_at | timestamptz | NO | `none` |
| revoked_at | timestamptz | YES | `none` |
| ip_metadata | text | YES | `none` |
| user_agent_metadata | text | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  token_family_id uuid NOT NULL,
  replaced_by_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_metadata text,
  user_agent_metadata text
);
```

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
```

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE INDEX IF NOT EXISTS sessions_family_idx ON sessions(token_family_id);
```


## sportsbook events

**Table:** `sportsbook_events` · **Class B** · **Purpose:** Sportsbook events.

**Local count:** 15. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/schedule/next-up.ts`:19; `src/server/search/stored-betting.ts`:26; `src/server/odds/repository.ts`:20, 79, 85, 89, 106, 163; `src/app/api/parlay-lab/movement/route.ts`:14; `scripts/parlay-lab-audit.ts`:11, 153, 156, 157, 161; `scripts/sync-parlay-lab-odds-to-production.ts`:65, 73, 87, 112

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| provider | text | NO | `none` |
| provider_event_id | text | NO | `none` |
| league | text | NO | `none` |
| season | int4 | NO | `none` |
| week | int4 | NO | `none` |
| home_team_id | text | NO | `none` |
| away_team_id | text | NO | `none` |
| kickoff_at | timestamptz | NO | `none` |
| status | text | NO | `'scheduled'::text` |
| markets_locked | bool | NO | `false` |
| first_imported_at | timestamptz | NO | `now()` |
| refreshed_24h_at | timestamptz | YES | `none` |
| final_snapshot_at | timestamptz | YES | `none` |
| last_imported_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE TABLE IF NOT EXISTS sportsbook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  league text NOT NULL CHECK (league = 'NFL'),
  season integer NOT NULL,
  week integer NOT NULL,
  home_team_id text NOT NULL,
  away_team_id text NOT NULL,
  kickoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  markets_locked boolean NOT NULL DEFAULT false,
  first_imported_at timestamptz NOT NULL DEFAULT now(),
  refreshed_24h_at timestamptz,
  final_snapshot_at timestamptz,
  last_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
```

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE INDEX IF NOT EXISTS sportsbook_events_window_idx
  ON sportsbook_events(markets_locked, kickoff_at);
```


## sportsbook price snapshots

**Table:** `sportsbook_price_snapshots` · **Class B** · **Purpose:** Append-only historical price captures.

**Local count:** 74709. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/odds/repository.ts`:72; `src/app/api/parlay-lab/movement/route.ts`:12; `scripts/parlay-lab-audit.ts`:21

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | int8 | NO | `nextval('sportsbook_price_snapshots_id_seq'::regclass)` |
| market_id | uuid | NO | `none` |
| sportsbook | text | NO | `none` |
| odds | int4 | YES | `none` |
| line | numeric | YES | `none` |
| available | bool | NO | `none` |
| deeplink | text | YES | `none` |
| captured_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE TABLE IF NOT EXISTS sportsbook_price_snapshots (
  id bigserial PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES bet_markets(id) ON DELETE CASCADE,
  sportsbook text NOT NULL CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS')),
  odds integer,
  line numeric,
  available boolean NOT NULL,
  deeplink text,
  captured_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/038_expand_parlay_lab_sportsbooks.sql`

```sql
ALTER TABLE sportsbook_price_snapshots
  DROP CONSTRAINT IF EXISTS sportsbook_price_snapshots_sportsbook_check;
```

Source: `db/migrations/038_expand_parlay_lab_sportsbooks.sql`

```sql
ALTER TABLE sportsbook_price_snapshots
  ADD CONSTRAINT sportsbook_price_snapshots_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS'));
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE sportsbook_price_snapshots
  DROP CONSTRAINT IF EXISTS sportsbook_price_snapshots_sportsbook_check;
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE sportsbook_price_snapshots ADD CONSTRAINT sportsbook_price_snapshots_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS', 'BET365'));
```


## sportsbook prices

**Table:** `sportsbook_prices` · **Class B** · **Purpose:** Latest per-market/book odds and availability.

**Local count:** 74709. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/search/stored-betting.ts`:28; `src/server/odds/repository.ts`:67, 126; `scripts/parlay-lab-audit.ts`:20, 153, 159, 160; `scripts/sync-parlay-lab-odds-to-production.ts`:110, 126

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| market_id | uuid | NO | `none` |
| sportsbook | text | NO | `none` |
| provider_selection_id | text | YES | `none` |
| provider_market_id | text | NO | `none` |
| provider_event_id | text | NO | `none` |
| odds | int4 | YES | `none` |
| decimal_odds | numeric | YES | `none` |
| line | numeric | YES | `none` |
| available | bool | NO | `false` |
| deeplink | text | YES | `none` |
| captured_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE TABLE IF NOT EXISTS sportsbook_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES bet_markets(id) ON DELETE CASCADE,
  sportsbook text NOT NULL CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS')),
  provider_selection_id text,
  provider_market_id text NOT NULL,
  provider_event_id text NOT NULL,
  odds integer,
  decimal_odds numeric,
  line numeric,
  available boolean NOT NULL DEFAULT false,
  deeplink text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, sportsbook)
);
```

Source: `db/migrations/035_parlay_lab_odds.sql`

```sql
CREATE INDEX IF NOT EXISTS sportsbook_prices_lookup_idx
  ON sportsbook_prices(market_id, sportsbook, available);
```

Source: `db/migrations/038_expand_parlay_lab_sportsbooks.sql`

```sql
ALTER TABLE sportsbook_prices DROP CONSTRAINT IF EXISTS sportsbook_prices_sportsbook_check;
```

Source: `db/migrations/038_expand_parlay_lab_sportsbooks.sql`

```sql
ALTER TABLE sportsbook_prices
  ADD CONSTRAINT sportsbook_prices_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS'));
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE sportsbook_prices DROP CONSTRAINT IF EXISTS sportsbook_prices_sportsbook_check;
```

Source: `db/migrations/039_parlay_lab_research_first.sql`

```sql
ALTER TABLE sportsbook_prices ADD CONSTRAINT sportsbook_prices_sportsbook_check
  CHECK (sportsbook IN ('FANDUEL', 'DRAFTKINGS', 'BETMGM', 'CAESARS', 'BET365'));
```


## story domain events

**Table:** `story_domain_events` · **Class F** · **Purpose:** Story domain events.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/story-engine/repository.ts`:324; `src/server/story-engine/projections.ts`:262

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| event_type | text | NO | `none` |
| story_id | uuid | NO | `none` |
| team_id | text | YES | `none` |
| story_version | int4 | NO | `none` |
| idempotency_key | text | NO | `none` |
| payload | jsonb | NO | `none` |
| occurred_at | timestamptz | NO | `now()` |
| processed_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS story_domain_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('StoryCreated','StoryUpdated','StoryBecameBreaking','StoryResolved','StoryImportanceChanged')),
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  team_id text,
  story_version integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS story_domain_events_unprocessed_idx ON story_domain_events(processed_at,occurred_at);
```


## story editorial overrides

**Table:** `story_editorial_overrides` · **Class B** · **Purpose:** Story editorial overrides.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/story-engine/repository.ts`:397; `scripts/sync-production-content-to-local.ts`:11

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| story_id | uuid | NO | `none` |
| team_id | text | NO | `none` |
| surface | text | NO | `none` |
| action | text | NO | `none` |
| value | int4 | YES | `none` |
| active | bool | NO | `true` |
| editor_id | text | NO | `none` |
| expires_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/013_story_downstream_projections.sql`

```sql
CREATE TABLE IF NOT EXISTS story_editorial_overrides (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  surface text NOT NULL CHECK(surface IN ('PUBLIC','HUDDLE','THREE_AND_OUT')),
  action text NOT NULL CHECK(action IN ('PIN','PROMOTE','EXCLUDE','HIDE')),
  value integer,
  active boolean NOT NULL DEFAULT true,
  editor_id text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/013_story_downstream_projections.sql`

```sql
CREATE INDEX IF NOT EXISTS story_editorial_overrides_active_idx ON story_editorial_overrides(team_id,surface,active);
```

Source: `db/migrations/014_story_automation_policy.sql`

```sql
ALTER TABLE story_editorial_overrides DROP CONSTRAINT IF EXISTS story_editorial_overrides_action_check;
```

Source: `db/migrations/014_story_automation_policy.sql`

```sql
ALTER TABLE story_editorial_overrides ADD CONSTRAINT story_editorial_overrides_action_check CHECK(action IN ('PIN','PROMOTE','EXCLUDE','HIDE','FORCE_PUBLISH','FORCE_REVIEW'));
```


## story evidence

**Table:** `story_evidence` · **Class C** · **Purpose:** Canonical-story/source-candidate associations and provenance.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Ingestion-triggered writes; repeated matching/evidence reads (high during batches).

**Reconstructable:** Partly: sources may change/disappear; preserve provenance and hashes.

**Placement:** Compact relational metadata; raw bodies to retention-limited object storage.

**Transactions/locking:** Atomic job claim/story+evidence commit; lease/CAS replaces row locks.

**Code references:** `src/server/story-engine/repository.ts`:224, 232, 279, 416, 422, 428, 475, 518; `src/server/story-engine/projections.ts`:39, 40, 49, 130, 136, 147, 150, 157, 204, 205, 211; `src/server/search/indexer.ts`:24; `src/server/search/answer-data.ts`:222; `src/server/monitoring/observer.ts`:68, 146; `scripts/content-ollama-stress-test.ts`:68, 70; `scripts/sync-production-content-to-local.ts`:9

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| story_id | uuid | NO | `none` |
| content_candidate_id | uuid | NO | `none` |
| source_id | text | NO | `none` |
| source_url | text | NO | `none` |
| support_type | text | NO | `'SUPPORTS'::text` |
| confidence | numeric | NO | `0.800` |
| first_seen_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS story_evidence (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  content_candidate_id uuid NOT NULL REFERENCES content_candidates(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES content_sources(id),
  source_url text NOT NULL,
  support_type text NOT NULL DEFAULT 'SUPPORTS' CHECK (support_type IN ('SUPPORTS','CONTRADICTS','CORRECTS','OFFICIAL_CONFIRMATION')),
  confidence numeric(4,3) NOT NULL DEFAULT 0.800 CHECK (confidence BETWEEN 0 AND 1),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,content_candidate_id)
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS story_evidence_story_idx ON story_evidence(story_id,first_seen_at);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS story_evidence_candidate_idx ON story_evidence(content_candidate_id);
```


## story publication decisions

**Table:** `story_publication_decisions` · **Class F** · **Purpose:** Story publication decisions.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/story-engine/repository.ts`:332, 518; `src/server/monitoring/observer.ts`:151; `scripts/sync-production-content-to-local.ts`:12

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| story_id | uuid | NO | `none` |
| story_version | int4 | NO | `none` |
| action | text | NO | `none` |
| reason | text | NO | `none` |
| confidence | int4 | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/014_story_automation_policy.sql`

```sql
CREATE TABLE IF NOT EXISTS story_publication_decisions (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  story_version integer NOT NULL,
  action text NOT NULL CHECK(action IN ('AUTO_PUBLISH','REVIEW_REQUIRED','DO_NOT_PUBLISH')),
  reason text NOT NULL,
  confidence integer NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,story_version)
);
```


## story versions

**Table:** `story_versions` · **Class C** · **Purpose:** Version history of generated canonical summaries.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Ingestion-triggered writes; repeated matching/evidence reads (high during batches).

**Reconstructable:** Partly: sources may change/disappear; preserve provenance and hashes.

**Placement:** Compact relational metadata; raw bodies to retention-limited object storage.

**Transactions/locking:** Atomic job claim/story+evidence commit; lease/CAS replaces row locks.

**Code references:** `src/server/three-and-out/schema.ts`:9; `src/server/three-and-out/daily-service.ts`:220; `src/server/story-engine/repository.ts`:280, 429, 476; `src/server/monitoring/observer.ts`:67; `scripts/content-ollama-stress-test.ts`:95, 96; `scripts/sync-production-content-to-local.ts`:10

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| story_id | uuid | NO | `none` |
| version | int4 | NO | `none` |
| headline | text | NO | `none` |
| summary | text | NO | `none` |
| what_happened | text | NO | `none` |
| why_it_matters | text | NO | `none` |
| whats_next | text | NO | `none` |
| status | text | NO | `none` |
| publication_state | text | NO | `none` |
| importance_score | int4 | NO | `none` |
| confidence_score | int4 | NO | `none` |
| evidence_ids | jsonb | NO | `'[]'::jsonb` |
| claims | jsonb | NO | `'[]'::jsonb` |
| material_change_type | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE TABLE IF NOT EXISTS story_versions (
  id uuid PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES canonical_stories(id) ON DELETE CASCADE,
  version integer NOT NULL,
  headline text NOT NULL,
  summary text NOT NULL,
  what_happened text NOT NULL,
  why_it_matters text NOT NULL,
  whats_next text NOT NULL,
  status text NOT NULL,
  publication_state text NOT NULL,
  importance_score integer NOT NULL,
  confidence_score integer NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  material_change_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,version)
);
```

Source: `db/migrations/012_source_watcher_story_engine.sql`

```sql
CREATE INDEX IF NOT EXISTS story_versions_story_idx ON story_versions(story_id,version DESC);
```


## three and out push deliveries

**Table:** `three_and_out_push_deliveries` · **Class F** · **Purpose:** Delivery idempotency claims, attempts and outcomes.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/three-and-out/schema.ts`:21, 65; `src/server/three-and-out/daily-service.ts`:296, 321, 327, 331, 333, 334, 354, 359

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| briefing_id | text | NO | `none` |
| user_id | uuid | NO | `none` |
| channel | text | NO | `'PUSH'::text` |
| status | text | NO | `none` |
| attempt_count | int4 | NO | `0` |
| last_error | text | YES | `none` |
| attempted_at | timestamptz | YES | `none` |
| delivered_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| delivery_date | date | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/033_three_and_out_daily.sql`

```sql
CREATE TABLE IF NOT EXISTS three_and_out_push_deliveries (
  briefing_id text NOT NULL REFERENCES three_and_out_snapshots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'PUSH',
  status text NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (briefing_id, user_id, channel)
);
```

Source: `db/migrations/047_three_out_delivery_timing.sql`

```sql
ALTER TABLE three_and_out_push_deliveries ADD COLUMN IF NOT EXISTS delivery_date date;
```

Source: `db/migrations/047_three_out_delivery_timing.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS three_out_user_delivery_day_idx
  ON three_and_out_push_deliveries(user_id, delivery_date, channel) WHERE delivery_date IS NOT NULL;
```


## three and out snapshots

**Table:** `three_and_out_snapshots` · **Class E** · **Purpose:** Published daily briefing versions/items; derived but preserve delivered history.

**Local count:** 0. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Ingestion refresh and daily generation; public display and delivery reads.

**Reconstructable:** Yes for current view; historical delivered payload may not reproduce exactly.

**Placement:** Compact snapshots relationally; retain immutable delivered version reference.

**Transactions/locking:** Unique daily/version identity and delivery-safe publication.

**Code references:** `src/server/three-and-out/schema.ts`:5, 65; `src/server/three-and-out/daily-service.ts`:146, 162, 191, 219, 281, 290; `src/server/content/content-health.ts`:44; `scripts/sync-production-content-to-local.ts`:13, 47

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | text | NO | `none` |
| team_id | text | NO | `none` |
| story_ids | jsonb | NO | `none` |
| story_versions | jsonb | NO | `none` |
| generated_at | timestamptz | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| briefing_date | date | YES | `none` |
| status | text | NO | `'PUBLISHED'::text` |
| source_window_start | timestamptz | YES | `none` |
| source_window_end | timestamptz | YES | `none` |
| published_at | timestamptz | YES | `none` |
| items | jsonb | YES | `none` |
| summary_version | text | NO | `'daily-v1'::text` |
| audio_status | text | NO | `'DISABLED'::text` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/013_story_downstream_projections.sql`

```sql
CREATE TABLE IF NOT EXISTS three_and_out_snapshots (
  id text PRIMARY KEY,
  team_id text NOT NULL,
  story_ids jsonb NOT NULL,
  story_versions jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/013_story_downstream_projections.sql`

```sql
CREATE INDEX IF NOT EXISTS three_and_out_snapshots_team_idx ON three_and_out_snapshots(team_id,generated_at DESC);
```

Source: `db/migrations/033_three_and_out_daily.sql`

```sql
ALTER TABLE three_and_out_snapshots
  ADD COLUMN IF NOT EXISTS briefing_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS source_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS source_window_end timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS items jsonb,
  ADD COLUMN IF NOT EXISTS summary_version text NOT NULL DEFAULT 'daily-v1',
  ADD COLUMN IF NOT EXISTS audio_status text NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
```

Source: `db/migrations/033_three_and_out_daily.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS three_and_out_daily_team_date_idx
  ON three_and_out_snapshots(team_id, briefing_date)
  WHERE briefing_date IS NOT NULL AND status = 'PUBLISHED';
```


## trivia answers

**Table:** `trivia_answers` · **Class A** · **Purpose:** Trivia answers.

**Local count:** 5. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/game-repository.ts`:52, 70, 129, 151, 255; `src/server/trivia/repository.ts`:47, 78

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| question_id | text | NO | `none` |
| game_id | uuid | YES | `none` |
| daily_question_id | uuid | YES | `none` |
| selected_answer | bpchar | YES | `none` |
| correct | bool | NO | `none` |
| response_time_ms | int4 | NO | `none` |
| points_awarded | int4 | NO | `0` |
| answered_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_answers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES trivia_questions(id),
  game_id uuid REFERENCES trivia_games(id) ON DELETE CASCADE,
  daily_question_id uuid REFERENCES trivia_daily_questions(id) ON DELETE CASCADE,
  selected_answer char(1) NOT NULL CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  correct boolean NOT NULL,
  response_time_ms integer NOT NULL CHECK (response_time_ms >= 0),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id, game_id),
  UNIQUE (user_id, daily_question_id)
);
```

Source: `db/migrations/007_trivia.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_answers_user_idx ON trivia_answers(user_id, answered_at DESC);
```

Source: `db/migrations/007_trivia.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_answers_game_idx ON trivia_answers(game_id, answered_at);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_answers ALTER COLUMN selected_answer DROP NOT NULL;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_answers DROP CONSTRAINT IF EXISTS trivia_answers_selected_answer_check;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_answers ADD CONSTRAINT trivia_answers_selected_answer_check CHECK (selected_answer IS NULL OR selected_answer IN ('A','B','C','D'));
```


## trivia challenges

**Table:** `trivia_challenges` · **Class A** · **Purpose:** Trivia challenges.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/social-repository.ts`:57, 61, 65

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| challenger_user_id | uuid | NO | `none` |
| challenged_user_id | uuid | NO | `none` |
| game_id | uuid | NO | `none` |
| status | text | NO | `'PENDING'::text` |
| created_at | timestamptz | NO | `now()` |
| expires_at | timestamptz | NO | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_challenges (
  id uuid PRIMARY KEY,
  challenger_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenged_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'COMPLETED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
```

Source: `db/migrations/007_trivia.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_challenges_user_idx ON trivia_challenges(challenged_user_id, status, created_at DESC);
```


## trivia daily questions

**Table:** `trivia_daily_questions` · **Class B** · **Purpose:** Trivia daily questions.

**Local count:** 9. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/trivia/repository.ts`:24, 38

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| team_id | text | NO | `none` |
| question_date | date | NO | `none` |
| question_id | text | NO | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_daily_questions (
  id uuid PRIMARY KEY,
  team_id text NOT NULL,
  question_date date NOT NULL,
  question_id text NOT NULL REFERENCES trivia_questions(id),
  UNIQUE (team_id, question_date)
);
```


## trivia daily views

**Table:** `trivia_daily_views` · **Class A** · **Purpose:** Trivia daily views.

**Local count:** 9. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/repository.ts`:52, 57

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| daily_question_id | uuid | NO | `none` |
| presented_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_daily_views (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_question_id uuid NOT NULL REFERENCES trivia_daily_questions(id) ON DELETE CASCADE,
  presented_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,daily_question_id)
);
```


## trivia event registrations

**Table:** `trivia_event_registrations` · **Class A** · **Purpose:** Trivia event registrations.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/event-repository.ts`:14, 15, 40, 43, 56

**Declared schema and ordered changes:**

Source: `db/migrations/045_trivia_scheduled_events.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_event_registrations (
  event_id uuid NOT NULL REFERENCES trivia_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid REFERENCES trivia_games(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
```


## trivia events

**Table:** `trivia_events` · **Class B** · **Purpose:** Trivia events.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/trivia/event-repository.ts`:16, 35

**Declared schema and ordered changes:**

Source: `db/migrations/045_trivia_scheduled_events.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_events (
  id uuid PRIMARY KEY,
  team_id text NOT NULL,
  question_set_game_id uuid NOT NULL REFERENCES trivia_games(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','LIVE','COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at > starts_at)
);
```

Source: `db/migrations/045_trivia_scheduled_events.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_events_upcoming_idx ON trivia_events(team_id,status,starts_at);
```


## trivia friendships

**Table:** `trivia_friendships` · **Class A** · **Purpose:** Trivia friendships.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/social-repository.ts`:31, 35, 41, 46

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| requester_user_id | uuid | NO | `none` |
| addressee_user_id | uuid | NO | `none` |
| status | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| accepted_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_friendships (
  requester_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (requester_user_id, addressee_user_id),
  CHECK (requester_user_id <> addressee_user_id)
);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS trivia_friendships_pair_idx ON trivia_friendships(least(requester_user_id,addressee_user_id),greatest(requester_user_id,addressee_user_id));
```


## trivia game participants

**Table:** `trivia_game_participants` · **Class A** · **Purpose:** Trivia game participants.

**Local count:** 8. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/game-repository.ts`:25, 31, 37, 70, 125, 153, 154, 172, 175, 178, 196, 251; `src/server/trivia/repository.ts`:138; `src/server/trivia/event-repository.ts`:55; `src/server/trivia/social-repository.ts`:23, 56, 67, 110, 112, 119, 121, 132, 135, 137, 149, 160, 174, 176, 188, 191; `scripts/audit-trivia-redesign.ts`:27

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| game_id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| score | int4 | NO | `0` |
| correct_answers | int4 | NO | `0` |
| completed_at | timestamptz | YES | `none` |
| wrong_answers | int4 | NO | `0` |
| timeouts | int4 | NO | `0` |
| response_time_total_ms | int8 | NO | `0` |
| best_question_score | int4 | NO | `0` |
| participant_status | text | NO | `'JOINED'::text` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_game_participants (
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  completed_at timestamptz,
  PRIMARY KEY (game_id, user_id)
);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_game_participants_user_idx ON trivia_game_participants(user_id,completed_at);
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS wrong_answers integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS timeouts integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS response_time_total_ms bigint NOT NULL DEFAULT 0;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS best_question_score integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants ADD COLUMN IF NOT EXISTS participant_status text NOT NULL DEFAULT 'JOINED';
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants DROP CONSTRAINT IF EXISTS trivia_game_participants_status_check;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_game_participants ADD CONSTRAINT trivia_game_participants_status_check
  CHECK (participant_status IN ('INVITED','JOINED'));
```


## trivia game questions

**Table:** `trivia_game_questions` · **Class A** · **Purpose:** Trivia game questions.

**Local count:** 75. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/game-repository.ts`:24, 70, 91, 94, 138, 255; `src/server/trivia/repository.ts`:136; `src/server/trivia/event-repository.ts`:48, 54; `src/server/trivia/social-repository.ts`:22; `scripts/audit-trivia-redesign.ts`:30, 31, 72, 74, 79, 84, 95

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| game_id | uuid | NO | `none` |
| question_id | text | NO | `none` |
| position | int4 | NO | `none` |
| presented_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_game_questions (
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES trivia_questions(id),
  position integer NOT NULL CHECK (position >= 1),
  PRIMARY KEY (game_id, position),
  UNIQUE (game_id, question_id)
);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_game_questions ADD COLUMN IF NOT EXISTS presented_at timestamptz;
```


## trivia games

**Table:** `trivia_games` · **Class A** · **Purpose:** Trivia games.

**Local count:** 8. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/game-repository.ts`:22, 47, 117, 177; `src/server/trivia/repository.ts`:133; `src/server/trivia/event-repository.ts`:52; `src/server/trivia/social-repository.ts`:20, 61, 102, 105, 138, 145, 156, 169, 184; `scripts/audit-trivia-redesign.ts`:28, 73, 145

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| mode | text | NO | `none` |
| team_id | text | NO | `none` |
| status | text | NO | `'ACTIVE'::text` |
| created_by_user_id | uuid | YES | `none` |
| started_at | timestamptz | NO | `now()` |
| completed_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| question_count | int4 | NO | `10` |
| timer_seconds | int4 | NO | `15` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_games (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('QUICK', 'FULL', 'FRIEND_CHALLENGE', 'GROUP')),
  team_id text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'EXPIRED')),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_games ADD COLUMN IF NOT EXISTS question_count integer NOT NULL DEFAULT 10 CHECK (question_count IN (5,10));
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_games ADD COLUMN IF NOT EXISTS timer_seconds integer NOT NULL DEFAULT 15 CHECK (timer_seconds BETWEEN 5 AND 60);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_games DROP CONSTRAINT IF EXISTS trivia_games_status_check;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_games ADD CONSTRAINT trivia_games_status_check CHECK(status IN('WAITING','ACTIVE','COMPLETED','EXPIRED'));
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_games_team_created_idx ON trivia_games(team_id,created_at DESC);
```


## trivia groups

**Table:** `trivia_groups` · **Class A** · **Purpose:** Trivia groups.

**Local count:** 2. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/social-repository.ts`:80, 102, 105, 130, 145, 156, 169

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| game_id | uuid | NO | `none` |
| join_code | text | NO | `none` |
| host_user_id | uuid | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| invite_token_hash | text | YES | `none` |
| expires_at | timestamptz | NO | `(now() + '24:00:00'::interval)` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_groups (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL UNIQUE REFERENCES trivia_games(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,
  host_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_groups ADD COLUMN IF NOT EXISTS invite_token_hash text;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE trivia_groups ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS trivia_groups_invite_token_idx
  ON trivia_groups(invite_token_hash) WHERE invite_token_hash IS NOT NULL;
```


## trivia invitations

**Table:** `trivia_invitations` · **Class A** · **Purpose:** Trivia invitations.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/social-repository.ts`:82, 114, 123

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| game_id | uuid | NO | `none` |
| inviter_user_id | uuid | NO | `none` |
| invited_user_id | uuid | YES | `none` |
| invited_phone_hash | text | YES | `none` |
| invite_token_hash | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| accepted_at | timestamptz | YES | `none` |
| expires_at | timestamptz | NO | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/009_trivia_buddies.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_invitations (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  invited_phone_hash text,
  invite_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  CHECK (invited_phone_hash IS NULL OR length(invited_phone_hash) >= 32)
);
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_invitations_game_idx ON trivia_invitations(game_id,expires_at);
```


## trivia questions

**Table:** `trivia_questions` · **Class B** · **Purpose:** Trivia questions.

**Local count:** 320. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `src/server/trivia/game-repository.ts`:20, 94, 138; `src/server/trivia/repository.ts`:14, 24; `src/server/trivia/event-repository.ts`:48; `src/server/trivia/social-repository.ts`:18; `src/server/trivia/question-pool.ts`:16, 30; `scripts/audit-trivia-redesign.ts`:30; `scripts/seed-trivia.ts`:64, 83

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | text | NO | `none` |
| team_id | text | NO | `none` |
| question | text | NO | `none` |
| answer_a | text | NO | `none` |
| answer_b | text | NO | `none` |
| answer_c | text | NO | `none` |
| answer_d | text | NO | `none` |
| correct_answer | bpchar | NO | `none` |
| explanation | text | NO | `none` |
| category | text | NO | `none` |
| season_reference | int4 | YES | `none` |
| era | text | YES | `none` |
| source_note | text | YES | `none` |
| verified | bool | NO | `false` |
| active | bool | NO | `true` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| question_type | text | NO | `'MULTIPLE_CHOICE'::text` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_questions (
  id text PRIMARY KEY,
  team_id text NOT NULL,
  question text NOT NULL,
  answer_a text NOT NULL,
  answer_b text NOT NULL,
  answer_c text NOT NULL,
  answer_d text NOT NULL,
  correct_answer char(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation text NOT NULL,
  category text NOT NULL,
  season_reference integer,
  era text,
  source_note text,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/007_trivia.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_questions_team_active_idx ON trivia_questions(team_id, active, id);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_questions ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'MULTIPLE_CHOICE';
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_questions DROP CONSTRAINT IF EXISTS trivia_questions_type_check;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_questions ADD CONSTRAINT trivia_questions_type_check CHECK (question_type IN ('MULTIPLE_CHOICE','TRUE_FALSE','IMAGE','ORDER','PLAYER_MATCH','STAT_CLOSEST','WHO_AM_I'));
```


## trivia rank snapshots

**Table:** `trivia_rank_snapshots` · **Class D** · **Purpose:** Trivia rank snapshots.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Updated by imports/indexing or score events; read by search/rank/research pages.

**Reconstructable:** Yes from canonical records/award-answer history if retained.

**Placement:** Derived relational index/projection; embeddings separate for D1.

**Transactions/locking:** Atomic per-document replacement or aggregate update; replayable checkpoints.

**Code references:** `src/server/trivia/game-repository.ts`:31, 154; `src/server/trivia/social-repository.ts`:137

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| game_id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| question_position | int4 | NO | `none` |
| rank | int4 | NO | `none` |
| score | int4 | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/009_trivia_buddies.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_rank_snapshots (
  game_id uuid NOT NULL REFERENCES trivia_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_position integer NOT NULL CHECK (question_position BETWEEN 0 AND 10),
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 5),
  score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id,user_id,question_position)
);
```


## trivia stats

**Table:** `trivia_stats` · **Class D** · **Purpose:** Trivia stats.

**Local count:** 2. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Updated by imports/indexing or score events; read by search/rank/research pages.

**Reconstructable:** Yes from canonical records/award-answer history if retained.

**Placement:** Derived relational index/projection; embeddings separate for D1.

**Transactions/locking:** Atomic per-document replacement or aggregate update; replayable checkpoints.

**Code references:** `src/server/rewards/repository.ts`:114; `src/server/trivia/game-repository.ts`:155, 178, 242; `src/server/trivia/repository.ts`:88, 91, 92, 93, 94, 120

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| lifetime_points | int4 | NO | `0` |
| weekly_points | int4 | NO | `0` |
| questions_answered | int4 | NO | `0` |
| correct_answers | int4 | NO | `0` |
| games_played | int4 | NO | `0` |
| current_streak | int4 | NO | `0` |
| best_streak | int4 | NO | `0` |
| response_time_total_ms | int8 | NO | `0` |
| updated_at | timestamptz | NO | `now()` |
| best_game_score | int4 | NO | `0` |
| wins | int4 | NO | `0` |
| losses | int4 | NO | `0` |
| ties | int4 | NO | `0` |

**Declared schema and ordered changes:**

Source: `db/migrations/007_trivia.sql`

```sql
CREATE TABLE IF NOT EXISTS trivia_stats (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lifetime_points integer NOT NULL DEFAULT 0,
  weekly_points integer NOT NULL DEFAULT 0,
  questions_answered integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  response_time_total_ms bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS best_game_score integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
ALTER TABLE trivia_stats ADD COLUMN IF NOT EXISTS ties integer NOT NULL DEFAULT 0;
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_stats_lifetime_rank_idx ON trivia_stats(lifetime_points DESC,user_id);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE INDEX IF NOT EXISTS trivia_stats_weekly_rank_idx ON trivia_stats(weekly_points DESC,user_id);
```


## user consents

**Table:** `user_consents` · **Class A** · **Purpose:** User consents.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/account-repository.ts`:17; `src/server/notifications/repository.ts`:165, 172

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| channel | text | NO | `none` |
| consent_type | text | NO | `none` |
| policy_version | text | NO | `none` |
| granted_at | timestamptz | NO | `now()` |
| revoked_at | timestamptz | YES | `none` |
| updated_at | timestamptz | NO | `now()` |
| source | text | NO | `none` |
| metadata | jsonb | YES | `'{}'::jsonb` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('SMS', 'EMAIL', 'PUSH', 'TERMS', 'PRIVACY')),
  consent_type text NOT NULL,
  policy_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);
```

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE INDEX IF NOT EXISTS user_consents_user_type_idx ON user_consents(user_id, consent_type, channel);
```


## user content state

**Table:** `user_content_state` · **Class A** · **Purpose:** User content state.

**Local count:** 4. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/content-repository.ts`:29, 35, 42, 48, 49, 50, 51, 52, 53

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| content_type | text | NO | `none` |
| content_id | text | NO | `none` |
| media_version | text | YES | `none` |
| first_viewed_at | timestamptz | YES | `none` |
| last_viewed_at | timestamptz | YES | `none` |
| completed_at | timestamptz | YES | `none` |
| progress_seconds | numeric | YES | `none` |
| duration_seconds | numeric | YES | `none` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE TABLE IF NOT EXISTS user_content_state (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('STORY', 'THREE_AND_OUT', 'AUDIO', 'VIDEO', 'PODCAST', 'OTHER')),
  content_id text NOT NULL,
  media_version text,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  progress_seconds numeric,
  duration_seconds numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);
```

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE INDEX IF NOT EXISTS user_content_state_user_updated_idx
  ON user_content_state(user_id, updated_at DESC);
```


## user credentials

**Table:** `user_credentials` · **Class A** · **Purpose:** Password hashes and lockout state.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/auth/repository.ts`:70, 81, 87, 91, 338

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| password_hash | text | NO | `none` |
| password_changed_at | timestamptz | NO | `now()` |
| failed_attempts | int4 | NO | `0` |
| locked_until | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```


## user devices

**Table:** `user_devices` · **Class A** · **Purpose:** Notification installations and browser devices.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/notifications/web-push-repository.ts`:10; `src/server/notifications/repository.ts`:17, 37, 41, 57, 81, 109

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| platform | text | NO | `none` |
| device_name | text | YES | `none` |
| app_version | text | YES | `none` |
| os_version | text | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| last_seen_at | timestamptz | YES | `none` |
| disabled_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('IOS', 'ANDROID', 'WEB')),
  device_name text,
  app_version text,
  os_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  disabled_at timestamptz
);
```

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON user_devices(user_id);
```

Source: `db/migrations/015_expo_push_delivery.sql`

```sql
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS installation_id text;
```

Source: `db/migrations/015_expo_push_delivery.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_installation_idx
  ON user_devices(user_id, installation_id) WHERE installation_id IS NOT NULL;
```


## user front office saves

**Table:** `user_front_office_saves` · **Class A** · **Purpose:** Owned franchise metadata, version and full JSON simulation.

**Local count:** 4. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/front-office/repository.ts`:44, 54, 70, 78, 79, 80, 81, 97

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| save_id | text | NO | `none` |
| team_abbr | text | NO | `none` |
| season | int4 | NO | `none` |
| selected_path | text | YES | `none` |
| simulation_phase | text | YES | `none` |
| simulation_state | jsonb | YES | `none` |
| version | int4 | NO | `1` |
| initialized_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/031_front_office_save_state.sql`

```sql
CREATE TABLE IF NOT EXISTS user_front_office_saves (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  save_id text NOT NULL,
  team_abbr text NOT NULL,
  season integer NOT NULL,
  selected_path text CHECK (selected_path IN ('full', 'free_agency', 'draft')),
  simulation_phase text,
  simulation_state jsonb,
  version integer NOT NULL DEFAULT 1,
  initialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, save_id)
);
```

Source: `db/migrations/031_front_office_save_state.sql`

```sql
CREATE INDEX IF NOT EXISTS user_front_office_saves_team_season_idx
  ON user_front_office_saves(user_id, team_abbr, season);
```

Source: `db/migrations/031_front_office_save_state.sql`

```sql
ALTER TABLE user_front_office_saves
  ADD COLUMN IF NOT EXISTS simulation_state jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
```


## user identities

**Table:** `user_identities` · **Class A** · **Purpose:** External/provider login identities and linking.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/auth/repository.ts`:67, 100, 103, 143, 154, 158, 177, 181, 308, 334

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| provider | text | NO | `none` |
| provider_subject | text | NO | `none` |
| provider_email | text | YES | `none` |
| provider_email_verified | bool | NO | `false` |
| provider_display_name | text | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| last_used_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('APPLE', 'GOOGLE', 'FACEBOOK', 'EMAIL')),
  provider_subject text NOT NULL,
  provider_email text,
  provider_email_verified boolean NOT NULL DEFAULT false,
  provider_display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (provider, provider_subject)
);
```

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE INDEX IF NOT EXISTS user_identities_user_id_idx ON user_identities(user_id);
```


## user notification preferences

**Table:** `user_notification_preferences` · **Class A** · **Purpose:** Per-channel/category/topic settings and Three & Out local delivery schedule.

**Local count:** 6. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/three-and-out/schema.ts`:4, 65; `src/server/three-and-out/daily-service.ts`:265, 294, 301, 306; `src/server/crew/repository.ts`:238; `src/server/story-engine/repository.ts`:388; `src/server/notifications/repository.ts`:101, 127; `src/app/api/three-and-out/preferences/route.ts`:77, 84, 85

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| topic_type | text | YES | `none` |
| topic_id | text | YES | `none` |
| category | text | NO | `none` |
| channel | text | NO | `none` |
| enabled | bool | NO | `true` |
| minimum_priority | text | NO | `'NORMAL'::text` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| delivery_time | text | YES | `none` |
| delivery_timezone | text | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_type text,
  topic_id text,
  category text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('PUSH', 'SMS', 'EMAIL', 'IN_APP')),
  enabled boolean NOT NULL DEFAULT true,
  minimum_priority text NOT NULL DEFAULT 'NORMAL' CHECK (minimum_priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_type, topic_id, category, channel)
);
```

Source: `db/migrations/047_three_out_delivery_timing.sql`

```sql
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS delivery_time text CHECK (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD COLUMN IF NOT EXISTS delivery_timezone text;
```


## user notifications

**Table:** `user_notifications` · **Class A** · **Purpose:** User notifications.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/rewards/repository.ts`:71; `src/server/user/account-repository.ts`:16; `src/server/story-engine/repository.ts`:369; `src/server/notifications/repository.ts`:228, 239, 247, 252, 256, 260, 286, 310

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| event_id | text | YES | `none` |
| title | text | NO | `none` |
| body | text | NO | `none` |
| deep_link | text | YES | `none` |
| image_url | text | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| read_at | timestamptz | YES | `none` |
| dismissed_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id text,
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz
);
```

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE INDEX IF NOT EXISTS user_notifications_user_id_idx ON user_notifications(user_id, created_at DESC);
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS team_abbr text;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'SYSTEM';
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'SYSTEM';
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS content_id text;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS content_type text;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL';
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS seen_at timestamptz;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS expires_at timestamptz;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'IN_APP_CREATED';
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS push_eligible boolean NOT NULL DEFAULT false;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Source: `db/migrations/020_notification_center.sql`

```sql
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
```

Source: `db/migrations/020_notification_center.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_dedupe_idx
  ON user_notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
```

Source: `db/migrations/020_notification_center.sql`

```sql
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications(user_id,created_at DESC) WHERE read_at IS NULL AND dismissed_at IS NULL;
```

Source: `db/migrations/020_notification_center.sql`

```sql
CREATE INDEX IF NOT EXISTS user_notifications_team_idx
  ON user_notifications(user_id,team_abbr,created_at DESC);
```


## user phone numbers

**Table:** `user_phone_numbers` · **Class A** · **Purpose:** User phone numbers.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/notifications/repository.ts`:107, 137, 145, 149

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| phone_number | text | NO | `none` |
| is_verified | bool | NO | `false` |
| verified_at | timestamptz | YES | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| removed_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (user_id, phone_number)
);
```


## user player follows

**Table:** `user_player_follows` · **Class A** · **Purpose:** User player follows.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** No direct table-name consumer found in scanned server/API/scripts; migration-defined or indirect access.

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| player_id | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE TABLE IF NOT EXISTS user_player_follows (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, player_id)
);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE TABLE IF NOT EXISTS user_player_follows (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,player_id)
);
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE INDEX IF NOT EXISTS user_player_follows_player_idx ON user_player_follows(player_id);
```

Source: `db/migrations/008_trivia_gameplay_hardening.sql`

```sql
CREATE INDEX IF NOT EXISTS user_player_follows_player_idx ON user_player_follows(player_id);
```


## user poll votes

**Table:** `user_poll_votes` · **Class A** · **Purpose:** User poll votes.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/content-repository.ts`:202, 208

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| question_id | text | NO | `none` |
| option_id | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE TABLE IF NOT EXISTS user_poll_votes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
```


## user predictions

**Table:** `user_predictions` · **Class A** · **Purpose:** User predictions.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/content-repository.ts`:231, 249

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| prediction_type | text | NO | `none` |
| subject_type | text | NO | `none` |
| subject_id | text | NO | `none` |
| prediction | jsonb | NO | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| submitted_at | timestamptz | NO | `now()` |
| locked_at | timestamptz | YES | `none` |
| resolved_at | timestamptz | YES | `none` |
| result | text | YES | `none` |
| score | numeric | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE TABLE IF NOT EXISTS user_predictions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_type text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  prediction jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  resolved_at timestamptz,
  result text CHECK (result IN ('PENDING', 'CORRECT', 'INCORRECT', 'VOID')),
  score numeric,
  UNIQUE (user_id, prediction_type, subject_type, subject_id)
);
```


## user preferences

**Table:** `user_preferences` · **Class A** · **Purpose:** Favorite team and account-wide preferences.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/three-and-out/daily-service.ts`:265, 291; `src/server/auth/repository.ts`:71, 139; `src/server/user/repository.ts`:7, 39, 48, 62, 68; `src/server/story-engine/repository.ts`:385

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| favorite_team_abbr | text | YES | `none` |
| preferences | jsonb | NO | `'{}'::jsonb` |
| engagement | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| audio_playback_speed | numeric | NO | `1.00` |
| autoplay_video | bool | NO | `false` |
| reduced_motion | bool | NO | `false` |
| show_around_league | bool | NO | `true` |
| preferred_landing_experience | text | NO | `'HOME'::text` |
| push_enabled | bool | NO | `true` |
| sms_enabled | bool | NO | `false` |
| email_enabled | bool | NO | `true` |
| show_poll_results_before_voting | bool | NO | `false` |
| prediction_visibility | text | NO | `'PRIVATE'::text` |
| intensity | text | NO | `'LOCKED_IN'::text` |
| advanced_notifications | jsonb | NO | `'{}'::jsonb` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  favorite_team_abbr text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  engagement jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS audio_playback_speed numeric(3,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS autoplay_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reduced_motion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_around_league boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_landing_experience text NOT NULL DEFAULT 'HOME',
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_poll_results_before_voting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prediction_visibility text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS intensity text NOT NULL DEFAULT 'LOCKED_IN',
  ADD COLUMN IF NOT EXISTS advanced_notifications jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_audio_speed_check;
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_audio_speed_check CHECK (audio_playback_speed IN (0.75,1.00,1.25,1.50,2.00));
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_landing_check;
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_landing_check CHECK (preferred_landing_experience IN ('HOME','HUDDLE','THREE_AND_OUT','WATCH','WIRE','FRONT_OFFICE'));
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_prediction_check;
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_prediction_check CHECK (prediction_visibility IN ('PRIVATE','FRIENDS','PUBLIC'));
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_intensity_check;
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_intensity_check CHECK (intensity IN ('CASUAL','LOCKED_IN','SICKO'));
```


## user profiles

**Table:** `user_profiles` · **Class A** · **Purpose:** Locale, timezone, public profile and account settings.

**Local count:** 3. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/three-and-out/daily-service.ts`:266, 293; `src/server/auth/repository.ts`:72, 140; `src/server/user/repository.ts`:6, 13, 31, 76; `src/app/api/three-and-out/preferences/route.ts`:42; `scripts/audit-trivia-redesign.ts`:23; `scripts/audit-crew.ts`:34

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| timezone | text | NO | `'America/Chicago'::text` |
| locale | text | NO | `'en-US'::text` |
| onboarding_completed | bool | NO | `false` |
| onboarding_step | int2 | NO | `1` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/Chicago', locale text NOT NULL DEFAULT 'en-US',
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step smallint NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
```


## user push tokens

**Table:** `user_push_tokens` · **Class A** · **Purpose:** Encrypted provider credentials / web subscription endpoints.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/notifications/web-push-repository.ts`:15, 25, 29; `src/server/notifications/repository.ts`:53, 55, 65, 73, 81, 109

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| device_id | uuid | NO | `none` |
| provider | text | NO | `none` |
| token_hash | text | NO | `none` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| last_validated_at | timestamptz | YES | `none` |
| invalidated_at | timestamptz | YES | `none` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('APNS', 'FCM', 'WEB_PUSH')),
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_validated_at timestamptz,
  invalidated_at timestamptz,
  UNIQUE (user_id, device_id, provider, token_hash)
);
```

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx ON user_push_tokens(user_id);
```

Source: `db/migrations/015_expo_push_delivery.sql`

```sql
ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS token_ciphertext text;
```

Source: `db/migrations/015_expo_push_delivery.sql`

```sql
ALTER TABLE user_push_tokens DROP CONSTRAINT IF EXISTS user_push_tokens_provider_check;
```

Source: `db/migrations/015_expo_push_delivery.sql`

```sql
ALTER TABLE user_push_tokens ADD CONSTRAINT user_push_tokens_provider_check
  CHECK (provider IN ('APNS', 'FCM', 'WEB_PUSH', 'EXPO'));
```

Source: `db/migrations/046_web_push.sql`

```sql
ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS web_endpoint_hash text;
```

Source: `db/migrations/046_web_push.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_web_endpoint_idx
  ON user_push_tokens(web_endpoint_hash) WHERE web_endpoint_hash IS NOT NULL;
```


## user quiet hours

**Table:** `user_quiet_hours` · **Class A** · **Purpose:** User quiet hours.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** No direct table-name consumer found in scanned server/API/scripts; migration-defined or indirect access.

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| enabled | bool | NO | `false` |
| start_local_time | text | NO | `'22:00'::text` |
| end_local_time | text | NO | `'07:00'::text` |
| timezone | text | NO | `'America/Chicago'::text` |
| allow_breaking_override | bool | NO | `true` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/003_notifications_and_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_quiet_hours (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  start_local_time text NOT NULL DEFAULT '22:00',
  end_local_time text NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  allow_breaking_override boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
```


## user rewards

**Table:** `user_rewards` · **Class A** · **Purpose:** Per-user reward unlock, claim and redemption state.

**Local count:** 0. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/rewards/repository.ts`:66, 103, 109, 158, 168, 178

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| reward_definition_id | text | NO | `none` |
| status | text | NO | `'AVAILABLE'::text` |
| unlocked_at | timestamptz | NO | `now()` |
| claimed_at | timestamptz | YES | `none` |
| redeemed_at | timestamptz | YES | `none` |
| coupon_code | text | YES | `none` |
| expires_at | timestamptz | YES | `none` |
| fulfillment_metadata | jsonb | NO | `'{}'::jsonb` |

**Declared schema and ordered changes:**

Source: `db/migrations/011_move_the_chains_rewards.sql`

```sql
CREATE TABLE IF NOT EXISTS user_rewards (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_definition_id text NOT NULL REFERENCES reward_definitions(id),
  status text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','CLAIMED','REDEEMED','EXPIRED')),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  redeemed_at timestamptz,
  coupon_code text UNIQUE,
  expires_at timestamptz,
  fulfillment_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id,reward_definition_id)
);
```

Source: `db/migrations/011_move_the_chains_rewards.sql`

```sql
CREATE INDEX IF NOT EXISTS user_rewards_user_idx ON user_rewards(user_id,unlocked_at DESC);
```


## user saved content

**Table:** `user_saved_content` · **Class A** · **Purpose:** User saved content.

**Local count:** 1. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/content-repository.ts`:63, 79, 87

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| content_type | text | NO | `none` |
| content_id | text | NO | `none` |
| title | text | NO | `none` |
| href | text | YES | `none` |
| image_url | text | YES | `none` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE TABLE IF NOT EXISTS user_saved_content (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('STORY', 'THREE_AND_OUT', 'AUDIO', 'VIDEO', 'PODCAST', 'OTHER')),
  content_id text NOT NULL,
  title text NOT NULL,
  href text,
  image_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);
```

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE INDEX IF NOT EXISTS user_saved_content_user_created_idx
  ON user_saved_content(user_id, created_at DESC);
```


## user team follows

**Table:** `user_team_follows` · **Class A** · **Purpose:** User team follows.

**Local count:** 21. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/trivia/game-repository.ts`:31, 238; `src/server/user/repository.ts`:52, 54, 60, 61, 67

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| user_id | uuid | NO | `none` |
| team_id | text | NO | `none` |
| is_primary | bool | NO | `false` |
| notification_level | text | NO | `'DEFAULT'::text` |
| created_at | timestamptz | NO | `now()` |

**Declared schema and ordered changes:**

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE TABLE IF NOT EXISTS user_team_follows (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id text NOT NULL, is_primary boolean NOT NULL DEFAULT false,
  notification_level text NOT NULL DEFAULT 'DEFAULT' CHECK (notification_level IN ('OFF','MAJOR','DEFAULT','ALL')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, team_id)
);
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_team_follows_one_primary ON user_team_follows(user_id) WHERE is_primary;
```

Source: `db/migrations/002_user_profiles_and_preferences.sql`

```sql
CREATE INDEX IF NOT EXISTS user_team_follows_team_idx ON user_team_follows(team_id);
```


## user team visit state

**Table:** `user_team_visit_state` · **Class A** · **Purpose:** User team visit state.

**Local count:** 10. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/user/content-repository.ts`:93, 99, 132, 138, 145, 163, 187

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| user_id | uuid | NO | `none` |
| team_id | text | NO | `none` |
| last_visited_at | timestamptz | NO | `now()` |
| last_seen_snapshot_id | text | YES | `none` |
| updated_at | timestamptz | NO | `now()` |
| first_seen_at | timestamptz | NO | `now()` |
| current_visit_started_at | timestamptz | NO | `now()` |
| visit_count | int4 | NO | `1` |
| last_caught_up_at | timestamptz | YES | `none` |
| last_caught_up_snapshot_id | text | YES | `none` |
| caught_up_story_state | jsonb | NO | `'[]'::jsonb` |

**Declared schema and ordered changes:**

Source: `db/migrations/004_user_content_state.sql`

```sql
CREATE TABLE IF NOT EXISTS user_team_visit_state (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  last_visited_at timestamptz NOT NULL DEFAULT now(),
  last_seen_snapshot_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);
```

Source: `db/migrations/010_get_caught_up.sql`

```sql
ALTER TABLE user_team_visit_state
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS current_visit_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_caught_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_caught_up_snapshot_id text,
  ADD COLUMN IF NOT EXISTS caught_up_story_state jsonb NOT NULL DEFAULT '[]'::jsonb;
```


## users

**Table:** `users` · **Class A** · **Purpose:** Identity/status and profile references.

**Local count:** 3. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per-user interactions; auth lookup on protected requests, writes on actions.

**Reconstructable:** No; aggregates only if authoritative event history is preserved.

**Placement:** Yes, except uploaded media bytes and large franchise archives.

**Transactions/locking:** Preserve ownership FK, uniqueness and action atomicity; see code references for locks/begins.

**Code references:** `src/server/three-and-out/daily-service.ts`:292; `src/server/auth/repository.ts`:35, 40, 49, 65, 86, 100, 109, 125, 135, 162, 163, 171, 333; `src/server/game-day/repository.ts`:57, 90, 93; `src/server/crew/repository.ts`:27, 37, 45, 47, 100, 110, 112, 113, 169, 215, 269; `src/server/trivia/game-repository.ts`:31, 154, 242, 255; `src/server/trivia/social-repository.ts`:28, 31, 137, 149, 160; `src/server/trivia/guest.ts`:26; `src/server/user/repository.ts`:13, 30, 91; `src/server/user/account-repository.ts`:11, 27; `src/server/story-engine/repository.ts`:383; `src/app/api/trivia/friends/route.ts`:12; `scripts/audit-trivia-redesign.ts`:16, 21, 22, 25, 26, 27, 80, 96, 119, 120, 145, 146; `scripts/audit-crew.ts`:26, 27, 32, 33, 34, 35, 207; `scripts/sync-production-content-to-local.ts`:4

**Observed local columns/types/defaults** (may lag migrations):

| Column | Type | Nullable | Default / generated |
|---|---|---|---|
| id | uuid | NO | `none` |
| display_name | text | YES | `none` |
| first_name | text | YES | `none` |
| last_name | text | YES | `none` |
| primary_email | text | YES | `none` |
| email_verified | bool | NO | `false` |
| avatar_url | text | YES | `none` |
| status | text | NO | `'ACTIVE'::text` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| last_login_at | timestamptz | YES | `none` |
| is_guest | bool | NO | `false` |

**Declared schema and ordered changes:**

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  display_name text,
  first_name text,
  last_name text,
  primary_email text,
  email_verified boolean NOT NULL DEFAULT false,
  avatar_url text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
```

Source: `db/migrations/001_auth_identity.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS users_primary_email_unique
  ON users (lower(primary_email)) WHERE primary_email IS NOT NULL;
```

Source: `db/migrations/009_trivia_buddies.sql`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
```


## video source registry

**Table:** `video_source_registry` · **Class B** · **Purpose:** Video source registry.

**Local count:** not installed; unknown. **User-specific:** no direct user ownership identified.

**Read/write frequency:** Source/import/editorial writes; shared high read fan-out, cacheable.

**Reconstructable:** Usually reimportable; editorial choices/provenance/current quotes need retained source/version.

**Placement:** Yes for compact metadata; price archives/raw artifacts need separate retention.

**Transactions/locking:** Upsert/unique identity; multi-row import consistency and stable generation version.

**Code references:** `scripts/seed-video-sources.ts`:16; `scripts/video-source-health.ts`:18, 23; `scripts/resolve-youtube-sources.ts`:51, 74, 120, 122, 125, 134

**Declared schema and ordered changes:**

Source: `db/migrations/030_video_source_registry.sql`

```sql
CREATE TABLE IF NOT EXISTS video_source_registry (
  id text PRIMARY KEY,
  name text NOT NULL,
  team_id text,
  category text NOT NULL CHECK (category IN ('official','independent_media','creator','podcast','film','local_media','league_media')),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope text NOT NULL CHECK (scope IN ('team','league')),
  multi_team boolean NOT NULL DEFAULT false,
  priority integer NOT NULL CHECK (priority BETWEEN 1 AND 3),
  source_weight numeric(4,3) NOT NULL CHECK (source_weight BETWEEN 0 AND 1),
  youtube_channel_id text,
  youtube_handle text,
  youtube_url text,
  status text NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','REVIEW_REQUIRED','ERROR')),
  review_reason text,
  last_verified_at timestamptz,
  last_upload_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ACTIVE' OR (youtube_channel_id IS NOT NULL AND youtube_url IS NOT NULL)),
  CHECK (scope <> 'team' OR team_id IS NOT NULL)
);
```

Source: `db/migrations/030_video_source_registry.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS video_source_registry_channel_id_idx
  ON video_source_registry(youtube_channel_id) WHERE youtube_channel_id IS NOT NULL;
```

Source: `db/migrations/030_video_source_registry.sql`

```sql
CREATE INDEX IF NOT EXISTS video_source_registry_team_status_idx
  ON video_source_registry(team_id,status);
```


## web push test limits

**Table:** `web_push_test_limits` · **Class F** · **Purpose:** Web push test limits.

**Local count:** not installed; unknown. **User-specific:** yes (may also reference shared data).

**Read/write frequency:** Per job/delivery/security event; dashboard/status/retry reads.

**Reconstructable:** Not fully: audit outcomes and idempotency claims must survive retries.

**Placement:** Bounded operational metadata relationally; expire logs only under approved retention.

**Transactions/locking:** Unique claim/idempotency identity; conditional transitions and leases where applicable.

**Code references:** `src/server/notifications/web-push-repository.ts`:34, 36

**Declared schema and ordered changes:**

Source: `db/migrations/046_web_push.sql`

```sql
CREATE TABLE IF NOT EXISTS web_push_test_limits (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
```
