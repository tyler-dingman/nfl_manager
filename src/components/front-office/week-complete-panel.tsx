'use client';

import Image from 'next/image';
import { ArrowRight, ChevronUp, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTeamStore } from '@/features/team/team-store';
import { apiFetch } from '@/lib/api';
import type {
  FranchiseGameState,
  FranchiseSimulationState,
  FrontOfficeEvent,
  GameSimulationResult,
  SimulatedPlayerStat,
} from '@/types/front-office';

type WeekState = {
  simulation: FranchiseSimulationState;
  events: FrontOfficeEvent[];
};

const recordLabel = (state: FranchiseSimulationState, teamAbbr: string) => {
  const record = state.teams[teamAbbr]?.record;
  return record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : '0-0';
};

const recapKey = (state: FranchiseSimulationState, teamAbbr: string) =>
  state.games.find(
    (game) => game.week === state.currentWeek && [game.homeTeam, game.awayTeam].includes(teamAbbr),
  )?.id ?? `bye:${state.currentWeek}:${teamAbbr}`;

const playerLine = (stat: SimulatedPlayerStat) => {
  const values: string[] = [];
  if (stat.passingYards !== undefined) values.push(`${stat.passingYards} PASS YDS`);
  if (stat.passingTD) values.push(`${stat.passingTD} TD`);
  if (stat.interceptions) values.push(`${stat.interceptions} INT`);
  if (stat.rushingYards !== undefined) values.push(`${stat.rushingYards} RUSH YDS`);
  if (stat.receivingYards !== undefined)
    values.push(`${stat.receptions ?? 0} REC`, `${stat.receivingYards} YDS`);
  if (stat.receivingTD) values.push(`${stat.receivingTD} TD`);
  if (stat.sacks) values.push(`${stat.sacks} SACK${stat.sacks === 1 ? '' : 'S'}`);
  if (stat.tackles) values.push(`${stat.tackles} TKL`);
  if (stat.defensiveInterceptions) values.push(`${stat.defensiveInterceptions} INT`);
  if (stat.forcedFumbles) values.push(`${stat.forcedFumbles} FF`);
  return values.slice(0, 4).join('  ·  ');
};

function TeamMark({ abbr }: { abbr: string }) {
  const team = useTeamStore((state) => state.teams.find((entry) => entry.abbr === abbr));
  return team?.logo_url ? (
    <Image src={team.logo_url} alt={`${team.name} logo`} width={58} height={58} />
  ) : (
    <strong>{abbr}</strong>
  );
}

function ResultScore({ result }: { result: GameSimulationResult }) {
  return (
    <div
      className="fo-week-score"
      aria-label={`${result.awayTeam} ${result.awayScore}, ${result.homeTeam} ${result.homeScore}, final`}
    >
      <span>
        <TeamMark abbr={result.awayTeam} />
        <b>{result.awayScore}</b>
      </span>
      <em>Final{result.overtime ? ' / OT' : ''}</em>
      <span>
        <b>{result.homeScore}</b>
        <TeamMark abbr={result.homeTeam} />
      </span>
    </div>
  );
}

