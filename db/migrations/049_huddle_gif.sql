-- Extend the existing chat table. Store references only, never provider media binaries/URLs.
ALTER TABLE huddle_messages ADD COLUMN IF NOT EXISTS media jsonb;
ALTER TABLE huddle_messages ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES huddle_messages(id);
ALTER TABLE huddle_messages DROP CONSTRAINT IF EXISTS huddle_messages_body_check;
ALTER TABLE huddle_messages ADD CONSTRAINT huddle_messages_body_check
 CHECK (length(body)<=1000 AND (length(trim(body))>0 OR media IS NOT NULL));
ALTER TABLE huddle_messages DROP CONSTRAINT IF EXISTS huddle_messages_media_check;
ALTER TABLE huddle_messages ADD CONSTRAINT huddle_messages_media_check CHECK (
 media IS NULL OR (jsonb_typeof(media)='object'
 AND media->>'mediaType'='gif' AND media->>'provider'='klipy'
 AND media->>'providerMediaId' ~ '^[a-zA-Z0-9_-]{1,160}$'
 AND media ?& ARRAY['mediaType','provider','providerMediaId']
 AND media - ARRAY['mediaType','provider','providerMediaId'] = '{}'::jsonb));
