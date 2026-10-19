import { Storage, type Statement } from './core';
import { D1Rewards } from './rewards';
import { REWARD_ACTION_YARDS, type RewardActionType } from '../../src/features/rewards/config';
import { awardMoveTheChains } from '../../src/features/trivia/engine';
export async function planRewardBatch(
  s: Storage,
  inputs: { userId: string; action: RewardActionType; sourceType: string; sourceId: string }[],
) {
  const statements: Statement[] = [],
    results = new Map<
      string,
      { yardsAwarded: number; touchdownsEarned: number; unlockedRewards: any[] }
    >();
  if (!inputs.length) return { statements, results };
  const rewards = new D1Rewards(s);
  await rewards.ensureCatalog();
  for (const user of new Set(inputs.map((i) => i.userId))) {
    const previous = await rewards.account(user),
      keys = inputs
        .filter((i) => i.userId === user)
        .map((i) => ({ ...i, key: `${i.action}:${i.userId}:${i.sourceType}:${i.sourceId}` })),
      prior = await s.rows<any>(
        'SELECT idempotency_key FROM app_reward_events WHERE user_id=? AND idempotency_key IN(SELECT value FROM json_each(?))',
        [user, JSON.stringify(keys.map((k) => k.key))],
      );
    const active = keys.filter((k) => !prior.some((p) => p.idempotency_key === k.key));
    let next = previous;
    for (const input of active)
      next = {
        ...next,
        ...awardMoveTheChains(
          next.currentDriveYards,
          next.touchdowns,
          next.lifetimeYards,
          REWARD_ACTION_YARDS[input.action],
        ),
      };
    const crossed = await s.rows<any>(
      'SELECT id,title,threshold_yards AS thresholdYards FROM app_reward_definitions WHERE active=1 AND threshold_yards>? AND threshold_yards<=? ORDER BY threshold_yards,id',
      [previous.lifetimeYards, next.lifetimeYards],
    );
    results.set(user, {
      yardsAwarded: next.lifetimeYards - previous.lifetimeYards,
      touchdownsEarned: next.touchdowns - previous.touchdowns,
      unlockedRewards: crossed,
    });
    if (!active.length) continue;
    const nonce = crypto.randomUUID(),
      now = Date.now();
    statements.push(
      s.statement('INSERT INTO app_reward_accounts(user_id) VALUES(?) ON CONFLICT DO NOTHING', [
        user,
      ]),
      s.statement(
        'UPDATE app_reward_accounts SET current_drive_yards=?,touchdowns=?,lifetime_yards=?,version=version+1 WHERE user_id=? AND version=?',
        [next.currentDriveYards, next.touchdowns, next.lifetimeYards, user, previous.version],
      ),
      s.guard(nonce),
      s.unguard(nonce),
      s.statement(
        "INSERT INTO app_reward_events(id,user_id,event_type,yards,source_type,source_id,idempotency_key,created_at) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.action'),json_extract(value,'$.yards'),json_extract(value,'$.sourceType'),json_extract(value,'$.sourceId'),json_extract(value,'$.key'),? FROM json_each(?)",
        [
          user,
          now,
          JSON.stringify(
            active.map((a) => ({
              ...a,
              id: crypto.randomUUID(),
              yards: REWARD_ACTION_YARDS[a.action],
            })),
          ),
        ],
      ),
    );
    for (const reward of crossed)
      statements.push(
        s.statement(
          'INSERT INTO app_user_rewards(id,user_id,reward_definition_id,unlocked_at) VALUES(?,?,?,?) ON CONFLICT(user_id,reward_definition_id) DO NOTHING',
          [crypto.randomUUID(), user, reward.id, now],
        ),
        s.statement(
          'INSERT INTO app_reward_notifications(id,user_id,reward_id,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,reward_id) DO NOTHING',
          [crypto.randomUUID(), user, reward.id, now],
        ),
      );
  }
  return { statements, results };
}