function FullRecap({
  result,
  teamAbbr,
  onClose,
}: {
  result: GameSimulationResult;
  teamAbbr: string;
  onClose: () => void;
}) {
  const teamStats = result.teamStats[teamAbbr];
  const opponent = result.homeTeam === teamAbbr ? result.awayTeam : result.homeTeam;
  const opponentStats = result.teamStats[opponent];
  return (
    <div
      className="fo-recap-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="fo-recap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fo-recap-title"
      >
        <button type="button" onClick={onClose} aria-label="Close full recap">
          <X />
        </button>
        <span>Week {result.week} · Final</span>
        <h2 id="fo-recap-title">{result.recapHeadline[teamAbbr]}</h2>
        <ResultScore result={result} />
        <p>{result.recapSummary[teamAbbr]}</p>
        <div className="fo-recap-team-stats">
          <h3>Team stats</h3>
          {(['passingYards', 'rushingYards', 'sacks', 'turnovers'] as const).map((key) => (
            <div key={key}>
              <b>{teamStats[key]}</b>
              <span>{key.replace(/([A-Z])/g, ' $1')}</span>
              <b>{opponentStats[key]}</b>
            </div>
          ))}
        </div>
        <h3>Player stats</h3>
        <div className="fo-recap-player-list">
          {result.playerStats
            .filter((stat) => stat.teamAbbr === teamAbbr)
            .sort((a, b) => b.performanceScore - a.performanceScore)
            .slice(0, 8)
            .map((stat) => (
              <div key={stat.playerId}>
                <strong>{stat.playerName}</strong>
                <span>{playerLine(stat)}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

export function WeekCompletePanel({
  saveId,
  teamAbbr,
  onExpandedChange,
}: {
  saveId: string;
  teamAbbr: string;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const [data, setData] = useState<WeekState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);

  const applyState = useCallback(
    (simulation: FranchiseSimulationState, events: FrontOfficeEvent[] = []) => {
      if (!simulation.currentWeek) {
        setData(null);
        onExpandedChange(false);
        return;
      }
      const currentGame = simulation.games.find(
        (game) =>
          game.week === simulation.currentWeek && [game.homeTeam, game.awayTeam].includes(teamAbbr),
      );
      if (currentGame && !currentGame.result) {
        setData(null);
        onExpandedChange(false);
        return;
      }
      const key = recapKey(simulation, teamAbbr);
      const isExpanded = !simulation.weekRecapAcknowledgements?.[key];
      setData({ simulation, events });
      setExpanded(isExpanded);
      onExpandedChange(isExpanded);
    },
    [onExpandedChange, teamAbbr],
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiFetch(`/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`, {
        signal: controller.signal,
      }),
      apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`, {
        signal: controller.signal,
      }),
    ])
      .then(async ([simulationResponse, eventsResponse]) => {
        if (!simulationResponse.ok) return onExpandedChange(false);
        const simulationPayload = (await simulationResponse.json()) as {
          state: FranchiseSimulationState | null;
        };
        const eventPayload = eventsResponse.ok
          ? ((await eventsResponse.json()) as { events: FrontOfficeEvent[] })
          : { events: [] };
        if (simulationPayload.state) applyState(simulationPayload.state, eventPayload.events);
        else onExpandedChange(false);
      })
      .catch(() => onExpandedChange(false));
    return () => controller.abort();
  }, [applyState, onExpandedChange, saveId]);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (
        event as CustomEvent<{ state: FranchiseSimulationState; events: FrontOfficeEvent[] }>
      ).detail;
      if (detail?.state) applyState(detail.state, detail.events);
    };
    window.addEventListener('front-office-week-complete', handle);
    return () => window.removeEventListener('front-office-week-complete', handle);
  }, [applyState]);

  const game = useMemo(
    () =>
      data?.simulation.games.find(
        (entry) =>
          entry.week === data.simulation.currentWeek &&
          [entry.homeTeam, entry.awayTeam].includes(teamAbbr),
      ) ?? null,
    [data, teamAbbr],
  );
  const result = game?.result ?? null;
  const weekEvents =
    data?.events.filter((event) => event.simulationWeek === data.simulation.currentWeek) ?? [];
  const performers = result
    ? (result.topPerformers[teamAbbr]
        .map((id) => result.playerStats.find((stat) => stat.playerId === id))
        .filter(Boolean) as SimulatedPlayerStat[])
    : [];

  const collapse = async () => {
    if (!data) return;
    setExpanded(false);
    onExpandedChange(false);
    const key = recapKey(data.simulation, teamAbbr);
    data.simulation.weekRecapAcknowledgements = {
      ...data.simulation.weekRecapAcknowledgements,
      [key]: new Date().toISOString(),
    };
    await apiFetch('/api/front-office/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, action: 'acknowledge', recapKey: key }),
    });
    window.dispatchEvent(new CustomEvent('front-office-week-recap-collapsed'));
  };

  if (!data || !data.simulation.currentWeek) return null;
  const record = recordLabel(data.simulation, teamAbbr);
  const status = !result
    ? 'BYE'
    : result.winner === null
      ? 'TIE'
      : result.winner === teamAbbr
        ? 'WIN'
        : 'LOSS';

  if (!expanded)
    return (
      <section className="fo-week-strip" aria-label={`Week ${data.simulation.currentWeek} result`}>
        <b>Week {data.simulation.currentWeek}</b>
        <span className={`status-${status.toLowerCase()}`}>{status}</span>
        {result ? (
          <span>
            {result.awayTeam} {result.awayScore} — {result.homeTeam} {result.homeScore}
          </span>
        ) : (
          <span>Bye week</span>
        )}
        <span>Record {record}</span>
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            onExpandedChange(true);
          }}
        >
          <ChevronUp /> View recap
        </button>
      </section>
    );

  return (
    <section
      className="fo-week-complete"
      aria-labelledby="fo-week-complete-title"
      aria-live="polite"
    >
      <button
        className="fo-week-collapse"
        type="button"
        onClick={() => void collapse()}
        aria-label="Collapse week result"
      >
        <X />
      </button>
      <div className="fo-week-result">
        <span>
          Week {data.simulation.currentWeek}{' '}
          {result ? `Final${result.overtime ? ' / OT' : ''}` : 'Complete'}
        </span>
        {result ? <ResultScore result={result} /> : <div className="fo-week-bye">Bye week</div>}
        <h2 id="fo-week-complete-title">
          {result ? result.recapHeadline[teamAbbr] : 'Your team did not play'}
        </h2>
        <p>
          {result
            ? result.recapSummary[teamAbbr]
            : 'The week is complete. No player statistics were generated.'}
        </p>
        <strong className="fo-week-record">Record: {record}</strong>
      </div>
      <div className="fo-week-performers">
        <h3>Key performers</h3>
        {performers.length ? (
          performers.map((stat) => (
            <article key={stat.playerId}>
              {stat.headshotUrl ? (
                <Image src={stat.headshotUrl} alt="" width={58} height={58} />
              ) : (
                <span aria-hidden="true">
                  {stat.playerName
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
              )}
              <div>
                <strong>{stat.playerName}</strong>
                <small>{playerLine(stat)}</small>
              </div>
            </article>
          ))
        ) : (
          <p>No player stats for a bye week.</p>
        )}
      </div>
      <div className="fo-week-updates">
        <h3>Front Office updates</h3>
        {weekEvents.length ? (
          weekEvents.slice(0, 3).map((event) => (
            <article key={event.id}>
              <strong>{event.headline}</strong>
              <small>{event.summary}</small>
            </article>
          ))
        ) : (
          <p>The League Wire was quiet this week.</p>
        )}
        {result ? (
          <button className="fo-week-recap-button" type="button" onClick={() => setRecapOpen(true)}>
            View full recap <ArrowRight />
          </button>
        ) : (
          <button className="fo-week-recap-button" type="button" onClick={() => void collapse()}>
            Continue <ArrowRight />
          </button>
        )}
      </div>
      {result && recapOpen ? (
        <FullRecap result={result} teamAbbr={teamAbbr} onClose={() => setRecapOpen(false)} />
      ) : null}
    </section>
  );
}
