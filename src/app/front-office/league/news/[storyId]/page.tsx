'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AppShell from '@/components/app-shell';
import { NewsGraphic } from '@/components/front-office/news-graphics/NewsGraphic';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import {
  eventToLeagueNewsStory,
  relativeNewsTime,
  type LeagueNewsStory,
} from '@/lib/front-office-league-news';
import type { FrontOfficeEvent } from '@/types/front-office';

export default function LeagueNewsStoryPage({ params }: { params: { storyId: string } }) {
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const [story, setStory] = useState<LeagueNewsStory | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    void apiFetch(`/api/front-office/events/${encodeURIComponent(params.storyId)}`)
      .then(async (response) => {
        if (!response.ok) return setMissing(true);
        const payload = (await response.json()) as { event: FrontOfficeEvent };
        setStory(eventToLeagueNewsStory(payload.event, teamAbbr));
      })
      .catch(() => setMissing(true));
  }, [params.storyId, teamAbbr]);
  return (
    <AppShell>
      {story ? (
        <article className="mx-auto w-full max-w-[1240px] pb-16">
          <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/experience">Front Office</Link>
            <span>›</span>
            <Link href="/front-office/league/news">League News</Link>
            <span>›</span>
            <span>Story</span>
          </nav>
          <NewsGraphic
            variant={story.graphicVariant}
            size="hero"
            team={story.team}
            opponent={story.opponent}
            label={story.categoryLabel}
            headline={story.headline}
            description={story.summary}
          />
          <div className="mx-auto max-w-4xl rounded-b-2xl bg-white p-6 shadow-sm sm:p-10">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--team-primary)]">
              {story.categoryLabel}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{story.headline}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>
                {story.authorName} · {story.authorHandle}
              </span>
              <span>·</span>
              <time>{relativeNewsTime(story.publishedAt)}</time>
            </div>
            <p className="mt-7 text-xl leading-8 text-slate-700">{story.summary}</p>
            <section className="mt-8 border-t pt-7">
              <h2 className="text-xl font-black">What happened</h2>
              <p className="mt-3 leading-7 text-slate-600">{story.summary}</p>
              <p className="mt-4 leading-7 text-slate-600">
                This report comes directly from the events recorded in your Front Office season.
                Continue the season to follow subsequent developments.
              </p>
            </section>
            <Link
              href="/front-office/league/news"
              className="mt-8 inline-flex items-center gap-2 font-bold text-[var(--team-primary)]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to League News
            </Link>
          </div>
        </article>
      ) : (
        <div className="grid min-h-[24rem] place-items-center text-muted-foreground">
          {missing ? 'This League News story could not be found.' : 'Loading story…'}
        </div>
      )}
    </AppShell>
  );
}
