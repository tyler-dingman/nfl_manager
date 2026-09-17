'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, CloudSun, MapPin, MessageCircle, Repeat2 } from 'lucide-react';

import { TEAM_LIST } from '@/data/teams';
import { apiFetch } from '@/lib/api';
import type {
  FranchiseGameState,
  FranchiseSimulationState,
  FrontOfficeEvent,
} from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';

type Tab = 'team' | 'league';
type DisplayPlayer = {
  id: string;
  name: string;
  teamAbbr: string;
  position: string;
  rating: number;
  headshotUrl?: string | null;
};

const teamByAbbr = new Map(TEAM_LIST.map((team) => [team.abbr, team]));
const recordText = (record?: { wins: number; losses: number; ties: number }) =>
  record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : '0-0';

const playerLookupKey = (player: Pick<DisplayPlayer, 'name'>) =>
  player.name.toLowerCase().replace(/[^a-z0-9]/g, '');

function pickTopPlayers(players: DisplayPlayer[], teamAbbr: string) {
  const active = players.filter((player) => player.teamAbbr === teamAbbr);
  const rating = (player: DisplayPlayer) => player.rating;
  const best = (positions: string[]) =>
    active
      .filter((player) => positions.includes(player.position))
      .sort((a, b) => rating(b) - rating(a))[0];
  return [
    best(['QB']),
    best(['WR', 'TE', 'RB', 'FB']),
    best(['EDGE', 'DE', 'DT', 'DL', 'LB', 'CB', 'S']),
  ].filter(
    (player, index, list): player is DisplayPlayer =>
      Boolean(player) && list.indexOf(player) === index,
  );
}

function PlayerChip({ player }: { player: DisplayPlayer }) {
  const name = player.name;
  const team = teamByAbbr.get(player.teamAbbr);
  const headshotBackground = team?.colors[1] ?? team?.colors[0] ?? '#33404b';
  return (
    <div className="fo-home-player">
      {player.headshotUrl ? (
        <img src={player.headshotUrl} alt="" style={{ backgroundColor: headshotBackground }} />
      ) : (
        <span style={{ backgroundColor: headshotBackground }}>{name.slice(0, 1)}</span>
      )}
      <div>
        <strong>{name}</strong>
        <small>{player.position}</small>
      </div>
    </div>
  );
}

