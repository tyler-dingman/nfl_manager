'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import type { FranchiseGameState, FranchiseSimulationState } from '@/types/front-office';
import styles from './front-office-schedule.module.css';

const teamInfo = new Map(TEAM_LIST.map((team) => [team.abbr, team]));
type View = 'My Schedule' | 'League Week';

function resultFor(game: FranchiseGameState, teamAbbr: string) {
  if (!game.played || game.homeScore === null || game.awayScore === null) return null;
  const teamScore = game.homeTeam === teamAbbr ? game.homeScore : game.awayScore;
  const opponentScore = game.homeTeam === teamAbbr ? game.awayScore : game.homeScore;
  return {
    result: teamScore === opponentScore ? 'T' : teamScore > opponentScore ? 'W' : 'L',
    teamScore,
    opponentScore,
  };
}

function TeamLogo({ abbr }: { abbr: string }) {
  const team = teamInfo.get(abbr);
  return team?.logoUrl ? <Image src={team.logoUrl} alt="" width={54} height={54} /> : null;
}

export function FrontOfficeSchedulePage() {
  const saveId = useSaveStore((store) => store.saveId);
  const selectedTeam = useSaveStore((store) => store.teamAbbr);
  const [state, setState] = useState<FranchiseSimulationState | null>(null);
  const [view, setView] = useState<View>('My Schedule');
  const [week, setWeek] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!saveId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await apiFetch(
          `/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`,
        );
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? 'Unable to load schedule.');
        if (active) {
          setState(json.state ?? null);
          setWeek(Math.max(1, json.state?.currentWeek ?? 1));
          setError('');
        }
      } catch (loadError) {
        if (active)
          setError(loadError instanceof Error ? loadError.message : 'Unable to load schedule.');
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    return () => {
      active = false;
      window.removeEventListener('front-office-simulation-advanced', load);
    };
  }, [saveId]);

  const team = teamInfo.get(selectedTeam);
  const teamGames = useMemo(() => {
    if (!state) return new Map<number, FranchiseGameState>();
    return new Map(
      state.games
        .filter(
          (game) =>
            game.seasonType === 'REG' &&
            (game.homeTeam === selectedTeam || game.awayTeam === selectedTeam),
        )
        .map((game) => [game.week, game]),
    );
  }, [selectedTeam, state]);
  const leagueGames = useMemo(
    () => state?.games.filter((game) => game.seasonType === 'REG' && game.week === week) ?? [],
    [state, week],
  );

  if (error) return <div className={styles.status}>{error}</div>;
  if (!state) return <div className={styles.status}>Loading league schedule…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div />
        <label>
          Season
          <select value={state.season} disabled>
            <option>{state.season}</option>
          </select>
        </label>
      </header>
      <div className={styles.tabs}>
        {(['My Schedule', 'League Week'] as View[]).map((item) => (
          <button
            key={item}
            type="button"
            className={view === item ? styles.activeTab : undefined}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {view === 'My Schedule' ? (
        <section className={styles.scheduleCard}>
          <div className={styles.teamHero}>
            <div className={styles.logoBox}>{team ? <TeamLogo abbr={team.abbr} /> : null}</div>
            <div>
              <small>{state.season}</small>
              <h2>{team?.name ?? selectedTeam} Schedule</h2>
            </div>
            <p>
              <b>Home</b>
              <span>Away</span>
            </p>
          </div>
          <div className={styles.weekGrid}>
            {Array.from({ length: 18 }, (_, index) => index + 1).map((item) => {
              const game = teamGames.get(item);
              if (!game)
                return (
                  <article key={item} className={styles.bye}>
                    <small>Week {item}</small>
                    <strong>Bye Week</strong>
                  </article>
                );
              const home = game.homeTeam === selectedTeam;
              const opponent = home ? game.awayTeam : game.homeTeam;
              const result = resultFor(game, selectedTeam);
              return (
                <article
                  key={game.id}
                  className={`${home ? styles.home : styles.away} ${item === state.currentWeek ? styles.current : ''}`}
                >
                  <div>
                    <small>Week {item}</small>
                    {result ? (
                      <em data-result={result.result}>{result.result}</em>
                    ) : (
                      <em>Upcoming</em>
                    )}
                  </div>
                  <div className={styles.matchup}>
                    <TeamLogo abbr={opponent} />
                    <span>{home ? 'vs' : '@'}</span>
                    <strong>{opponent}</strong>
                  </div>
                  <p>
                    {result
                      ? `${result.teamScore}–${result.opponentScore} Final`
                      : home
                        ? 'Home'
                        : 'Away'}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className={styles.leagueCard}>
          <div className={styles.weekPicker}>
            <h2>Week {week}</h2>
            <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
              {Array.from({ length: 18 }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>
                  Week {item}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.gameGrid}>
            {leagueGames.map((game) => (
              <article
                key={game.id}
                className={
                  [game.homeTeam, game.awayTeam].includes(selectedTeam)
                    ? styles.selectedGame
                    : undefined
                }
              >
                <div>
                  <TeamLogo abbr={game.awayTeam} />
                  <b>{game.awayTeam}</b>
                  <strong>{game.awayScore ?? '–'}</strong>
                </div>
                <div>
                  <TeamLogo abbr={game.homeTeam} />
                  <b>{game.homeTeam}</b>
                  <strong>{game.homeScore ?? '–'}</strong>
                </div>
                <small>{game.played ? `Final${game.overtime ? ' · OT' : ''}` : 'Upcoming'}</small>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
