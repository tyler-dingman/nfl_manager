'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { NextGameMarkets } from '@/server/odds/next-game-markets';
import { CalendarDays } from 'lucide-react';
import { TEAM_LIST } from '@/data/teams';
import { gameWeekLabel, type CanonicalGame } from '@/lib/canonical-game';
import { getTeamDisplayAccent } from '@/lib/team-theme-tokens';
import { beatFont } from '@/components/beat/beat-font';
import styles from './next-game-hero-card.module.css';

export function nextGameDate(game: CanonicalGame) {
  if (!game.kickoffAt || !game.kickoffConfirmed) return 'DATE / TIME TO BE ANNOUNCED';
  const date = new Date(game.kickoffAt);
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
    .format(date)
    .toUpperCase();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${day} · ${time} ET`;
}

export function NextGameHeroCard({ teamId }: { teamId: string }) {
  const [result, setResult] = useState<{
    team: string;
    game: CanonicalGame | null;
    betting?: NextGameMarkets;
    failed?: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/content/next-game?team=${encodeURIComponent(teamId)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Schedule unavailable');
        const body = (await response.json()) as {
          game: CanonicalGame | null;
          betting?: NextGameMarkets;
        };
        if (controller.signal.aborted) return;
        setResult({ team: teamId, game: body.game, betting: body.betting });
        const untilKickoff = body.game?.kickoffAt
          ? new Date(body.game.kickoffAt).getTime() - Date.now()
          : Infinity;
        timer = setTimeout(refresh, Math.max(1000, Math.min(60000, untilKickoff + 100)));
      } catch {
        if (controller.signal.aborted) return;
        setResult({ team: teamId, game: null, failed: true });
        timer = setTimeout(refresh, 60000);
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [teamId]);
  const current = result?.team === teamId ? result : null;
  const game = current?.game;
  const teamIdentity = (abbr: string) => {
    const team = TEAM_LIST.find((t) => t.abbr === abbr);
    return (
      <div className={styles.team} data-matchup-team={abbr}>
        {team && <img src={team.logoUrl} alt={team.name} width={76} height={76} />}
        <strong>
          {team?.name.startsWith(`${team.city} `)
            ? team.name.slice(team.city.length + 1)
            : (team?.name ?? abbr)}
        </strong>
      </div>
    );
  };
  return (
    <aside
      aria-label="Next scheduled game"
      data-next-game-card
      className={`${styles.card} ${beatFont.variable}`}
      style={{ '--next-accent': getTeamDisplayAccent(teamId) } as CSSProperties}
    >
      <header className={styles.header}>
        <strong>NEXT UP</strong>
        {game && <span>{gameWeekLabel(game)}</span>}
      </header>
      {game ? (
        <>
          <div className={styles.matchup}>
            {teamIdentity(game.awayTeam)}
            <span className={styles.vs}>VS</span>
            {teamIdentity(game.homeTeam)}
          </div>
          <div className={styles.details}>
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <p>{nextGameDate(game)}</p>
              {game.venue && <p className={styles.venue}>{game.venue}</p>}
            </div>
          </div>
          {current?.betting && (
            <>
              {(current.betting.spread || current.betting.total || current.betting.moneyline) && (
                <div className={styles.odds} data-next-game-odds>
                  <div>
                    <span>SPREAD</span>
                    <strong>{current.betting.spread ?? '—'}</strong>
                  </div>
                  <div>
                    <span>TOTAL</span>
                    <strong>{current.betting.total ?? '—'}</strong>
                  </div>
                  <div>
                    <span>MONEYLINE</span>
                    <strong>{current.betting.moneyline ?? '—'}</strong>
                  </div>
                </div>
              )}
              <Link
                className={styles.parlayLink}
                href={`/parlay-lab/game/${encodeURIComponent(current.betting.eventId)}/markets`}
              >
                BUILD A PARLAY →
              </Link>
            </>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          {!current
            ? 'Loading schedule…'
            : current.failed
              ? 'Schedule temporarily unavailable.'
              : 'Schedule coming soon.'}
        </div>
      )}
    </aside>
  );
}
