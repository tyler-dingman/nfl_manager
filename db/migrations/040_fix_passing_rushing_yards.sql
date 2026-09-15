BEGIN;

UPDATE bet_markets
SET market_type = 'PASSING_RUSHING_YARDS',
    normalized_key = regexp_replace(
      normalized_key,
      '^rushing_yards:',
      'passing_rushing_yards:'
    ),
    updated_at = now()
WHERE regexp_replace(lower(stat_id), '[^a-z0-9]', '', 'g') LIKE '%passingrushingyards%'
  AND market_type <> 'PASSING_RUSHING_YARDS';

COMMIT;
