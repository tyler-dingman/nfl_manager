'use client';

import Link from 'next/link';
import { ArrowRight, ChevronRight, ShieldCheck, Star } from 'lucide-react';
import {
  DdTeamAnalyticsIcon as BarChart3,
  DdRosterIcon as Users,
} from '@/components/ui/football-icons';

import type { TeamNeedAnalysis } from '@/lib/team-overview';
import styles from './team-needs-page.module.css';

type Recommendation = { position: string; title: string; detail: string; round: number };

export type TeamNeedsData = {
  needAnalysis: TeamNeedAnalysis[];
  recommendations: Recommendation[];
};

const prospectHref = (position: string) =>
  `/front-office/draft/prospects?position=${encodeURIComponent(position)}`;

function ScoreRing({ need }: { need: TeamNeedAnalysis }) {
  const color =
    need.level === 'High' ? '#fb6b69' : need.level === 'Moderate' ? '#efb800' : '#3288ed';
  return (
    <div className={styles.scoreBlock}>
      <div
        className={styles.scoreRing}
        style={{
          background: `conic-gradient(${color} ${need.score * 3.6}deg, var(--fo-elevated) 0deg)`,
        }}
      >
        <span>{need.score}</span>
      </div>
      <small>Need Score</small>
    </div>
  );
}

function explanation(need: TeamNeedAnalysis) {
  if (!need.factors.length)
    return `The current ${need.position} group is stable across the available roster data.`;
  const factors = need.factors.join(', ').replace(/, ([^,]*)$/, ' and $1');
  return `Current ${factors} place ${need.position} at No. ${need.rank} on your priority list.`;
}

function NeedCard({ need, primary }: { need: TeamNeedAnalysis; primary: boolean }) {
  return (
    <article className={primary ? styles.primaryCard : styles.secondaryCard}>
      <div>
        <b className={styles[need.level.toLowerCase()]}>{need.level} Need</b>
        <h2>{need.position}</h2>
        {primary ? <p>{explanation(need)}</p> : null}
        <Link href={prospectHref(need.position)}>
          View {need.position} prospects <ArrowRight />
        </Link>
      </div>
      <ScoreRing need={need} />
    </article>
  );
}

const recommendationIcon = (index: number) => {
  const Icon = [BarChart3, ShieldCheck, Users, Star][index % 4];
  return <Icon />;
};

export function TeamNeedsPage({ data }: { data: TeamNeedsData }) {
  const needs = data.needAnalysis.slice(0, 7);
  return (
    <div className={styles.page}>
      <section className={styles.primaryGrid}>
        {needs.slice(0, 3).map((need) => (
          <NeedCard key={need.position} need={need} primary />
        ))}
      </section>
      <section className={styles.secondaryGrid}>
        {needs.slice(3, 7).map((need) => (
          <NeedCard key={need.position} need={need} primary={false} />
        ))}
      </section>
      <div className={styles.bottomGrid}>
        <section className={styles.overview}>
          <header>
            <h2>Roster Overview</h2>
            <p>Key factors influencing team needs.</p>
          </header>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Position</span>
              <span>Starters</span>
              <span>Key Depth</span>
              <span>Avg Age</span>
              <span>Contract Outlook</span>
              <span>Need Level</span>
            </div>
            {data.needAnalysis.map((need) => (
              <div className={styles.tableRow} key={need.position}>
                <b>{need.position}</b>
                <span>
                  {need.starters} / {need.requiredStarters}
                </span>
                <span>{need.keyDepth}</span>
                <span>{need.averageAge?.toFixed(1) ?? '—'}</span>
                <span>
                  {need.expiringContracts ? `${need.expiringContracts} expiring` : 'Stable'}
                </span>
                <em className={styles[need.level.toLowerCase()]}>{need.level}</em>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.recommendations}>
          <header>
            <h2>Insights &amp; Recommendations</h2>
            <p>Data-driven insights to guide your draft strategy.</p>
          </header>
          <div>
            {data.recommendations.slice(0, 5).map((item, index) => (
              <Link href={prospectHref(item.position)} key={`${item.position}-${item.title}`}>
                <i>{recommendationIcon(index)}</i>
                <span>
                  <b>{item.title}</b>
                  <small>{item.detail}</small>
                </span>
                <ChevronRight />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
