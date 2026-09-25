'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthUser } from '@/features/auth/auth-session';
import { recordBriefingConsumed } from '@/features/content/consumption';
import type { TeamBriefing } from '@/features/content/types';
import type { CatchUpResponse } from '@/features/catch-up/types';
import type { Team } from '@/features/team/team-store';
import { TEAM_LIST } from '@/data/teams';
import styles from './beat-hero.module.css';
import { EditorialSectionHero } from './editorial-section-hero';

export function selectBeatHeroStories(current: TeamBriefing[], catchUp?: CatchUpResponse | null) {
  const changes =
    catchUp?.eligible && catchUp.mode === 'CHANGES'
      ? [...catchUp.items].sort((a, b) => b.importanceScore - a.importanceScore)
      : [];
  const ranked = changes.map((item) => ({
    id: item.storyId,
    headline: item.headline,
    sourceCount: item.sourceCount,
    updatedAt: item.occurredAt,
    briefing: current.find((story) => story.id === item.storyId),
    isNew: true,
  }));
  const seen = new Set(ranked.map((story) => story.id));
  const stories = [
    ...ranked,
    ...current
      .filter((story) => !seen.has(story.id))
      .map((story) => ({
        id: story.id,
        headline: story.headline,
        sourceCount: story.sourceCount,
        updatedAt: story.updatedAt,
        briefing: story,
        isNew: false,
      })),
  ];
  return stories
    .filter((story, index) => stories.findIndex((other) => other.id === story.id) === index)
    .slice(0, 3);
}

export function BeatHero({ team }: { team?: Team }) {
  const { user } = useAuthUser();
  const abbr = team?.abbr ?? 'NFL';
  const [data, setData] = useState<{
    key: string;
    current: TeamBriefing[];
    catchUp: CatchUpResponse | null;
  } | null>(null);
  const [now, setNow] = useState(0);
  const key = `${abbr}:${user?.id ?? 'guest'}`;
  useEffect(() => {
    const controller = new AbortController();
    setNow(Date.now());
    const read = async (url: string) => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    };
    void Promise.all([
      read(`/api/content/homepage?team=${encodeURIComponent(abbr)}`),
      user ? read(`/api/catch-up?team=${encodeURIComponent(abbr)}`) : Promise.resolve(null),
    ]).then(([current, catchUp]) => {
      if (!controller.signal.aborted)
        setData({ key, current: current?.huddle ?? [], catchUp: catchUp?.catchUp ?? null });
    });
    return () => controller.abort();
  }, [abbr, key, user?.id]);
  const active = data?.key === key ? data : null;
  const stories = selectBeatHeroStories(active?.current ?? [], active?.catchUp);
  const nickname =
    TEAM_LIST.find((t) => t.abbr === abbr)
      ?.name.split(' ')
      .at(-1) ?? 'NFL';
  const sourceCount = stories.reduce((sum, story) => sum + (story.sourceCount || 0), 0);
  const updates = stories.filter((story) => story.isNew).length;
  const latest = Math.max(
    ...stories.map((story) => Date.parse(story.updatedAt)).filter(Number.isFinite),
  );
  const minutes = Math.max(0, Math.floor((now - latest) / 60000));
  const age =
    minutes < 1
      ? 'JUST NOW'
      : minutes < 60
        ? `${minutes}M AGO`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)}H AGO`
          : `${Math.floor(minutes / 1440)}D AGO`;
  return (
    <EditorialSectionHero
      teamAbbr={abbr}
      firstWord="THE"
      accentWord="BEAT"
      variant="beat"
      taglineLabel={`The pulse of ${nickname} Nation.`}
      tagline={
        <>
          THE PULSE OF <tspan className={styles.nickname}>{nickname.toUpperCase()}</tspan> NATION.
        </>
      }
    >
      <h2 className={`dd-three-out-display ${styles.threeTitle}`}>
        THREE <span className="dd-three-out-ampersand">&amp;</span> OUT
      </h2>
      <p className={styles.subtitle}>THE 3 THINGS YOU NEED TO KNOW</p>
      <ol className={styles.stories}>
        {stories.map((story, index) => (
          <li key={story.id}>
            <Link
              href={`/content/${encodeURIComponent(story.id)}`}
              onClick={() => {
                if (user && story.briefing) void recordBriefingConsumed(story.briefing);
              }}
            >
              <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.storyTitle}>{story.headline}</span>
              <ChevronRight className={styles.rowChevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
      {stories.length ? (
        <p className={styles.meta}>
          {updates
            ? `${updates} ${updates === 1 ? 'UPDATE' : 'UPDATES'} · SINCE YOUR LAST VISIT`
            : `${sourceCount} ${sourceCount === 1 ? 'SOURCE' : 'SOURCES'}${Number.isFinite(latest) ? ` · UPDATED ${age}` : ''}`}
        </p>
      ) : (
        <p className={styles.empty}>
          {active
            ? 'Current developments will appear here as reporting becomes available.'
            : 'Loading current developments…'}
        </p>
      )}
    </EditorialSectionHero>
  );
}
