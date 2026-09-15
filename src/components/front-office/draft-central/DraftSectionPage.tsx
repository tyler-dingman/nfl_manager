'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AppShell from '@/components/app-shell';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import styles from './draft-central.module.css';

type Data = {
  draftYear: number;
  week: number;
  needs: string[];
  prospects: Array<{
    id: string;
    name: string;
    position: string;
    school: string;
    currentRank: number;
    scoutGrade: number;
    scoutingConfidence: number;
    rankingTrend: number;
    summary?: string;
  }>;
  fits: Array<{
    id: string;
    name: string;
    position: string;
    school: string;
    overallFitScore: number;
    needFitScore: number;
    availabilityScore: number;
  }>;
  picks: Array<{ id: string; year: number; round: number; displayOverall: number }>;
  news: Array<{
    id: string;
    prospectId: string;
    category: string;
    headline: string;
    summary: string;
  }>;
};
const copy: Record<string, [string, string]> = {
  'team-needs': ['Team Needs', 'Understand the roster gaps that should shape your draft strategy.'],
  'mock-drafts': [
    'Mock Drafts',
    'See how prospect rankings, team needs, and projected availability could shape the board.',
  ],
  history: ['Draft History', 'Review the players and picks made in prior franchise drafts.'],
  scouting: [
    'Scouting Reports',
    'Generated scout intelligence without repetitive scouting chores.',
  ],
};
export function DraftSectionPage({ section }: { section: string }) {
  const saveId = useSaveStore((state) => state.saveId);
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    if (saveId)
      void apiFetch(`/api/front-office/draft-central?saveId=${encodeURIComponent(saveId)}`)
        .then((response) => response.json())
        .then(setData)
        .catch(() => setData(null));
  }, [saveId]);
  const heading = copy[section] ?? copy.scouting;
  return (
    <AppShell>
      <div className={styles.sectionPage}>
        <Link href="/front-office/draft">
          <ArrowLeft /> Back to Draft Central
        </Link>
        <header>
          <h1>{heading[0]}</h1>
          <p>{heading[1]}</p>
        </header>
        {!data ? (
          <div className={styles.status}>Loading draft intelligence…</div>
        ) : section === 'team-needs' ? (
          <div className={styles.sectionCards}>
            {data.needs.map((need, index) => (
              <section key={need}>
                <b>{index < 2 ? 'High' : index < 4 ? 'Moderate' : 'Low'} need</b>
                <h2>{need}</h2>
                <p>
                  Current roster strength, depth, age, and contract outlook place {need} at No.{' '}
                  {index + 1} on your priority list.
                </p>
                <Link href={`/front-office/draft/prospects?position=${need}`}>
                  View {need} prospects <ArrowRight />
                </Link>
              </section>
            ))}
          </div>
        ) : section === 'mock-drafts' ? (
          <section className={styles.mockBoard}>
            <header>
              <h2>Current team projection</h2>
              <span>
                {data.draftYear} · Week {data.week}
              </span>
            </header>
            {data.fits.slice(0, 10).map((prospect, index) => (
              <div key={prospect.id}>
                <b>#{index + 1}</b>
                <span>
                  <strong>{prospect.name}</strong>
                  <small>
                    {prospect.position} · {prospect.school}
                  </small>
                </span>
                <em>{Math.round(prospect.availabilityScore)}% available</em>
              </div>
            ))}
          </section>
        ) : section === 'history' ? (
          <section className={styles.sectionEmpty}>
            <h2>No completed drafts yet</h2>
            <p>
              Your franchise draft classes and grades will appear here after the first draft is
              completed.
            </p>
            <Link href="/front-office/draft/room">
              Open Draft Room <ArrowRight />
            </Link>
          </section>
        ) : (
          <div className={styles.reportList}>
            {data.prospects.slice(0, 20).map((prospect) => (
              <Link href={`/front-office/draft/prospects/${prospect.id}`} key={prospect.id}>
                <b>Confidence {prospect.scoutingConfidence}%</b>
                <h2>{prospect.name}</h2>
                <span>
                  {prospect.position} · {prospect.school} · Grade {prospect.scoutGrade}
                </span>
                <p>
                  {prospect.summary ??
                    `${prospect.name} currently grades as the No. ${prospect.currentRank} prospect with ${prospect.rankingTrend >= 0 ? 'positive' : 'developing'} momentum.`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
