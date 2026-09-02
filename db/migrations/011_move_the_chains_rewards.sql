BEGIN;

ALTER TABLE move_the_chains_events DROP CONSTRAINT IF EXISTS move_the_chains_events_event_type_check;
ALTER TABLE move_the_chains_events ADD CONSTRAINT move_the_chains_events_event_type_check CHECK (event_type IN (
  'DAILY_TRIVIA_CORRECT','TRIVIA_CORRECT','TRIVIA_GAME_COMPLETE','TRIVIA_BUDDY_WIN',
  'CATCH_UP_COMPLETE','PREDICTION_SUBMITTED','PREDICTION_CORRECT','GAME_DAY_CHECKIN',
  'POLL_PARTICIPATION','GAME_DAY_CHECK_IN','ADMIN_ADJUSTMENT'
));

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

INSERT INTO reward_definitions (id,threshold_yards,type,title,description,discount_percent,usage_limit) VALUES
('yards-50',50,'DISCOUNT','5% off merch','One-time discount on a merch order.',5,1),
('yards-100',100,'DISCOUNT','10% off merch','One-time discount on a merch order.',10,1),
('yards-250',250,'DISCOUNT','15% off merch','One-time discount on a merch order.',15,1),
('yards-500',500,'DISCOUNT','20% off merch','One-time discount on a merch order.',20,1),
('yards-1000',1000,'DISCOUNT','25% off merch','One-time discount on a merch order.',25,1),
('yards-2500',2500,'DISCOUNT','30% off merch','One-time discount on a merch order.',30,1),
('yards-5000',5000,'STICKER_PACK','Free D&D sticker pack','Claim a free Down & Distance sticker pack.',NULL,1),
('yards-10000',10000,'DISCOUNT','40% off one merch order','Premium, one-time, non-stackable discount.',40,1)
ON CONFLICT (id) DO UPDATE SET threshold_yards=EXCLUDED.threshold_yards,type=EXCLUDED.type,title=EXCLUDED.title,description=EXCLUDED.description,discount_percent=EXCLUDED.discount_percent,usage_limit=EXCLUDED.usage_limit,updated_at=now();

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
CREATE INDEX IF NOT EXISTS user_rewards_user_idx ON user_rewards(user_id,unlocked_at DESC);

COMMIT;
