import { randomBytes, randomUUID } from 'node:crypto';
import type postgres from 'postgres';

import { REWARD_ACTION_YARDS, type RewardActionType } from '@/features/rewards/config';
import { awardMoveTheChains } from '@/features/trivia/engine';
import { authDb } from '@/server/auth/database';

type Tx = postgres.TransactionSql;

export type YardAwardResult = {
  awarded: boolean;
  yardsAwarded: number;
  touchdownsEarned: number;
  progress: { currentDriveYards: number; touchdowns: number; lifetimeYards: number };
  unlockedRewards: Array<{ id: string; title: string; thresholdYards: number }>;
};

export async function awardYardsInTransaction(
  tx: Tx,
  input: {
    userId: string;
    action: RewardActionType;
    sourceType: string;
    sourceId: string;
  },
): Promise<YardAwardResult> {
  const yards = REWARD_ACTION_YARDS[input.action];
  const idempotencyKey = `${input.action}:${input.userId}:${input.sourceType}:${input.sourceId}`;
  const event = await tx<Array<{ id: string }>>`
    INSERT INTO move_the_chains_events(id,user_id,event_type,yards,source_type,source_id,idempotency_key)
    VALUES(${randomUUID()},${input.userId},${input.action},${yards},${input.sourceType},${input.sourceId},${idempotencyKey})
    ON CONFLICT(user_id,idempotency_key) DO NOTHING RETURNING id`;

  await tx`INSERT INTO move_the_chains_accounts(user_id) VALUES(${input.userId}) ON CONFLICT(user_id) DO NOTHING`;
  const accounts = await tx<
    Array<{ currentDriveYards: number; touchdowns: number; lifetimeYards: number }>
  >`
    SELECT current_drive_yards AS "currentDriveYards",touchdowns,lifetime_yards AS "lifetimeYards"
    FROM move_the_chains_accounts WHERE user_id=${input.userId} FOR UPDATE`;
  const previous = accounts[0];
  if (!event[0])
    return {
      awarded: false,
      yardsAwarded: 0,
      touchdownsEarned: 0,
      progress: previous,
      unlockedRewards: [],
    };

  const next = awardMoveTheChains(
    previous.currentDriveYards,
    previous.touchdowns,
    previous.lifetimeYards,
    yards,
  );
  await tx`UPDATE move_the_chains_accounts SET current_drive_yards=${next.currentDriveYards},touchdowns=${next.touchdowns},lifetime_yards=${next.lifetimeYards},updated_at=now() WHERE user_id=${input.userId}`;
  const crossed = await tx<Array<{ id: string; title: string; thresholdYards: number }>>`
    SELECT id,title,threshold_yards AS "thresholdYards" FROM reward_definitions
    WHERE active=true AND threshold_yards > ${previous.lifetimeYards} AND threshold_yards <= ${next.lifetimeYards}`;
  const unlockedRewards: Array<{ id: string; title: string; thresholdYards: number }> = [];
  for (const reward of crossed) {
    const inserted = await tx<
      Array<{ id: string }>
    >`INSERT INTO user_rewards(id,user_id,reward_definition_id)
      VALUES(${randomUUID()},${input.userId},${reward.id}) ON CONFLICT(user_id,reward_definition_id) DO NOTHING RETURNING id`;
    if (inserted[0]) unlockedRewards.push(reward);
  }
  for (const reward of unlockedRewards) {
    await tx`INSERT INTO user_notifications(id,user_id,event_id,title,body,deep_link)
      VALUES(${randomUUID()},${input.userId},${`reward:${reward.id}`},'Reward unlocked',${reward.title},'/rewards')`;
  }
  return {
    awarded: true,
    yardsAwarded: yards,
    touchdownsEarned: next.touchdowns - previous.touchdowns,
    progress: next,
    unlockedRewards,
  };
}

export function awardYards(input: {
  userId: string;
  action: RewardActionType;
  sourceType: string;
  sourceId: string;
}) {
  return authDb().begin((tx) => awardYardsInTransaction(tx, input));
}