function MatchupCard({
  state,
  teamAbbr,
  roster,
  matchupPlayers,
}: {
  state: FranchiseSimulationState;
  teamAbbr: string;
  roster: DisplayPlayer[];
  matchupPlayers: DisplayPlayer[];
}) {
  const game = state.games.find(
    (entry) =>
      !entry.played &&
      entry.seasonType === 'REG' &&
      [entry.homeTeam, entry.awayTeam].includes(teamAbbr),
  );
  if (!game)
    return (
      <section className="fo-home-matchup fo-home-empty">
        <h2>Season complete</h2>
        <p>Your next matchup will appear when the new schedule is available.</p>
      </section>
    );
  const opponent = game.homeTeam === teamAbbr ? game.awayTeam : game.homeTeam;
  const ours = teamByAbbr.get(teamAbbr);
  const theirs = teamByAbbr.get(opponent);
  const currentTeamPool = matchupPlayers.filter((player) => player.teamAbbr === teamAbbr);
  const currentTeamById = new Map(currentTeamPool.map((player) => [player.id, player]));
  const currentTeamByName = new Map(
    currentTeamPool.map((player) => [playerLookupKey(player), player]),
  );
  const enrichedRoster = roster.map((player) => {
    const canonical =
      currentTeamById.get(player.id) ?? currentTeamByName.get(playerLookupKey(player));
    return {
      ...player,
      // The saved roster is the source of truth for team membership. A player's
      // original NFL team may remain on older saves after a trade or import.
      teamAbbr,
      headshotUrl: player.headshotUrl || canonical?.headshotUrl,
      rating: player.rating || canonical?.rating || 0,
    };
  });
  const ourPlayers = pickTopPlayers(
    enrichedRoster.length ? enrichedRoster : currentTeamPool,
    teamAbbr,
  );
  const opponentPlayers = pickTopPlayers(matchupPlayers, opponent);
  return (
    <section className="fo-home-matchup" aria-label={`Week ${game.week} matchup`}>
      <div className="fo-home-matchup-shade" />
      <div className="fo-home-matchup-content">
        <div className="fo-home-next">
          <span>{ours?.name ?? teamAbbr} · Next Game</span>
          <strong>Week {game.week}</strong>
        </div>
        <div className="fo-home-versus">
          <div>
            <strong>{ours?.city ?? teamAbbr}</strong>
            <span>{recordText(state.teams[teamAbbr]?.record)}</span>
          </div>
          <b>VS</b>
          <div>
            <strong>{theirs?.city ?? opponent}</strong>
            <span>{recordText(state.teams[opponent]?.record)}</span>
          </div>
        </div>
        <div className="fo-home-matchup-details">
          <div className="fo-home-watch">
            <h3>Top players to watch</h3>
            {ourPlayers.length ? (
              ourPlayers.map((player) => <PlayerChip key={player.id} player={player} />)
            ) : (
              <p className="fo-home-muted">Team leaders will be announced.</p>
            )}
          </div>
          <div className="fo-home-game-info">
            <p>
              <CalendarDays /> Week {game.week} matchup
            </p>
            <p>
              <MapPin />{' '}
              {game.homeTeam === teamAbbr
                ? `${ours?.city ?? teamAbbr}, home`
                : `${theirs?.city ?? opponent}, away`}
            </p>
            <p>
              <CloudSun /> Game-day details to come
            </p>
            <Link href={`/league?view=stats&week=${game.week}`}>
              View full matchup <ArrowRight />
            </Link>
          </div>
          <div className="fo-home-watch fo-home-watch-away">
            <h3>Top players to watch</h3>
            {opponentPlayers.length ? (
              opponentPlayers.map((player) => <PlayerChip key={player.id} player={player} />)
            ) : (
              <p className="fo-home-muted">Opponent leaders will be announced.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Messages({ events }: { events: FrontOfficeEvent[] }) {
  const messages = events
    .filter((event) =>
      [
        'welcome_message',
        're_sign_ready',
        'trade_interest',
        'deadline_alert',
        'trade_offer',
      ].includes(event.type),
    )
    .sort((a, b) => {
      const aOrder = Number(a.metadata.messageOrder ?? 99);
      const bOrder = Number(b.metadata.messageOrder ?? 99);
      return a.type === 'welcome_message' && b.type === 'welcome_message' ? aOrder - bOrder : 0;
    })
    .slice(0, 4);
  return (
    <section className="fo-home-panel">
      <header>
        <h2>Messages {messages.length ? <em>{messages.length}</em> : null}</h2>
        <Link href="/front-office/messages">
          View all <ArrowRight />
        </Link>
      </header>
      <div className="fo-home-list">
        {messages.length ? (
          messages.map((event) => (
            <article key={event.id}>
              {typeof event.metadata.headshotUrl === 'string' ? (
                <img
                  className="fo-home-avatar fo-home-avatar-image"
                  src={event.metadata.headshotUrl}
                  alt=""
                />
              ) : (
                <span className="fo-home-avatar">
                  {event.type === 'welcome_message'
                    ? String(event.metadata.senderName ?? event.headline).slice(0, 1)
                    : event.type === 're_sign_ready'
                      ? 'A'
                      : 'FO'}
                </span>
              )}
              <div>
                <strong>{event.headline}</strong>
                {event.type === 'welcome_message' ? (
                  <small>{String(event.metadata.senderRole ?? '')}</small>
                ) : null}
                <p>{event.summary}</p>
              </div>
              {event.actionUrl ? (
                <Link href={event.actionUrl}>
                  Open <ArrowRight />
                </Link>
              ) : null}
            </article>
          ))
        ) : (
          <p className="fo-home-empty-copy">
            No new messages. Your inbox will update as the week develops.
          </p>
        )}
      </div>
    </section>
  );
}

function Wire({
  events,
  state,
  teamAbbr,
}: {
  events: FrontOfficeEvent[];
  state: FranchiseSimulationState;
  teamAbbr: string;
}) {
  const [tab, setTab] = useState<Tab>('team');
  const completed = state.games
    .filter((game) => game.played)
    .slice(-8)
    .reverse();
  const posts = events
    .filter((event) => tab === 'league' || event.teamAbbr === teamAbbr)
    .slice(0, 5);
  return (
    <section className="fo-home-wire fo-home-panel">
      <header>
        <div>
          <h2>The Wire</h2>
          <span>Latest from around the league.</span>
        </div>
        <Link href="/front-office/league/news">
          View all news <ArrowRight />
        </Link>
      </header>
      <div className="fo-home-tabs">
        <button className={tab === 'team' ? 'active' : ''} onClick={() => setTab('team')}>
          {teamByAbbr.get(teamAbbr)?.name ?? teamAbbr}
        </button>
        <button className={tab === 'league' ? 'active' : ''} onClick={() => setTab('league')}>
          League
        </button>
      </div>
      <div className="fo-home-wire-feed">
        {posts.map((event) => (
          <article key={event.id}>
            <span className="fo-home-avatar">D&amp;D</span>
            <div>
              <strong>{event.headline}</strong>
              <small>@DownDistance · Week {event.simulationWeek}</small>
              <p>{event.summary}</p>
              <span className="fo-home-engagement">
                <MessageCircle /> {12 + event.headline.length} <Repeat2 />{' '}
                {4 + (event.summary.length % 31)}
              </span>
            </div>
          </article>
        ))}
        {tab === 'league' &&
          completed.slice(0, Math.max(0, 5 - posts.length)).map((game) => (
            <article key={game.id}>
              <span className="fo-home-avatar">D&amp;D</span>
              <div>
                <strong>
                  {game.awayTeam} {game.awayScore} — {game.homeTeam} {game.homeScore}
                </strong>
                <small>@DDGameDay · Week {game.week}</small>
                <p>
                  {game.winner
                    ? `${game.winner} closes out the win as the league moves toward Week ${state.currentWeek + 1}.`
                    : 'The game ends level after overtime.'}
                </p>
              </div>
            </article>
          ))}
        {!posts.length && tab === 'team' ? (
          <p className="fo-home-empty-copy">
            Team updates will appear here after the next simulated week.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Standings({ state, teamAbbr }: { state: FranchiseSimulationState; teamAbbr: string }) {
  const team = state.teams[teamAbbr];
  const rows = Object.values(state.teams)
    .filter((entry) => entry.conference === team?.conference && entry.division === team?.division)
    .sort((a, b) => b.record.wins - b.record.losses - (a.record.wins - a.record.losses));
  const leader = rows[0]?.record.wins ?? 0;
  return (
    <section className="fo-home-panel">
      <header>
        <div>
          <h2>Standings</h2>
          <span>
            {team?.conference} {team?.division}
          </span>
        </div>
        <Link href="/front-office/league/standings">
          View full standings <ArrowRight />
        </Link>
      </header>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>GB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.abbr} className={row.abbr === teamAbbr ? 'active' : ''}>
              <td>{teamByAbbr.get(row.abbr)?.city ?? row.abbr}</td>
              <td>{row.record.wins}</td>
              <td>{row.record.losses}</td>
              <td>{row === rows[0] ? '–' : (leader - row.record.wins).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Results({ state, teamAbbr }: { state: FranchiseSimulationState; teamAbbr: string }) {
  const games = state.games
    .filter((game) => game.played)
    .sort(
      (a, b) =>
        b.week - a.week ||
        Number([b.homeTeam, b.awayTeam].includes(teamAbbr)) -
          Number([a.homeTeam, a.awayTeam].includes(teamAbbr)),
    )
    .slice(0, 5);
  return (
    <section className="fo-home-panel">
      <header>
        <h2>Recent results</h2>
        <span>Week {state.currentWeek || 1}</span>
      </header>
      <div className="fo-home-results">
        {games.length ? (
          games.map((game) => (
            <div key={game.id}>
              <i style={{ background: teamByAbbr.get(game.awayTeam)?.colors[0] }} />
              <span>{game.awayTeam}</span>
              <strong>{game.awayScore}</strong>
              <span>{game.homeTeam}</span>
              <strong>{game.homeScore}</strong>
              <small>Final</small>
            </div>
          ))
        ) : (
          <p className="fo-home-empty-copy">No games played yet. Week 1 is ready when you are.</p>
        )}
      </div>
      <Link className="fo-home-bottom-link" href="/league?view=stats">
        View full schedule <ArrowRight />
      </Link>
    </section>
  );
}

export function FrontOfficeHome({
  saveId,
  teamAbbr,
  roster,
}: {
  saveId: string;
  teamAbbr: string;
  roster: PlayerRowDTO[];
}) {
  const [state, setState] = useState<FranchiseSimulationState | null>(null);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const [matchupPlayers, setMatchupPlayers] = useState<DisplayPlayer[]>([]);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const displayRoster = useMemo<DisplayPlayer[]>(
    () =>
      roster.map((player) => ({
        id: player.id,
        name: `${player.firstName} ${player.lastName}`.trim(),
        teamAbbr: player.teamAbbr ?? teamAbbr,
        position: player.position,
        rating: player.rating ?? player.maddenRating ?? player.baselineRating ?? 0,
        headshotUrl: player.headshotUrl,
      })),
    [roster, teamAbbr],
  );
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (active) setLoadError('');
        const [sim, feed] = await Promise.all([
          apiFetch(`/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`),
          apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`),
        ]);
        const [simJson, feedJson] = await Promise.all([sim.json(), feed.json()]);
        if (!sim.ok || !simJson.state) {
          throw new Error(simJson.error ?? 'Unable to load the franchise simulation.');
        }
        if (!feed.ok) throw new Error(feedJson.error ?? 'Unable to load Front Office news.');
        if (active) {
          setState(simJson.state);
          setEvents(feedJson.events ?? []);
          setMatchupPlayers(simJson.matchupPlayers ?? []);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load Front Office.');
        }
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    return () => {
      active = false;
      window.removeEventListener('front-office-simulation-advanced', load);
    };
  }, [reloadKey, saveId]);
  const content = useMemo(
    () =>
      state ? (
        <>
          <div className="fo-home-top">
            <MatchupCard
              state={state}
              teamAbbr={teamAbbr}
              roster={displayRoster}
              matchupPlayers={matchupPlayers}
            />
            <Wire events={events} state={state} teamAbbr={teamAbbr} />
          </div>
          <div className="fo-home-bottom">
            <Messages events={events} />
            <Standings state={state} teamAbbr={teamAbbr} />
            <Results state={state} teamAbbr={teamAbbr} />
            <aside className="fo-home-ad" aria-label="Advertisement">
              <span>Ad</span>
              <Image
                src="/images/ads/fanduel_ad.png.jpg"
                alt="FanDuel advertisement"
                width={750}
                height={500}
                sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw"
              />
            </aside>
          </div>
        </>
      ) : loadError ? (
        <div className="fo-home-loading" role="alert">
          <strong>Front Office could not load.</strong>
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="fo-home-loading">Loading your front office…</div>
      ),
    [displayRoster, events, loadError, matchupPlayers, state, teamAbbr],
  );
  return <main className="fo-home">{content}</main>;
}
