'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BarChart3, Trophy } from 'lucide-react';

import AppShell from '@/components/app-shell';
import { FrontOfficePageHeader } from '@/components/front-office/front-office-page-header';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import {
  NewsGraphic,
  type NewsGraphicTeam,
} from '@/components/front-office/news-graphics/NewsGraphic';
import { resolveNewsGraphicVariant } from '@/components/front-office/news-graphics/news-graphic-variant';
import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { FrontOfficeEvent } from '@/types/front-office';

const sections = [
  {
    title: 'League Leaders',
    description: 'Compare statistical leaders across every team.',
    icon: BarChart3,
    view: 'stats',
  },
  {
    title: 'Standings',
    description: 'Follow division races and playoff positioning.',
    icon: Trophy,
    view: 'standings',
  },
];

const newsTeam = (abbr: string | null): NewsGraphicTeam | undefined => {
  const team = TEAM_LIST.find((entry) => entry.abbr === abbr);
  return team
    ? {
        id: team.id,
        abbreviation: team.abbr,
        displayName: `${team.city} ${team.name}`,
        primaryColor: team.colors[0],
        secondaryColor: team.colors[1],
      }
    : undefined;
};

export default function LeaguePage() {
  const searchParams = useSearchParams();
  const view = searchParams?.get('view');
  const saveId = useSaveStore((state) => state.saveId);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);

  useEffect(() => {
    if (!saveId) return;
    void apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`)
      .then((response) => response.json())
      .then((payload) => setEvents(payload.events ?? []))
      .catch(() => setEvents([]));
  }, [saveId]);

  const stories = useMemo(() => events.filter((event) => !event.dismissedAt).slice(0, 9), [events]);
  const lead = stories[0];

  return (
    <AppShell>
      <FrontOfficePageHeader
        title={view === 'transactions' ? 'Transactions' : 'League Central'}
        strapline="Every team. Every race. One league."
        description={
          view === 'transactions'
            ? 'Track trades, signings, releases, and roster movement from around the league.'
            : 'Follow the season, track the standings, and stay ahead of what is happening around the league.'
        }
      />
      <FrontOfficeSectionNav section="league" />
      <div className="space-y-6">
        <section aria-labelledby="league-news-heading">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--team-primary)]">
              Around the league
            </p>
            <h2 id="league-news-heading" className="mt-1 text-3xl font-black">
              Latest News
            </h2>
          </div>
          {lead ? (
            <Link
              href={lead.actionUrl ?? '/experience'}
              className="block overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <NewsGraphic
                variant={resolveNewsGraphicVariant(lead.type, lead.headline)}
                size="hero"
                team={newsTeam(lead.teamAbbr)}
                opponent={newsTeam(lead.relatedTeamAbbr)}
                label={lead.type.replaceAll('_', ' ')}
                headline={lead.headline}
                description={lead.summary}
              />
            </Link>
          ) : (
            <div className="rounded-2xl border bg-white p-8 text-muted-foreground">
              League stories will appear here as your season advances.
            </div>
          )}
          {stories.length > 1 ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {stories.slice(1).map((story) => (
                <Link
                  key={story.id}
                  href={story.actionUrl ?? '/experience'}
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <NewsGraphic
                    variant={resolveNewsGraphicVariant(story.type, story.headline)}
                    size="card"
                    team={newsTeam(story.teamAbbr)}
                    opponent={newsTeam(story.relatedTeamAbbr)}
                    label={story.type.replaceAll('_', ' ')}
                    headline={story.headline}
                  />
                  <div className="p-5">
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {story.summary}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase text-[var(--team-primary)]">
                      Read story <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
        <section className="grid gap-4 md:grid-cols-2" aria-label="League sections">
          {sections.map(({ title, description, icon: Icon, view }) => (
            <Link
              href={`/league?view=${view}`}
              key={title}
              className="rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              <Icon className="h-6 w-6 text-[var(--team-primary)]" aria-hidden="true" />
              <h2 className="mt-5 text-xl font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
