'use client';

import Link from 'next/link';
import { Bookmark, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import ParlayLabSecondaryNav from './ParlayLabSecondaryNav';
import PlayerAvatar from './PlayerAvatar';
import styles from './my-plays-page.module.css';

type SavedLeg = {
  id?: string;
  playerName?: string | null;
  headshotUrl?: string | null;
  teamId?: string | null;
  marketType?: string;
  side?: string;
  line?: number | null;
  odds?: number | null;
  sportsbook?: string;
};
type SavedPlay = {
  id: string;
  createdAt?: string;
  selections: SavedLeg[];
};

const label = (value?: string) =>
  value
    ? value
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Market';
const pick = (leg: SavedLeg) =>
  `${leg.side === 'OVER' ? 'O' : leg.side === 'UNDER' ? 'U' : (leg.side ?? '')} ${leg.line ?? ''}`.trim();
const price = (value?: number | null) => (value == null ? '—' : `${value > 0 ? '+' : ''}${value}`);

export default function MyPlaysPage() {
  const [plays, setPlays] = useState<SavedPlay[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('down-distance-parlay-lab-slips') ?? '[]');
      const current = JSON.parse(localStorage.getItem('down-distance-parlay-lab-current') ?? '[]');
      const history = Array.isArray(saved) ? (saved as SavedPlay[]) : [];
      const currentIsSaved =
        Array.isArray(current) &&
        history.some((play) => JSON.stringify(play.selections) === JSON.stringify(current));
      const currentPlay =
        Array.isArray(current) && current.length && !currentIsSaved
          ? [{ id: 'current', selections: current as SavedLeg[] }]
          : [];
      setPlays([...currentPlay, ...history]);
    } catch {
      setPlays([]);
    }
  }, []);

  return (
    <div className={styles.shell}>
      <MainSiteHeader active="parlay-lab" tone="brand" />
      <ParlayLabSecondaryNav />
      <main className={styles.page}>
        <header className={styles.header}>
          <span>
            <Bookmark /> Saved research
          </span>
          <h1>My Plays</h1>
          <p>Your saved Parlay Lab slips live in this browser.</p>
        </header>
        {plays.length ? (
          <div className={styles.grid}>
            {plays.map((play, playIndex) => (
              <article key={`${play.id}-${playIndex}`}>
                <header>
                  <div>
                    <small>
                      {play.createdAt ? new Date(play.createdAt).toLocaleString() : 'Current'}
                    </small>
                    <h2>{play.selections.length} Pick Parlay</h2>
                  </div>
                  <b>{play.selections.length}</b>
                </header>
                <ol>
                  {play.selections.map((leg, index) => (
                    <li key={`${leg.id ?? index}-${index}`}>
                      <i>{index + 1}</i>
                      <PlayerAvatar name={leg.playerName} headshotUrl={leg.headshotUrl} size={34} />
                      <div>
                        <strong>{leg.playerName ?? leg.teamId ?? 'Game'}</strong>
                        <span>
                          {pick(leg)} {label(leg.marketType)}
                        </span>
                        <small>{leg.sportsbook ?? 'Sportsbook'}</small>
                      </div>
                      <b>{price(leg.odds)}</b>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        ) : (
          <section className={styles.empty}>
            <Plus />
            <h2>No saved plays yet</h2>
            <p>Build a research slip and choose Save to add it here.</p>
            <Link href="/parlay-lab/trends">Explore Trending Props</Link>
          </section>
        )}
      </main>
    </div>
  );
}
