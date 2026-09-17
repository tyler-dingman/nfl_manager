'use client';

import * as React from 'react';
import Image from 'next/image';
import { DdSearchIcon as Search } from '@/components/ui/football-icons';

import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftRun } from '@/lib/draft-intelligence';
import { buildProspectDetailsModel } from '@/lib/draft-prospect-details';
import styles from '@/app/draft/room/mock-draft-room.module.css';

type Props = {
  entries: DraftBoardEntry[];
  teamNeeds: string[];
  activeRuns?: DraftRun[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  boardOrder?: boolean;
};

export function DraftSimulatorProspectTable({
  entries,
  teamNeeds,
  activeRuns = [],
  selectedPlayerId,
  onSelectPlayer,
  boardOrder = false,
}: Props) {
  const [query, setQuery] = React.useState('');
  const [position, setPosition] = React.useState('All');
  const [school, setSchool] = React.useState('All');
  const [sort, setSort] = React.useState<'rank' | 'grade' | 'name'>('rank');

  const positions = React.useMemo(
    () => ['All', ...Array.from(new Set(entries.map((entry) => entry.player.position))).sort()],
    [entries],
  );
  const schools = React.useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          entries
            .map((entry) => entry.player.college ?? entry.player.school)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    ],
    [entries],
  );

  const rows = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        const playerSchool = entry.player.college ?? entry.player.school ?? '';
        const name = `${entry.player.firstName} ${entry.player.lastName}`.toLowerCase();
        return (
          (!normalizedQuery || name.includes(normalizedQuery)) &&
          (position === 'All' || entry.player.position === position) &&
          (school === 'All' || playerSchool === school)
        );
      })
      .slice()
      .sort((left, right) => {
        if (boardOrder && sort === 'rank') return 0;
        if (sort === 'name') {
          return `${left.player.lastName}${left.player.firstName}`.localeCompare(
            `${right.player.lastName}${right.player.firstName}`,
          );
        }
        if (sort === 'grade') {
          return (
            (right.player.rating ?? right.player.maddenRating ?? 0) -
            (left.player.rating ?? left.player.maddenRating ?? 0)
          );
        }
        return (left.player.rank ?? 999) - (right.player.rank ?? 999);
      });
  }, [boardOrder, entries, position, query, school, sort]);

  return (
    <div>
      <div className={styles.prospectFilters}>
        <label>
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players..."
          />
        </label>
        <select value={position} onChange={(event) => setPosition(event.target.value)}>
          {positions.map((value) => (
            <option key={value} value={value}>
              {value === 'All' ? 'All Positions' : value}
            </option>
          ))}
        </select>
        <select value={school} onChange={(event) => setSchool(event.target.value)}>
          {schools.map((value) => (
            <option key={value} value={value}>
              {value === 'All' ? 'All Schools' : value}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="rank">Consensus Rank</option>
          <option value="grade">D&amp;D Grade</option>
          <option value="name">Player Name</option>
        </select>
      </div>

      <div className={styles.prospectTableHeader}>
        <span>Rank</span>
        <span>Player</span>
        <span>Pos</span>
        <span>School</span>
        <span>Height / Weight</span>
        <span>D&amp;D Grade</span>
      </div>
      <div className={styles.prospectRows}>
        {rows.map((entry, index) => {
          const player = entry.player;
          const details = buildProspectDetailsModel({
            player,
            boardEntry: entry,
            teamNeeds,
            activeRuns,
          });
          const selected = player.id === selectedPlayerId;
          return (
            <button
              type="button"
              key={player.id}
              className={selected ? styles.selectedProspectRow : styles.prospectRow}
              onClick={() => onSelectPlayer(player.id)}
            >
              <span>{player.rank ?? index + 1}</span>
              <span className={styles.prospectIdentity}>
                {player.headshotUrl ? (
                  <Image src={player.headshotUrl} alt="" width={34} height={34} unoptimized />
                ) : (
                  <i>
                    {player.firstName[0]}
                    {player.lastName[0]}
                  </i>
                )}
                <strong>
                  {player.firstName} {player.lastName}
                </strong>
              </span>
              <span>{player.position}</span>
              <span>{details.school}</span>
              <span>
                {details.height ?? '—'}
                {details.weight ? <small>{details.weight} lbs</small> : null}
              </span>
              <strong className={styles.tableGrade}>{details.ratingDisplay}</strong>
            </button>
          );
        })}
        {rows.length === 0 ? (
          <p className={styles.noProspects}>No prospects match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
