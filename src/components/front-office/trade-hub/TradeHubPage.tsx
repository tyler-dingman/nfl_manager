'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Flame,
  ListRestart,
  Search,
  UserRoundSearch,
  UsersRound,
} from 'lucide-react';

import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import styles from './trade-hub.module.css';

type Target = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  rating?: number;
  teamAbbr?: string | null;
  contractSummary: string;
  estimatedCost: string;
  tradeAvailabilityScore: number;
  availabilityLabel: string;
};
type Outlook = { teamAbbr: string; record: string; capSpace: number; score: number; label: string };
type Event = {
  id: string;
  type: string;
  headline: string;
  summary: string;
  simulationWeek: number;
  readAt: string | null;
};
type Trade = {
  id: string;
  playerId: string;
  fromTeamAbbr?: string;
  toTeamAbbr?: string;
  createdAt: string;
};
type HubData = {
  week: number;
  deadline: { label: string; passed: boolean };
  team: {
    abbr: string;
    capSpace: number;
    rosterSize: number;
    rosterLimit: number;
    tradeChips: Array<{ id: string; label: string }>;
  };
  targets: Target[];
  outlooks: Outlook[];
  tradeEvents: Event[];
  pendingOfferCount: number;
  recentTrades: Trade[];
};

const teamMap = new Map(TEAM_LIST.map((team) => [team.abbr, team]));
const filterMap: Record<string, string[]> = {
  All: [],
  'Wide Receiver': ['WR'],
  'Edge Rusher': ['EDGE', 'DE'],
  Cornerback: ['CB'],
  Linebacker: ['LB'],
  'Offensive Line': ['LT', 'RT', 'OT', 'LG', 'RG', 'C', 'IOL'],
  Quarterback: ['QB'],
};
const tools = [
  ['Find Trade Partners', '/front-office/trade-hub/partners', UsersRound],
  ['Trade Finder', '/front-office/trade-hub/finder', Search],
  ['My Trade Offers', '/front-office/trade-hub/offers', BriefcaseBusiness],
  ['Recently Viewed', '/front-office/trade-hub/recent', Clock3],
  ['Trade Block', '/front-office/trade-hub/block', ArrowLeftRight],
  ['League Trade Activity', '/front-office/trade-hub/activity', ListRestart],
] as const;

function GenericAvatar({ name }: { name: string }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}

function OutlookTable({ title, rows }: { title: string; rows: Outlook[] }) {
  return (
    <section className={styles.outlookCard}>
      <header>
        <h2>{title}</h2>
        <Link href="/front-office/trade-hub/activity">
          View all <ArrowRight />
        </Link>
      </header>
      <p>Teams projected from record, cap situation, roster strength, and the current week.</p>
      <div className={styles.outlookHead}>
        <span>Team</span>
        <span>Record</span>
        <span>Cap space</span>
        <span>Trade outlook</span>
      </div>
      {rows.slice(0, 5).map((row) => (
        <div className={styles.outlookRow} key={row.teamAbbr}>
          <strong>{teamMap.get(row.teamAbbr)?.city ?? row.teamAbbr}</strong>
          <span>{row.record}</span>
          <span>${row.capSpace.toFixed(1)}M</span>
          <span>
            <i style={{ width: `${row.score}%` }} />
            {row.label}
          </span>
        </div>
      ))}
    </section>
  );
}

