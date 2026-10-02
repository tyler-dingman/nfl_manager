'use client';
import { useState } from 'react';
import { NewsSocialCard } from '@/components/front-office/news-social-card';
import { NewsPreferencesPanel } from '@/components/front-office/news-preferences';
import { defaultNewsPreferences } from '@/lib/front-office-news-presentation';
import type { FrontOfficeEvent } from '@/types/front-office';
export default function Preview({
  events,
  initialMode,
}: {
  events: FrontOfficeEvent[];
  initialMode?: string;
}) {
  const [prefs, setPrefs] = useState(defaultNewsPreferences),
    [mode, setMode] = useState(initialMode ?? 'preview');
  return (
    <div style={{ padding: 16, background: '#02131b', minHeight: '100vh', color: 'white' }}>
      <p>Development visual preview · simulation-generated sample stories</p>
      <div style={{ display: 'flex', gap: 20, padding: 16 }}>
        {['preview', 'expanded', 'settings'].map((m) => (
          <button key={m} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </div>
      {mode === 'settings' ? (
        <NewsPreferencesPanel value={prefs} onChange={setPrefs} />
      ) : mode === 'preview' ? (
        <aside
          className="fo-wire-panel"
          data-mode="news"
          style={{ position: 'relative', inset: 'auto', maxWidth: '100%' }}
        >
          <header className="fo-wire-header">
            <h2>◉ News</h2>
            <button aria-label="Close news">×</button>
          </header>
          <div className="fo-news-filters" role="tablist">
            {['All', 'My Team', 'League', 'Breaking'].map((t, i) => (
              <button role="tab" aria-selected={!i} key={t}>
                {t}{' '}
                <span>
                  {i === 0
                    ? events.length
                    : i === 3
                      ? 0
                      : events.filter((e) => (e.teamAbbr === 'KC') === (i === 1)).length}
                </span>
              </button>
            ))}
          </div>
          <div className="fo-wire-list">
            {events.slice(0, 10).map((e) => (
              <a key={e.id} href="#" className="fo-news-row unread">
                <NewsSocialCard event={e} />
              </a>
            ))}
            <button className="fo-news-view-all" onClick={() => setMode('expanded')}>
              View All News →
            </button>
          </div>
        </aside>
      ) : (
        <section className="fo-news-expanded">
          <aside className="fo-news-navigation">
            <h1>◉ News</h1>
            {['All News', 'My Team', 'League', 'Performance'].map((t, i) => (
              <button key={t} aria-pressed={!i}>
                {t}
              </button>
            ))}
          </aside>
          <main className="fo-news-feed">
            <input placeholder="Search player, team, headline or category…" />
            {events.map((e) => (
              <a key={e.id} href="#" className="fo-news-row unread">
                <NewsSocialCard event={e} />
              </a>
            ))}
          </main>
          <aside className="fo-news-related">
            <h2>Your simulated league</h2>
            <p>
              News reflects this franchise’s players, transactions, and season. D&D personas are
              fictional editorial voices.
            </p>
          </aside>
        </section>
      )}
    </div>
  );
}
