BEGIN;
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS delivery_time text CHECK (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD COLUMN IF NOT EXISTS delivery_timezone text;
ALTER TABLE three_and_out_push_deliveries ADD COLUMN IF NOT EXISTS delivery_date date;
-- Legacy deliveries remain recorded under their briefing; new claims also deduplicate by local day.
CREATE UNIQUE INDEX IF NOT EXISTS three_out_user_delivery_day_idx
  ON three_and_out_push_deliveries(user_id, delivery_date, channel) WHERE delivery_date IS NOT NULL;
COMMIT;
