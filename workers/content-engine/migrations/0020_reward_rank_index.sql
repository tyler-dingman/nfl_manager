-- Additional rank index; catalog rows are inserted lazily or imported with original IDs.
CREATE INDEX app_reward_rank ON app_reward_accounts(lifetime_yards DESC,user_id);
