'use client';
import Link from 'next/link';
import MainSiteHeader from '@/components/main-site-header';
import { TEAM_LIST } from '@/data/teams';
import { huddleFont } from './huddle-font';
import { dailyDate, compactCount } from '../../../packages/huddle/daily';
import s from './huddle.module.css';
export default function ArchiveList({ teamAbbr }: { teamAbbr: string }) {
  const team = TEAM_LIST.find((t) => t.abbr === teamAbbr) ?? TEAM_LIST[0];
  const daily =
    process.env.NODE_ENV === 'development'
      ? (
          require('../../../packages/huddle/demo-daily') as typeof import('../../../packages/huddle/demo-daily')
        ).dailySnapshot(team.abbr, team.name).daily
      : null;
  return (
    <>
      <MainSiteHeader teamAbbr={team.abbr} active="community" />
      <main
        className={`${s.shell} ${huddleFont.variable}`}
        style={{ display: 'block', padding: '24px 0' }}
      >
        <div className={s.archiveList}>
          <Link href={`/huddle?team=${team.abbr}`}>← Today’s Huddle</Link>
          <h1 style={{ fontSize: 48, fontWeight: 800, fontStyle: 'italic' }}>PREVIOUS HUDDLES</h1>
          {daily?.previous.map((p) => (
            <Link key={p.id} href={`/huddle/archive?team=${team.abbr}&date=${p.date}`}>
              <h2>The Huddle — {p.summary}</h2>
              <small>
                {dailyDate(p.date, true)} · {compactCount(p.comments)} comments →
              </small>
            </Link>
          ))}
          <p>
            {daily
              ? 'Archive preview · Sample conversations.'
              : 'Archived Huddles are not available yet.'}
          </p>
        </div>
      </main>
    </>
  );
}
