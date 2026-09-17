'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import {
  buildPlayoffPicture,
  buildStandingsSnapshot,
  gamesForWeek,
  rankStandings,
  type StandingsTeam,
} from '@/lib/front-office-standings';
import type { FranchiseSimulationState } from '@/types/front-office';
import styles from './front-office-standings.module.css';

type View = 'Overall' | 'AFC' | 'NFC' | 'Division' | 'Wild Card' | 'Playoff Picture';
const views: View[] = ['Overall', 'AFC', 'NFC', 'Division', 'Wild Card', 'Playoff Picture'];
const teamInfo = new Map(TEAM_LIST.map((team) => [team.abbr, team]));
const divisionOrder = ['East', 'North', 'South', 'West'];

function gamesBehind(team: StandingsTeam, leader: StandingsTeam) {
  if (team.abbr === leader.abbr) return '–';
  const value =
    (leader.record.wins - team.record.wins + team.record.losses - leader.record.losses) / 2;
  return value <= 0 ? '–' : value.toFixed(1);
}

function TeamMark({ abbr }: { abbr: string }) {
  return (
    <i
      className={styles.teamMark}
      style={{ backgroundColor: teamInfo.get(abbr)?.colors[0] ?? '#13283f' }}
      aria-hidden="true"
    />
  );
}

function DivisionTable({
  conference,
  division,
  teams,
  selectedTeam,
}: {
  conference: string;
  division: string;
  teams: StandingsTeam[];
  selectedTeam: string;
}) {
  const rows = rankStandings(
    teams.filter((team) => team.conference === conference && team.division === division),
  );
  if (!rows.length) return null;
  return (
    <section className={styles.division}>
      <header>
        <strong>
          {conference} {division}
        </strong>
        <span>W</span>
        <span>L</span>
        <span>T</span>
        <span>PCT</span>
        <span>GB</span>
      </header>
      {rows.map((team) => (
        <div
          key={team.abbr}
          className={team.abbr === selectedTeam ? styles.selectedTeam : undefined}
        >
          <span className={styles.teamName}>
            <TeamMark abbr={team.abbr} />
            {teamInfo.get(team.abbr)?.city ?? team.abbr}
          </span>
          <span>{team.record.wins}</span>
          <span>{team.record.losses}</span>
          <span>{team.record.ties}</span>
          <span>{team.winPercentage.toFixed(3).replace(/^0/, '')}</span>
          <span>{gamesBehind(team, rows[0])}</span>
        </div>
      ))}
    </section>
  );
}

function ConferenceCard({
  conference,
  teams,
  selectedTeam,
  onlyDivision,
}: {
  conference: string;
  teams: StandingsTeam[];
  selectedTeam: string;
  onlyDivision?: string;
}) {
  const divisions = onlyDivision ? [onlyDivision] : divisionOrder;
  return (
    <article className={styles.conferenceCard}>
      <h2>
        <b>{conference.slice(0, 1)}</b>
        {conference}
      </h2>
      {divisions.map((division) => (
        <DivisionTable
          key={division}
          conference={conference}
          division={division}
          teams={teams}
          selectedTeam={selectedTeam}
        />
      ))}
    </article>
  );
}

