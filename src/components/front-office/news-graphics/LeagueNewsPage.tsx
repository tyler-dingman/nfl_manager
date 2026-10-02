'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { LeagueNewsCategory } from '@/lib/front-office-league-news';
import type { FrontOfficeEvent } from '@/types/front-office';
import { NewsSocialCard } from '../news-social-card';
import { NewsPreferencesPanel } from '../news-preferences';
import { defaultNewsPreferences, type NewsPreferences } from '@/lib/front-office-news-presentation';
export function LeagueNewsPage({
  initialCategory = 'ALL',
}: {
  initialCategory?: LeagueNewsCategory;
}) {
  const saveId = useSaveStore((s) => s.saveId);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState(initialCategory === 'ALL' ? '' : initialCategory);
  const [query, setQuery] = useState('');
  const [next, setNext] = useState<number | null>(null);
  const [counts, setCounts] = useState<{
    all: number;
    team: number;
    league: number;
    breaking: number;
    categories: { category: string; count: number }[];
  }>({ all: 0, team: 0, league: 0, breaking: 0, categories: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(false);
  const [preferences, setPreferences] = useState<NewsPreferences>(defaultNewsPreferences);
  useEffect(() => {
    try {
      setPreferences({
        ...defaultNewsPreferences,
        ...JSON.parse(localStorage.getItem(`fo-news-preferences:${saveId}`) ?? '{}'),
      });
    } catch {}
  }, [saveId]);
  async function load(offset = 0, signal?: AbortSignal) {
    if (!saveId) return;
    setLoading(true);
    setError('');
    try {
      const r = await apiFetch(
        `/api/front-office/events?saveId=${encodeURIComponent(saveId)}&notifications=1&limit=20&offset=${offset}&filter=${filter}&category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`,
        { signal },
      );
      if (!r.ok) throw new Error('Unable to load News.');
      const p = await r.json();
      setEvents((old) =>
        offset ? [...new Map([...old, ...p.events].map((e) => [e.id, e])).values()] : p.events,
      );
      setNext(p.nextOffset);
      setCounts(p.counts);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Unable to load News.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => void load(0, c.signal), 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [saveId, filter, category, query]);
  return (
    <section className="fo-news-expanded">
      <aside className="fo-news-navigation">
        <h1>◉ News</h1>
        {[
          ['all', 'All News', counts.all],
          ['team', 'My Team', counts.team],
          ['league', 'League', counts.league],
          ['breaking', 'Breaking', counts.breaking],
        ].map(([key, label, count]) => (
          <button
            key={key}
            aria-pressed={filter === key && !category}
            onClick={() => {
              setFilter(String(key));
              setCategory('');
            }}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
        {counts.categories
          .filter((c) => c.category)
          .map((c) => (
            <button
              key={c.category}
              aria-pressed={category === c.category}
              onClick={() => setCategory(c.category as LeagueNewsCategory)}
            >
              {c.category.replaceAll('_', ' ')}
              <span>{c.count}</span>
            </button>
          ))}
        <button onClick={() => setSettings((v) => !v)}>Notification settings</button>
      </aside>
      <main className="fo-news-feed">
        <label className="sr-only" htmlFor="news-search">
          Search news
        </label>
        <input
          id="news-search"
          placeholder="Search player, team, headline or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {settings && (
          <NewsPreferencesPanel
            value={preferences}
            onChange={(p) => {
              setPreferences(p);
              localStorage.setItem(`fo-news-preferences:${saveId}`, JSON.stringify(p));
              window.dispatchEvent(new Event('front-office-news-preferences'));
            }}
          />
        )}
        {error && (
          <p role="alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </p>
        )}
        {!loading && !error && !events.length && (
          <p>No stories match. News will accumulate as your franchise advances.</p>
        )}
        {events.map((e) => (
          <Link
            className={`fo-news-row ${e.readAt ? 'read' : 'unread'}`}
            key={e.id}
            href={`/front-office/league/news/${encodeURIComponent(e.id)}`}
            onClick={() =>
              void apiFetch(`/api/front-office/events/${encodeURIComponent(e.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read' }),
              })
            }
          >
            <NewsSocialCard event={e} />
          </Link>
        ))}
        {loading && <p role="status">Loading News…</p>}
        {next !== null && (
          <button className="fo-news-view-all" disabled={loading} onClick={() => void load(next)}>
            Load more news
          </button>
        )}
      </main>
      <aside className="fo-news-related">
        <h2>Your simulated league</h2>
        <p>
          News reflects this franchise’s players, transactions, and season. D&D personas are
          fictional editorial voices.
        </p>
        <Link href="/front-office/league/standings">Explore standings →</Link>
        <Link href="/front-office/trade-hub">Explore Trade Hub →</Link>
      </aside>
    </section>
  );
}