export async function getRewardsDashboard(userId: string) {
  const sql = authDb();
  await sql`INSERT INTO move_the_chains_accounts(user_id) VALUES(${userId}) ON CONFLICT(user_id) DO NOTHING`;
  const accounts = await sql<
    Array<{ currentDriveYards: number; touchdowns: number; lifetimeYards: number }>
  >`
    SELECT current_drive_yards AS "currentDriveYards",touchdowns,lifetime_yards AS "lifetimeYards" FROM move_the_chains_accounts WHERE user_id=${userId}`;
  const legacyUnlocks = await sql<
    Array<{ id: string }>
  >`SELECT id FROM reward_definitions WHERE active=true AND threshold_yards <= ${accounts[0].lifetimeYards}`;
  for (const reward of legacyUnlocks) {
    await sql`INSERT INTO user_rewards(id,user_id,reward_definition_id) VALUES(${randomUUID()},${userId},${reward.id}) ON CONFLICT(user_id,reward_definition_id) DO NOTHING`;
  }
  const rewards = await sql<Array<Record<string, unknown>>>`
    SELECT r.id,r.threshold_yards AS "thresholdYards",r.type,r.title,r.description,r.discount_percent AS "discountPercent",
      coalesce(ur.status,CASE WHEN r.threshold_yards <= ${accounts[0].lifetimeYards} THEN 'AVAILABLE' ELSE 'LOCKED' END) AS status,
      ur.unlocked_at AS "unlockedAt",ur.claimed_at AS "claimedAt",ur.redeemed_at AS "redeemedAt",ur.coupon_code AS "couponCode"
    FROM reward_definitions r LEFT JOIN user_rewards ur ON ur.reward_definition_id=r.id AND ur.user_id=${userId}
    WHERE r.active=true ORDER BY r.threshold_yards`;
  const progress = accounts[0];
  const nextReward =
    rewards.find((reward) => Number(reward.thresholdYards) > progress.lifetimeYards) ?? null;
  return {
    progress,
    nextReward,
    yardsToNextReward: nextReward ? Number(nextReward.thresholdYards) - progress.lifetimeYards : 0,
    rewards,
  };
}

export async function claimReward(userId: string, rewardDefinitionId: string) {
  return authDb().begin(async (tx) => {
    const rows = await tx<
      Array<{
        type: string;
        status: string;
        couponCode: string | null;
        discountPercent: number | null;
      }>
    >`
      SELECT r.type,ur.status,ur.coupon_code AS "couponCode",r.discount_percent AS "discountPercent"
      FROM user_rewards ur JOIN reward_definitions r ON r.id=ur.reward_definition_id
      WHERE ur.user_id=${userId} AND ur.reward_definition_id=${rewardDefinitionId} FOR UPDATE`;
    const reward = rows[0];
    if (!reward) throw new Error('Reward is not available.');
    if (reward.status === 'REDEEMED' || reward.status === 'EXPIRED')
      throw new Error('Reward can no longer be claimed.');
    if (reward.status === 'CLAIMED') return reward;
    const couponCode =
      reward.type === 'DISCOUNT' ? `DD-${randomBytes(6).toString('hex').toUpperCase()}` : null;
    const updated = await tx<Array<Record<string, unknown>>>`
      UPDATE user_rewards SET status='CLAIMED',claimed_at=now(),coupon_code=${couponCode}
      WHERE user_id=${userId} AND reward_definition_id=${rewardDefinitionId}
      RETURNING status,coupon_code AS "couponCode",claimed_at AS "claimedAt"`;
    return { ...reward, ...updated[0] };
  });
}

/** Commerce providers call this only after they have confirmed a successful order redemption. */
export async function confirmCouponRedemption(userId: string, couponCode: string) {
  const rows = await authDb()<Array<{ id: string }>>`
    UPDATE user_rewards SET status='REDEEMED',redeemed_at=now()
    WHERE user_id=${userId} AND coupon_code=${couponCode} AND status='CLAIMED'
    RETURNING id`;
  if (!rows[0]) throw new Error('Coupon is invalid or has already been redeemed.');
  return rows[0];
}