export function TradeHubPage() {
  const saveId = useSaveStore((store) => store.saveId);
  const [data, setData] = useState<HubData | null>(null);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!saveId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await apiFetch(
          `/api/front-office/trade-hub?saveId=${encodeURIComponent(saveId)}`,
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load Trade Hub.');
        if (active) {
          setData(payload);
          setError('');
        }
      } catch (reason) {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Unable to load Trade Hub.');
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    return () => {
      active = false;
      window.removeEventListener('front-office-simulation-advanced', load);
    };
  }, [saveId]);
  const targets = useMemo(
    () =>
      (data?.targets ?? []).filter((target) => {
        const positionMatch =
          filter === 'All' || (filterMap[filter] ?? []).includes(target.position.toUpperCase());
        const needle = query.trim().toLowerCase();
        const searchMatch =
          !needle ||
          `${target.firstName} ${target.lastName} ${target.position} ${target.teamAbbr} ${teamMap.get(target.teamAbbr ?? '')?.name ?? ''}`
            .toLowerCase()
            .includes(needle);
        return positionMatch && searchMatch;
      }),
    [data, filter, query],
  );
  if (error) return <div className={styles.status}>{error}</div>;
  if (!data) return <div className={styles.status}>Loading the trade market…</div>;
  const sellers = [...data.outlooks].sort((a, b) => a.score - b.score);
  const buyers = [...data.outlooks].sort((a, b) => b.score - a.score);
  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <nav>
            <Link href="/experience">Front Office</Link>
            <span>›</span>
            <strong>Trade Hub</strong>
          </nav>
          <h1>Trade Hub</h1>
          <p>
            Explore trade opportunities, track league activity, and find the right moves to build a
            winning team.
          </p>
        </div>
        <label className={styles.search}>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players, teams, or trade topics..."
          />
        </label>
      </div>
      {data.deadline.passed ? (
        <div className={styles.deadline}>
          <strong>Trade deadline has passed</strong>
          <span>Historical offers, news, and league activity remain available.</span>
        </div>
      ) : (
        <div className={styles.deadlineOpen}>
          <strong>Trade deadline</strong>
          <span>{data.deadline.label}</span>
        </div>
      )}
      <div className={styles.layout}>
        <aside className={styles.left}>
          <section className={styles.card}>
            <h2>Trade tools</h2>
            <div className={styles.toolList}>
              {tools.map(([label, href, Icon], index) => (
                <Link
                  key={label}
                  href={href}
                  className={index === 0 ? styles.activeTool : undefined}
                >
                  <Icon />
                  <span>{label}</span>
                  {label === 'My Trade Offers' && data.pendingOfferCount ? (
                    <b>{data.pendingOfferCount}</b>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
          <section className={`${styles.card} ${styles.teamInfo}`}>
            <h2>My team info</h2>
            <dl>
              <div>
                <dt>Cap Space</dt>
                <dd>${data.team.capSpace.toFixed(1)}M</dd>
              </div>
              <div>
                <dt>Roster Size</dt>
                <dd>
                  {data.team.rosterSize} / {data.team.rosterLimit}
                </dd>
              </div>
              <div>
                <dt>Trade Chips</dt>
                <dd>
                  {data.team.tradeChips.length
                    ? data.team.tradeChips.map((pick) => <span key={pick.id}>{pick.label}</span>)
                    : 'No picks available'}
                </dd>
              </div>
            </dl>
            <Link href="/front-office/draft/team-needs">
              View draft picks <ArrowRight />
            </Link>
          </section>
        </aside>
        <main className={styles.center}>
          <section className={`${styles.card} ${styles.targets}`}>
            <header>
              <div>
                <h2>Potential trade targets</h2>
                <p>Players around the league who could be available.</p>
              </div>
              <Link href="/front-office/trade-hub/finder">
                View more players <ArrowRight />
              </Link>
            </header>
            <div className={styles.filters}>
              {Object.keys(filterMap).map((label) => (
                <button
                  type="button"
                  onClick={() => setFilter(label)}
                  className={filter === label ? styles.activeFilter : undefined}
                  key={label}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.targetTable}>
              <div className={styles.targetHead}>
                <span>Player</span>
                <span>Pos</span>
                <span>Age</span>
                <span>OVR</span>
                <span>Team</span>
                <span>Contract</span>
                <span>Est. cost</span>
                <span />
              </div>
              {targets.slice(0, 7).map((target) => {
                const name = `${target.firstName} ${target.lastName}`;
                return (
                  <div className={styles.targetRow} key={target.id}>
                    <span>
                      <GenericAvatar name={name} />
                      <strong>{name}</strong>
                    </span>
                    <span>{target.position}</span>
                    <span>{target.age ?? '–'}</span>
                    <span>
                      <b className={styles.rating}>{target.rating ?? '–'}</b>
                    </span>
                    <span>{target.teamAbbr}</span>
                    <span>{target.contractSummary}</span>
                    <span>{target.estimatedCost}</span>
                    <Link href={`/front-office/trade-hub/player/${encodeURIComponent(target.id)}`}>
                      View details
                    </Link>
                  </div>
                );
              })}
              {!targets.length ? (
                <p className={styles.empty}>No targets match this search.</p>
              ) : null}
            </div>
          </section>
          <div className={styles.outlooks}>
            <OutlookTable title="Teams most likely to trade" rows={sellers} />
            <OutlookTable title="Teams most likely to buy" rows={buyers} />
          </div>
        </main>
        <aside className={styles.right}>
          <section className={styles.card}>
            <header className={styles.sideHead}>
              <h2>
                <Flame /> Trade news & rumors
              </h2>
              <Link href="/front-office/league/news">
                View all <ArrowRight />
              </Link>
            </header>
            <div className={styles.rumors}>
              {data.tradeEvents.slice(0, 5).map((event) => (
                <article key={event.id}>
                  <b>{event.type.replaceAll('_', ' ')}</b>
                  <span>{event.headline}</span>
                  <small>Week {event.simulationWeek}</small>
                </article>
              ))}
              {!data.tradeEvents.length ? <p>No active trade rumors this week.</p> : null}
            </div>
          </section>
          <section className={styles.card}>
            <header className={styles.sideHead}>
              <h2>Recent trades</h2>
              <Link href="/front-office/trade-hub/activity">
                View all <ArrowRight />
              </Link>
            </header>
            <div className={styles.recent}>
              {data.recentTrades.slice(0, 3).map((trade) => (
                <article key={trade.id}>
                  <ArrowLeftRight />
                  <div>
                    <strong>
                      {trade.toTeamAbbr ?? 'Team'} acquires a player from{' '}
                      {trade.fromTeamAbbr ?? 'team'}
                    </strong>
                    <small>
                      {trade.fromTeamAbbr} → {trade.toTeamAbbr}
                    </small>
                  </div>
                </article>
              ))}
              {!data.recentTrades.length ? <p>No completed trades in this save yet.</p> : null}
            </div>
          </section>
          <section className={styles.promo}>
            <strong>
              More moves.
              <br />
              Stronger teams.
            </strong>
            <Link
              href={
                data.deadline.passed
                  ? '/front-office/trade-hub/activity'
                  : '/front-office/trade-hub/new'
              }
            >
              {data.deadline.passed ? 'View trade activity' : 'Initiate a trade'} <ArrowRight />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
