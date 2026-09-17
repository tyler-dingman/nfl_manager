'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame, Globe2 } from 'lucide-react';

import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import {
  eventToLeagueNewsStory,
  frontOfficeEventIncludesTeam,
  leagueStoryGraphicModel,
  relativeNewsTime,
  type LeagueNewsCategory,
  type LeagueNewsStory,
} from '@/lib/front-office-league-news';
import type { FrontOfficeEvent } from '@/types/front-office';
import { FrontOfficeStoryGraphic } from '@/components/front-office/story-graphics/FrontOfficeStoryGraphic';
import styles from './league-news-page.module.css';

const tabs: Array<{ label: string; value: LeagueNewsCategory }> = [
  { label: 'All News', value: 'ALL' },
  { label: 'Rumors', value: 'RUMOR' },
  { label: 'Injuries', value: 'INJURY' },
  { label: 'Transactions', value: 'TRANSACTION' },
  { label: 'Contracts', value: 'CONTRACT' },
  { label: 'Game Recaps', value: 'GAME_RECAP' },
  { label: 'Analysis', value: 'ANALYSIS' },
  { label: 'My Team', value: 'MY_TEAM' },
];

const categoryClass: Record<LeagueNewsStory['category'], string> = {
  RUMOR: styles.rumor,
  INJURY: styles.injury,
  TRANSACTION: styles.transaction,
  CONTRACT: styles.contract,
  GAME_RECAP: styles.recap,
  ANALYSIS: styles.analysis,
};

export function LeagueNewsPage({
  initialCategory = 'ALL',
}: {
  initialCategory?: LeagueNewsCategory;
}) {
  const saveId = useSaveStore((state) => state.saveId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const [tab, setTab] = useState<LeagueNewsCategory>(initialCategory);
  const [sort, setSort] = useState<'recent' | 'trending' | 'relevant'>('recent');

  useEffect(() => {
    if (!saveId) return;
    const load = () =>
      void apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`)
        .then((response) => response.json())
        .then((payload) => setEvents(payload.events ?? []))
        .catch(() => setEvents([]));
    load();
    window.addEventListener('front-office-simulation-advanced', load);
    return () => window.removeEventListener('front-office-simulation-advanced', load);
  }, [saveId]);

  useEffect(() => setTab(initialCategory), [initialCategory]);

  const stories = useMemo(
    () =>
      events
        .filter((event) => !event.dismissedAt)
        .map((event) => eventToLeagueNewsStory(event, teamAbbr)),
    [events, teamAbbr],
  );
  const filtered = useMemo(() => {
    const result = stories.filter((story) => {
      if (tab === 'MY_TEAM' && !frontOfficeEventIncludesTeam(story.event, teamAbbr)) return false;
      if (!['ALL', 'MY_TEAM'].includes(tab) && story.category !== tab) return false;
      return true;
    });
    return result.sort((a, b) =>
      sort === 'trending'
        ? b.trendingScore - a.trendingScore
        : sort === 'relevant'
          ? b.importanceScore - a.importanceScore
          : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }, [sort, stories, tab, teamAbbr]);
  const featured = [...filtered].sort(
    (a, b) => b.importanceScore - a.importanceScore || b.trendingScore - a.trendingScore,
  )[0];
  const latest = filtered.filter((story) => story.id !== featured?.id).slice(0, 8);
  const trending = [...stories].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 5);
  const around = stories
    .filter((story) => !frontOfficeEventIncludesTeam(story.event, teamAbbr))
    .slice(0, 5);

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist" aria-label="News categories">
        {tabs.map((item) => (
          <button
            key={item.value}
            role="tab"
            aria-selected={tab === item.value}
            className={tab === item.value ? styles.activeTab : ''}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.topGrid}>
        <main className={styles.main}>
          {featured ? (
            <Link
              href={`/front-office/league/news/${encodeURIComponent(featured.id)}`}
              className={styles.featured}
            >
              <FrontOfficeStoryGraphic
                story={leagueStoryGraphicModel(featured)}
                size="hero"
                actionLabel="Read full story"
              />
              <div className={styles.featureMeta}>
                <span>{featured.categoryLabel}</span>
                <time>{relativeNewsTime(featured.publishedAt)}</time>
              </div>
            </Link>
          ) : (
            <div className={styles.empty}>
              No stories match this view yet. Advance the season to generate the next news cycle.
            </div>
          )}
        </main>
        <aside className={styles.sidebar}>
          <section className={`${styles.sideCard} ${styles.trending}`}>
            <header>
              <h2>
                <Flame /> Trending Now
              </h2>
              <button
                onClick={() => {
                  setTab('ALL');
                  setSort('trending');
                }}
              >
                View All <ArrowRight />
              </button>
            </header>
            <ol>
              {trending.map((story, index) => (
                <li key={story.id}>
                  <b>{index + 1}</b>
                  <Link href={`/front-office/league/news/${encodeURIComponent(story.id)}`}>
                    {story.headline}
                  </Link>
                  <time>{relativeNewsTime(story.publishedAt)}</time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.latest}>
            <header>
              <h2>Latest News</h2>
              <label>
                Sort By{' '}
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as typeof sort)}
                >
                  <option value="recent">Most Recent</option>
                  <option value="trending">Trending</option>
                  <option value="relevant">Most Relevant</option>
                </select>
              </label>
            </header>
            <div className={styles.grid}>
              {latest.map((story) => (
                <Link
                  key={story.id}
                  href={`/front-office/league/news/${encodeURIComponent(story.id)}`}
                  className={styles.storyCard}
                >
                  <FrontOfficeStoryGraphic
                    story={{ ...leagueStoryGraphicModel(story), summary: undefined }}
                    size="card"
                  />
                  <div className={styles.storyCopy}>
                    <div>
                      <span className={categoryClass[story.category]}>{story.categoryLabel}</span>
                      <time>{relativeNewsTime(story.publishedAt)}</time>
                    </div>
                    <h3>{story.headline}</h3>
                    <div className={styles.cardMeta}>
                      {story.team?.displayName ?? 'League News'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </main>
        <aside className={styles.sidebar}>
          <section className={`${styles.sideCard} ${styles.around}`}>
            <header>
              <h2>
                <Globe2 /> Around the League
              </h2>
            </header>
            <div>
              {around.map((story) => (
                <Link
                  href={`/front-office/league/news/${encodeURIComponent(story.id)}`}
                  key={story.id}
                >
                  <span>{story.team?.abbreviation ?? 'D&D'}</span>
                  <strong>{story.headline}</strong>
                  <time>{relativeNewsTime(story.publishedAt)}</time>
                </Link>
              ))}
            </div>
            <button
              onClick={() => {
                setTab('ALL');
              }}
            >
              View More League News <ArrowRight />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
