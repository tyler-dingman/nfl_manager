import { Storage, type Statement } from './core';
import { REWARD_ACTION_YARDS, type RewardActionType } from '../../src/features/rewards/config';
import { awardMoveTheChains } from '../../src/features/trivia/engine';
export class D1Rewards {
  constructor(readonly s: Storage) {}
  async account(userId: string) {
    const [row] = await this.s.rows<any>(
      'SELECT current_drive_yards AS currentDriveYards,touchdowns,lifetime_yards AS lifetimeYards,version FROM app_reward_accounts WHERE user_id=?',
      [userId],
    );
    return row ?? { currentDriveYards: 0, touchdowns: 0, lifetimeYards: 0, version: 0 };
  }
  async plan(input: {
    userId: string;
    action: RewardActionType;
    sourceType: string;
    sourceId: string;
  }) {
    const yards = REWARD_ACTION_YARDS[input.action];
    if (!Number.isFinite(yards)) throw Error('Unknown reward action');
    const key = `${input.action}:${input.userId}:${input.sourceType}:${input.sourceId}`;
    const prior = await this.s.rows(
      'SELECT id FROM app_reward_events WHERE user_id=? AND idempotency_key=?',
      [input.userId, key],
    );
    const previous = await this.account(input.userId);
    const empty = {
      awarded: false,
      yardsAwarded: 0,
      touchdownsEarned: 0,
      progress: previous,
      unlockedRewards: [] as any[],
    };
    if (prior.length) return { statements: [] as Statement[], result: empty };
    const next = awardMoveTheChains(
      previous.currentDriveYards,
      previous.touchdowns,
      previous.lifetimeYards,
      yards,
    );
    const crossed = await this.s.rows<any>(
      'SELECT id,title,threshold_yards AS thresholdYards FROM app_reward_definitions WHERE active=1 AND threshold_yards>? AND threshold_yards<=? ORDER BY threshold_yards,id',
      [previous.lifetimeYards, next.lifetimeYards],
    );
    if (crossed.length > 10) throw Error('Reward transaction exceeds bounded definition count');
    const nonce = crypto.randomUUID(),
      now = Date.now();
    const statements = [
      this.s.statement(
        'INSERT INTO app_reward_accounts(user_id) VALUES(?) ON CONFLICT DO NOTHING',
        [input.userId],
      ),
      this.s.statement(
        'UPDATE app_reward_accounts SET current_drive_yards=?,touchdowns=?,lifetime_yards=?,version=version+1 WHERE user_id=? AND version=?',
        [
          next.currentDriveYards,
          next.touchdowns,
          next.lifetimeYards,
          input.userId,
          previous.version,
        ],
      ),
      this.s.guard(nonce),
      this.s.unguard(nonce),
      this.s.statement(
        'INSERT INTO app_reward_events(id,user_id,event_type,yards,source_type,source_id,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?)',
        [
          crypto.randomUUID(),
          input.userId,
          input.action,
          yards,
          input.sourceType,
          input.sourceId,
          key,
          now,
        ],
      ),
    ];
    for (const reward of crossed)
      statements.push(
        this.s.statement(
          'INSERT INTO app_user_rewards(id,user_id,reward_definition_id,unlocked_at) VALUES(?,?,?,?) ON CONFLICT(user_id,reward_definition_id) DO NOTHING',
          [crypto.randomUUID(), input.userId, reward.id, now],
        ),
        this.s.statement(
          'INSERT INTO app_reward_notifications(id,user_id,reward_id,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,reward_id) DO NOTHING',
          [crypto.randomUUID(), input.userId, reward.id, now],
        ),
      );
    return {
      statements,
      result: {
        awarded: true,
        yardsAwarded: yards,
        touchdownsEarned: next.touchdowns - previous.touchdowns,
        progress: next,
        unlockedRewards: crossed,
      },
    };
  }
  async award(input: Parameters<D1Rewards['plan']>[0]) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const plan = await this.plan(input);
      if (!plan.statements.length) return plan.result;
      try {
        await this.s.batch(plan.statements);
        return plan.result;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    throw Error('Concurrent reward update; retry command');
  }
}
