'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import PlayerTypeIcon from '@/components/player-type-icon';
import { Badge } from '@/components/ui/badge';
import { buildPlayerScoutingTags } from '@/lib/player-details';
import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import {
  PlayerFilterToolbar,
  matchesPositionFilter,
  SortableHeader,
} from '@/components/player-table';
import PlayerDetailsModal from '@/components/player-details-modal';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { useRosterQuery } from '@/features/players/queries';
import {
  DEVELOPMENT_COLUMNS,
  compareDevelopmentPlayers,
  ratingChange,
  type DevelopmentSortColumn,
} from '@/lib/player-development-sort';
import type { PlayerRowDTO } from '@/types/player';

function DevelopmentPortrait({ player }: { player: PlayerRowDTO }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="fo-development-portrait">
      {player.headshotUrl && !failed ? (
        <Image
          src={player.headshotUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        `${player.firstName?.[0] ?? ''}${player.lastName?.[0] ?? ''}`
      )}
    </span>
  );
}

export default function PlayerDevelopmentPage() {
  const save = useSaveStore();
  const teams = useTeamStore((state) => state.teams);
  const { data, isLoading } = useRosterQuery(save.saveId, save.teamAbbr);
  const roster = data.length ? data : save.roster;
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('All');
  const [filter, setFilter] = useState('all');
  const [sorting, setSorting] = useState<{
    column: DevelopmentSortColumn;
    direction: 'asc' | 'desc';
  }>({ column: 'Change', direction: 'desc' });
  const scoutingTags = useMemo(
    () =>
      new Map(
        roster.map((player) => [
          player.id,
          buildPlayerScoutingTags({ source: { kind: 'roster', player }, roster }).slice(0, 1),
        ]),
      ),
    [roster],
  );
  const [selected, setSelected] = useState<PlayerRowDTO | null>(null);
  const players = useMemo(
    () =>
      roster
        .filter((player) => {
          const change = ratingChange(player);
          return (
            player.status?.toLowerCase() !== 'cut' &&
            matchesPositionFilter(player.position, position) &&
            `${player.firstName} ${player.lastName} ${player.position}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === 'all' ||
              (filter === 'up' && change !== null && change > 0) ||
              (filter === 'down' && change !== null && change < 0) ||
              (filter === 'young' && typeof player.age === 'number' && player.age <= 25))
          );
        })
        .sort((a, b) => compareDevelopmentPlayers(a, b, sorting.column, sorting.direction)),
    [roster, query, filter, position, sorting],
  );
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Player Development"
        title="Player Development"
        description="Review your players’ current ratings, baseline changes, and the young talent on your roster."
      />
      <section className="fo-development-panel">
        <div className="fo-development-toolbar">
          <div role="group" aria-label="Development filters">
            {[
              ['all', 'All Players'],
              ['up', 'Trending Up'],
              ['down', 'Trending Down'],
              ['young', 'Age 25 & Under'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-[14px] pb-3">
          <PlayerFilterToolbar
            active={position}
            onSelect={setPosition}
            query={query}
            onQueryChange={setQuery}
            onReset={() => {
              setPosition('All');
              setQuery('');
              setFilter('all');
            }}
          />
        </div>
        <p className="fo-development-note">
          Changes compare current ratings with each player’s stored baseline. A dash means no
          baseline is available.
        </p>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Player development table, scroll for more columns"
        >
          <table className="fo-development-table">
            <thead>
              <tr>
                {DEVELOPMENT_COLUMNS.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    aria-sort={
                      sorting.column === label
                        ? sorting.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <SortableHeader
                      label={label}
                      column={{
                        getIsSorted: () => (sorting.column === label ? sorting.direction : false),
                        toggleSorting: (desc) =>
                          setSorting({ column: label, direction: desc ? 'desc' : 'asc' }),
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const change = ratingChange(player);
                return (
                  <tr key={player.id} onClick={() => setSelected(player)}>
                    <td>
                      <button
                        type="button"
                        className="fo-development-player"
                        onClick={() => setSelected(player)}
                      >
                        <DevelopmentPortrait
                          key={player.headshotUrl ?? player.id}
                          player={player}
                        />
                        <span className="fo-development-identity">
                          <span className="fo-development-name">
                            {player.firstName} {player.lastName}
                            <PlayerTypeIcon player={player} />
                          </span>
                          {(scoutingTags.get(player.id) ?? []).map((tag) => (
                            <Badge key={tag} variant="outline" className="fo-development-tag">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      </button>
                    </td>
                    <td>{player.position}</td>
                    <td>{player.age ?? '—'}</td>
                    <td>{player.rating ?? '—'}</td>
                    <td>{player.baselineRating ?? '—'}</td>
                    <td
                      className={
                        change !== null && change > 0
                          ? 'text-emerald-600'
                          : change !== null && change < 0
                            ? 'text-red-600'
                            : ''
                      }
                    >
                      {change === null ? '—' : change > 0 ? `+${change}` : change}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!players.length && (
          <p className="fo-development-empty" role="status">
            {isLoading ? 'Loading player development…' : 'No players match these filters.'}
          </p>
        )}
      </section>
      <PlayerDetailsModal
        isOpen={Boolean(selected)}
        source={selected ? { kind: 'roster', player: selected } : null}
        sources={players.map((player) => ({ kind: 'roster', player }))}
        roster={roster}
        teams={teams}
        userTeamAbbr={save.teamAbbr}
        capSpace={save.capSpace}
        capLimit={save.capLimit}
        onClose={() => setSelected(null)}
        onSelectSource={(source) => {
          if (source.kind !== 'expiring') setSelected(source.player);
        }}
      />
    </AppShell>
  );
}
