'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import AppShell from '@/components/app-shell';
import {
  DraftExperienceHero,
  type DraftExperienceNavKey,
} from '@/components/draft/draft-experience-hero';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { TeamNeedAnalysis } from '@/lib/team-overview';
import { TeamNeedsPage } from './TeamNeedsPage';
import styles from './draft-central.module.css';

type Data = {
  draftYear: number;
  week: number;
  needs: string[];
  needAnalysis: TeamNeedAnalysis[];
  recommendations: Array<{ position: string; title: string; detail: string; round: number }>;
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
  history: ['My Drafts', 'Review the players and picks made in prior franchise drafts.'],
  scouting: ['Draft Guide', 'Generated scout intelligence without repetitive scouting chores.'],
};
const activeKeys: Record<string, DraftExperienceNavKey> = {
  'team-needs': 'team-needs',
  history: 'my-drafts',
  scouting: 'draft-guide',
};
export function DraftSectionPage({ section }: { section: string }) {
  const saveId = useSaveStore((state) => state.saveId);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    setData(null);
    if (saveId)
      void apiFetch(`/api/front-office/draft-central?saveId=${encodeURIComponent(saveId)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error('Draft data unavailable');
          const body = await response.json();
          if (
            !Array.isArray(body.needAnalysis) ||
            !Array.isArray(body.prospects) ||
            !Array.isArray(body.recommendations)
          )
            throw new Error('Incomplete draft data');
          if (active) setData(body);
        })
        .catch(() => {
          if (active) setError(true);
        });
    return () => {
      active = false;
    };
  }, [saveId]);
  const heading = copy[section] ?? copy.scouting;
  return (
    <AppShell>
      <DraftExperienceHero
        title={heading[0]}
        description={heading[1]}
        active={activeKeys[section] ?? 'draft-guide'}
      />
      <div className={styles.sectionPage}>
        {error ? (
          <div className={styles.status} role="alert">
            Draft intelligence is temporarily unavailable.{' '}
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className={styles.status}>Loading draft intelligence…</div>
        ) : section === 'team-needs' ? (
          <TeamNeedsPage data={data} />
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