function PlayoffPicture({ teams, selectedTeam }: { teams: StandingsTeam[]; selectedTeam: string }) {
  return (
    <section className={styles.sideCard}>
      <header>
        <h2>Playoff picture</h2>
        <Link href="/league?view=playoffs">
          View full playoff picture <ArrowRight />
        </Link>
      </header>
      <div className={styles.playoffColumns}>
        {['AFC', 'NFC'].map((conference) => {
          const seeds = buildPlayoffPicture(teams, conference);
          return (
            <div key={conference}>
              <h3>{conference}</h3>
              {seeds.map((team, index) => (
                <div
                  key={team.abbr}
                  className={team.abbr === selectedTeam ? styles.selectedSeed : undefined}
                >
                  <b>{index + 1}</b>
                  <TeamMark abbr={team.abbr} />
                  <span>{teamInfo.get(team.abbr)?.city ?? team.abbr}</span>
                  <small>
                    {team.record.wins}-{team.record.losses}
                  </small>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WeekResults({
  state,
  week,
  selectedTeam,
}: {
  state: FranchiseSimulationState;
  week: number;
  selectedTeam: string;
}) {
  const games = gamesForWeek(state, week)
    .sort(
      (a, b) =>
        Number([b.homeTeam, b.awayTeam].includes(selectedTeam)) -
        Number([a.homeTeam, a.awayTeam].includes(selectedTeam)),
    )
    .slice(0, 5);
  return (
    <section className={styles.sideCard}>
      <header>
        <h2>Week {week} results</h2>
        <Link href={`/league?view=schedule&week=${week}`}>
          View full schedule <ArrowRight />
        </Link>
      </header>
      <div className={styles.results}>
        {games.length ? (
          games.map((game) => (
            <div
              key={game.id}
              className={
                [game.homeTeam, game.awayTeam].includes(selectedTeam)
                  ? styles.selectedResult
                  : undefined
              }
            >
              <TeamMark abbr={game.awayTeam} />
              <span>{teamInfo.get(game.awayTeam)?.city ?? game.awayTeam}</span>
              <b>{game.awayScore}</b>
              <TeamMark abbr={game.homeTeam} />
              <span>{teamInfo.get(game.homeTeam)?.city ?? game.homeTeam}</span>
              <b>{game.homeScore}</b>
              <small>Final</small>
            </div>
          ))
        ) : (
          <p>No final scores are available for Week {week} yet.</p>
        )}
      </div>
    </section>
  );
}

export function FrontOfficeStandingsPage() {
  const saveId = useSaveStore((store) => store.saveId);
  const selectedTeam = useSaveStore((store) => store.teamAbbr);
  const [state, setState] = useState<FranchiseSimulationState | null>(null);
  const [view, setView] = useState<View>('Overall');
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
        if (!response.ok) throw new Error(json.error ?? 'Unable to load standings.');
        if (active) {
          setState(json.state ?? null);
          setWeek(Math.max(1, json.state?.currentWeek ?? 1));
          setError('');
        }
      } catch (loadError) {
        if (active)
          setError(loadError instanceof Error ? loadError.message : 'Unable to load standings.');
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    return () => {
      active = false;
      window.removeEventListener('front-office-simulation-advanced', load);
    };
  }, [saveId]);

  const teams = useMemo(
    () => (state ? Object.values(buildStandingsSnapshot(state, week)) : []),
    [state, week],
  );
  const selected = teams.find((team) => team.abbr === selectedTeam);
  const conferences = view === 'AFC' ? ['AFC'] : view === 'NFC' ? ['NFC'] : ['AFC', 'NFC'];
  const showDivisionOnly = view === 'Division';

  if (error) return <div className={styles.status}>{error}</div>;
  if (!state) return <div className={styles.status}>Loading league standings…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div />
        <div className={styles.filters}>
          <label>
            Season
            <select value={state.season} disabled>
              <option>{state.season}</option>
            </select>
          </label>
          <label>
            View Week
            <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
              {Array.from({ length: Math.max(1, state.currentWeek) }, (_, index) => index + 1).map(
                (item) => (
                  <option key={item} value={item}>
                    Week {item}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </div>
      <div className={styles.tabs}>
        {views.map((item) => (
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
      <div className={styles.layout}>
        <div
          className={`${styles.conferences} ${view === 'AFC' || view === 'NFC' || view === 'Division' ? styles.singleConference : ''}`}
        >
          {conferences
            .filter((conference) => !showDivisionOnly || conference === selected?.conference)
            .map((conference) => (
              <ConferenceCard
                key={conference}
                conference={conference}
                teams={teams}
                selectedTeam={selectedTeam}
                onlyDivision={showDivisionOnly ? selected?.division : undefined}
              />
            ))}
        </div>
        <aside>
          <PlayoffPicture teams={teams} selectedTeam={selectedTeam} />
          <WeekResults state={state} week={week} selectedTeam={selectedTeam} />
        </aside>
      </div>
    </div>
  );
}
