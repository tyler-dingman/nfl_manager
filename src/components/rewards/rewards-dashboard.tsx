'use client';
import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowRight,
  Trophy,
  Flame,
  Users,
  ChartNoAxesColumnIncreasing,
  Shield,
  Star,
  CircleHelp,
  Newspaper,
  CirclePlay,
  Target,
  Flag,
  Shirt,
  Ticket,
  Lock,
  Check,
} from 'lucide-react';
import { getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import { REWARD_WAYS } from '@/features/rewards/ways';
import {
  REWARD_TIERS,
  rewardTierProgress,
  type RewardDashboard,
} from '../../../packages/rewards/presentation';
import styles from './rewards-dashboard.module.css';

function Badge({ color }: { color?: string }) {
  return (
    <span className={styles.badge} style={{ color }}>
      <Shield aria-hidden="true" />
      <Star aria-hidden="true" />
    </span>
  );
}
function Section({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
const wayIcons = {
  trivia: CircleHelp,
  articles: Newspaper,
  game: CirclePlay,
  prediction: Target,
  checkin: Flag,
  crew: Users,
};
export function RewardsDashboard({
  data,
  teamAbbr,
  claim,
  claiming,
}: {
  data: RewardDashboard;
  teamAbbr: string;
  claim: (id: string) => void;
  claiming: string | null;
}) {
  const progress = rewardTierProgress(data.progress.lifetimeYards);
  const theme = getEditorialHeroTheme(teamAbbr);
  const [allWays, setAllWays] = useState(false);
  const [allRewards, setAllRewards] = useState(false);
  const [tierDetails, setTierDetails] = useState(false);
  const stats = [
    {
      label: 'Touchdowns',
      value: data.progress.touchdowns,
      detail: `${data.stats?.correctAnswers ?? '—'} correct trivia answers`,
      Icon: Trophy,
    },
    {
      label: 'Day Streak',
      value: data.stats?.dayStreak ?? '—',
      detail: 'Days earning yards · UTC',
      Icon: Flame,
    },
    {
      label: 'Crew Rank',
      value: data.stats?.crewRank ? `#${data.stats.crewRank}` : '—',
      detail:
        data.stats?.crewRankingAvailable === false
          ? 'Crew ranking unavailable'
          : data.stats?.crewRank
            ? 'Lifetime yards in your crew'
            : 'Join a crew to rank',
      Icon: Users,
    },
    {
      label: 'Global Rank',
      value: data.stats ? `#${data.stats.globalRank}` : '—',
      detail: data.stats ? `Of ${data.stats.totalUsers} reward players` : 'Among reward players',
      Icon: ChartNoAxesColumnIncreasing,
    },
  ];
  return (
    <div
      className={styles.dashboard}
      style={{ '--reward-accent': theme.heroPrimaryAccent } as CSSProperties}
    >
      <section className={styles.hero}>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>MOVE THE CHAINS</p>
          <h1>
            ENGAGEMENT
            <br />
            <span>REWARDS</span>
          </h1>
          <p>Be active. Earn points. Unlock rewards. Keep showing up.</p>
        </div>
        <div className={styles.progress}>
          <h2>Your Progress</h2>
          <div className={styles.progressGrid}>
            <div
              className={styles.ring}
              role="progressbar"
              aria-label="Progress to next reward tier"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.fraction * 100)}
              aria-valuetext={`${progress.total} lifetime yards. ${progress.current.name}. ${progress.next ? `${progress.remaining} yards to ${progress.next.name}` : 'Highest tier reached'}`}
            >
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="51" />
                <circle
                  cx="60"
                  cy="60"
                  r="51"
                  pathLength="100"
                  strokeDasharray={`${progress.fraction * 100} 100`}
                />
              </svg>
              <div>
                <strong>{progress.total.toLocaleString()}</strong>
                <span>{progress.next ? `/ ${progress.next.min.toLocaleString()}` : 'LEGEND'}</span>
                <small>MOVE THE CHAINS</small>
              </div>
            </div>
            <div className={styles.currentTier}>
              <Badge />
              <p>Current Tier</p>
              <h3>{progress.current.name}</h3>
              <p>
                {progress.next
                  ? `${progress.remaining.toLocaleString()} yards to next tier`
                  : 'Highest tier reached'}
              </p>
            </div>
          </div>
          <div className={styles.track}>
            <span style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <p className={styles.progressTotal}>{progress.total.toLocaleString()} lifetime yards</p>
          <a href="#reward-tiers">
            View All Tiers <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <div className={styles.content}>
        <Section title="Your Stats" action={<span className={styles.timeframe}>All time</span>}>
          <div className={styles.stats}>
            {stats.map(({ label, value, detail, Icon }) => (
              <article key={label}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{value}</strong>
                  <p>{label}</p>
                  <small>{detail}</small>
                </div>
              </article>
            ))}
          </div>
        </Section>
        <Section
          id="reward-tiers"
          title="Reward Tiers"
          action={
            <button onClick={() => setTierDetails(!tierDetails)} aria-expanded={tierDetails}>
              {tierDetails ? 'Hide Details' : 'View All Tiers'} <ArrowRight size={16} />
            </button>
          }
        >
          <div className={styles.tiers}>
            {REWARD_TIERS.map((tier) => (
              <article
                key={tier.name}
                className={tier.name === progress.current.name ? styles.activeTier : ''}
                aria-current={tier.name === progress.current.name ? 'step' : undefined}
              >
                <Badge color={tier.color} />
                <h3>{tier.name}</h3>
                <p>{tier.range}</p>
                {tier.name === progress.current.name && <small>CURRENT</small>}
              </article>
            ))}
          </div>
          {tierDetails && (
            <p className={styles.explanation}>
              Tiers reflect lifetime Move the Chains yards. Each 100 yards completes a drive and
              earns a touchdown. Reward unlocks use their own milestones shown below; your yards are
              never spent.
            </p>
          )}
        </Section>
        <Section
          title="Ways to Earn Points"
          action={
            <button onClick={() => setAllWays(!allWays)} aria-expanded={allWays}>
              {allWays ? 'Show Less' : 'View All Ways'} <ArrowRight size={16} />
            </button>
          }
        >
          <div className={styles.ways}>
            {REWARD_WAYS.slice(0, allWays ? undefined : 5).map((way) => {
              const Icon = wayIcons[way.icon as keyof typeof wayIcons];
              return (
                <Link href={way.href} key={way.action}>
                  <Icon aria-hidden="true" />
                  <strong>{way.label}</strong>
                  <span>
                    +{way.yards} {way.yards === 1 ? 'yard' : 'yards'}
                  </span>
                  <small>{way.detail}</small>
                </Link>
              );
            })}
          </div>
        </Section>
        <Section
          title="Featured Rewards"
          action={
            <button onClick={() => setAllRewards(!allRewards)} aria-expanded={allRewards}>
              {allRewards ? 'Show Less' : 'View All Rewards'} <ArrowRight size={16} />
            </button>
          }
        >
          <div className={styles.rewards}>
            {data.rewards.slice(0, allRewards ? undefined : 4).map((reward) => {
              const Icon = reward.type === 'STICKER_PACK' ? Ticket : Shirt;
              return (
                <article key={reward.id}>
                  <Icon aria-hidden="true" />
                  <div>
                    <h3>{reward.title}</h3>
                    <p>{reward.thresholdYards.toLocaleString()} lifetime yards</p>
                    <small>
                      {reward.status === 'LOCKED' ? (
                        <>
                          <Lock size={12} /> Locked
                        </>
                      ) : (
                        <>
                          <Check size={12} /> {reward.status.toLowerCase()}
                        </>
                      )}
                    </small>
                    {reward.couponCode && <code>{reward.couponCode}</code>}
                    {allRewards && <p>{reward.description}</p>}
                    {reward.status === 'AVAILABLE' && (
                      <button disabled={claiming !== null} onClick={() => claim(reward.id)}>
                        {claiming === reward.id
                          ? 'Claiming…'
                          : reward.type === 'STICKER_PACK'
                            ? 'Claim reward'
                            : 'Generate code'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!data.rewards.length && (
            <p className={styles.explanation}>Rewards will appear here when available.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
