import { activeDayStreak } from '../rewards/presentation';
import { Storage, type Statement } from './core';
import {
  REWARD_ACTION_YARDS,
  REWARD_DEFINITIONS,
  type RewardActionType,
} from '../../src/features/rewards/config';
import { awardMoveTheChains } from '../../src/features/trivia/engine';
export class D1Rewards {
  constructor(readonly s: Storage) {}
  async ensureCatalog() {
    const [count] = await this.s.rows<{ n: number }>(
      `SELECT count(*) AS n FROM app_reward_definitions WHERE id IN (${REWARD_DEFINITIONS.map(() => '?').join(',')})`,
      REWARD_DEFINITIONS.map((r) => r.id),
    );
    if (count.n === REWARD_DEFINITIONS.length) return;
    await this.s.batch(
      REWARD_DEFINITIONS.map((r) =>
        this.s.statement(
          'INSERT INTO app_reward_definitions(id,type,title,description,threshold_yards,discount_percent,active) VALUES(?,?,?,?,?,?,1) ON CONFLICT DO NOTHING',
          [r.id, r.type, r.title, r.description, r.thresholdYards, r.discountPercent],
        ),
      ),
    );
  }
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
    await this.ensureCatalog();
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
  async dashboard(userId: string) {
    await this.ensureCatalog();
    await this.s
      .statement('INSERT INTO app_reward_accounts(user_id) VALUES(?) ON CONFLICT DO NOTHING', [
        userId,
      ])
      .run();
    const { version, ...progress } = await this.account(userId);
    await this.s
      .statement(
        'INSERT INTO app_user_rewards(id,user_id,reward_definition_id,unlocked_at) SELECT ?||id,?,id,? FROM app_reward_definitions WHERE active=1 AND threshold_yards<=? ON CONFLICT(user_id,reward_definition_id) DO NOTHING',
        [crypto.randomUUID() + ':', userId, Date.now(), progress.lifetimeYards],
      )
      .run();
    const rewards = await this.s.rows<any>(
      "SELECT r.id,r.threshold_yards AS thresholdYards,r.type,r.title,r.description,r.discount_percent AS discountPercent,coalesce(ur.status,CASE WHEN r.threshold_yards<=? THEN 'AVAILABLE' ELSE 'LOCKED' END) AS status,ur.unlocked_at AS unlockedAt,ur.claimed_at AS claimedAt,ur.redeemed_at AS redeemedAt,ur.coupon_code AS couponCode FROM app_reward_definitions r LEFT JOIN app_user_rewards ur ON ur.reward_definition_id=r.id AND ur.user_id=? WHERE r.active=1 ORDER BY r.threshold_yards",
      [progress.lifetimeYards, userId],
    );
    for (const reward of rewards)
      for (const key of ['unlockedAt', 'claimedAt', 'redeemedAt'])
        if (reward[key] != null) reward[key] = new Date(reward[key]);
    const [trivia, days, ranks] = await Promise.all([
      this.s.rows<any>(
        'SELECT correct_answers AS correctAnswers FROM app_trivia_stats WHERE user_id=?',
        [userId],
      ),
      this.s.rows<{ day: string }>(
        "SELECT DISTINCT strftime('%Y-%m-%d',created_at/1000,'unixepoch') AS day FROM app_reward_events WHERE user_id=? AND yards>0 ORDER BY day DESC",
        [userId],
      ),
      this.s.rows<any>(
        'SELECT 1+count(CASE WHEN lifetime_yards>? THEN 1 END) AS rank,count(*) AS total FROM app_reward_accounts',
        [progress.lifetimeYards],
      ),
    ]);
    const nextReward = rewards.find((r) => r.thresholdYards > progress.lifetimeYards) ?? null;
    return {
      progress,
      stats: {
        correctAnswers: trivia[0]?.correctAnswers ?? 0,
        dayStreak: activeDayStreak(days.map((r) => r.day)),
        crewRank: null,
        crewRankingAvailable: false,
        globalRank: ranks[0].rank,
        totalUsers: ranks[0].total,
      },
      nextReward,
      yardsToNextReward: nextReward ? nextReward.thresholdYards - progress.lifetimeYards : 0,
      rewards,
    };
  }
  async claim(
    userId: string,
    rewardId: string,
  ): Promise<{
    type: string;
    status: string;
    couponCode: string | null;
    discountPercent: number | null;
    claimedAt?: Date;
  }> {
    const [reward] = await this.s.rows<any>(
      'SELECT r.type,ur.status,ur.coupon_code AS couponCode,r.discount_percent AS discountPercent FROM app_user_rewards ur JOIN app_reward_definitions r ON r.id=ur.reward_definition_id WHERE ur.user_id=? AND ur.reward_definition_id=?',
      [userId, rewardId],
    );
    if (!reward) throw Error('Reward is not available.');
    if (['REDEEMED', 'EXPIRED'].includes(reward.status))
      throw Error('Reward can no longer be claimed.');
    if (reward.status === 'CLAIMED') return reward;
    const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
      b.toString(16).padStart(2, '0'),
    )
      .join('')
      .toUpperCase();
    const [row] = await this.s.rows<any>(
      "UPDATE app_user_rewards SET status='CLAIMED',claimed_at=?,coupon_code=? WHERE user_id=? AND reward_definition_id=? AND status='AVAILABLE' RETURNING status,coupon_code AS couponCode,claimed_at AS claimedAt",
      [Date.now(), reward.type === 'DISCOUNT' ? `DD-${random}` : null, userId, rewardId],
    );
    if (!row) return this.claim(userId, rewardId);
    return { ...reward, ...row, claimedAt: new Date(row.claimedAt) };
  }
  async redeem(userId: string, coupon: string) {
    const [row] = await this.s.rows<{ id: string }>(
      "UPDATE app_user_rewards SET status='REDEEMED',redeemed_at=? WHERE user_id=? AND coupon_code=? AND status='CLAIMED' RETURNING id",
      [Date.now(), userId, coupon],
    );
    if (!row) throw Error('Coupon is invalid or has already been redeemed.');
    return row;
  }
}
