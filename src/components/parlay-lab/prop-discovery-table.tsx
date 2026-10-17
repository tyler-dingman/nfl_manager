'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { HomeMarket, OddsEvent } from '../../../packages/parlay/research';
import type { PropGroup } from '../../../packages/parlay/prop-groups';
import { propPick } from '../../../packages/parlay/anytime-td';
import {
  propMarketLabel,
  PRIMARY_MARKETS,
  primaryMarketOptions,
  secondaryMarketOptions,
  type MarketFacet,
} from '../../../packages/parlay/market-navigation';
import { formatProjection } from '../../../packages/parlay/projection-display';
import { catalogScore } from '../../../packages/parlay/prop-catalog';
import { labScoreBand, labScoreColor } from '../../../packages/parlay/lab-score-config';
import { sportsbookName } from '@/server/odds/sportsbooks';
import PlayerAvatar from './PlayerAvatar';
import { LabScoreHelp } from './LabScoreHelp';
import ParlaySortHeader from './ParlaySortHeader';
import type { SortState } from './parlay-table';
export function PropMarketNavigation({
  facets,
  category,
  market,
  onCategory,
  onMarket,
}: {
  facets: MarketFacet[];
  category: string;
  market: string;
  onCategory: (value: string) => void;
  onMarket: (value: string) => void;
}) {
  const drilled = category !== 'ALL';
  const label = PRIMARY_MARKETS.find(([id]) => id === category)?.[1] ?? category;
  const options = drilled
    ? secondaryMarketOptions(facets, category)
    : primaryMarketOptions(facets).map(([id, label]) => ({ id, label }));
  const active = drilled ? market : 'ALL';
  const track = useRef<HTMLDivElement>(null);
  const focusAfterTransition = useRef(false);
  useEffect(() => {
    const selected = track.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const container = track.current;
    if (!selected || !container) return;
    if (focusAfterTransition.current) {
      selected.focus({ preventScroll: true });
      focusAfterTransition.current = false;
    }
    const item = selected.getBoundingClientRect(),
      box = container.getBoundingClientRect();
    if (item.left < box.left || item.right > box.right)
      container.scrollTo({
        left: container.scrollLeft + item.left - box.left - (box.width - item.width) / 2,
        behavior: 'auto',
      });
  }, [category, market, facets]);
  const changeCategory = (value: string, button: HTMLButtonElement) => {
    focusAfterTransition.current = document.activeElement === button;
    onCategory(value);
  };
  return (
    <nav className="lab-market-navigation" aria-label="Prop market navigation">
      {drilled && (
        <div className="lab-market-breadcrumb" aria-label="Market breadcrumb">
          <button
            type="button"
            onClick={(e) => changeCategory('ALL', e.currentTarget)}
            aria-label="Back to all prop categories"
          >
            All Props
          </button>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="location">{label}</span>
        </div>
      )}
      <div
        ref={track}
        className="lab-tabs lab-market-pills"
        role="group"
        aria-label={drilled ? `${label} markets` : 'Market categories'}
      >
        {options.map((option) => (
          <button
            type="button"
            key={`${category}:${option.id}`}
            aria-pressed={active === option.id}
            onClick={(e) =>
              drilled ? onMarket(option.id) : changeCategory(option.id, e.currentTarget)
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function PropDiscoveryTable({
  groups,
  events,
  slip,
  onOpen,
  onAdd,
  page,
  sort,
  onSort,
}: {
  groups: PropGroup[];
  events: Pick<OddsEvent, 'id' | 'homeTeamId' | 'awayTeamId'>[];
  slip: HomeMarket[];
  onOpen: (m: HomeMarket) => void;
  onAdd: (m: HomeMarket) => void;
  page: number;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <div className="lab-nested-table-wrap">
      <table className="lab-nested-table" aria-label="Player prop selections">
        <thead>
          <tr>
            {[
              ['#', 'rank'],
              ['Player / Team', 'player'],
              ['Prop', 'prop'],
              ['Game', 'game'],
              ['Line', 'line'],
              ['Odds', 'odds'],
              ['Lab Score', 'score'],
              ['Projection', 'projection'],
              ['L10', 'last10'],
            ].map(([label, key]) => (
              <ParlaySortHeader
                key={key}
                as="th"
                label={label}
                sortKey={key}
                sort={sort}
                onSort={onSort}
              />
            ))}
            <th>Add</th>
          </tr>
        </thead>
        {groups.map((group, index) => {
          const open = expanded.has(group.key),
            more = group.selections.length - 1;
          return (
            <tbody key={group.key} className="lab-prop-group" data-group={group.key}>
              {(open ? group.selections : [group.primary]).map((m, i) => {
                const game = events.find((e) => e.id === m.eventId),
                  score = catalogScore(m);
                const name = `${m.playerName ?? 'Player'} ${propMarketLabel(m)} ${propPick(m)} at ${sportsbookName(m.sportsbook)}`;
                return (
                  <tr
                    key={`${m.id}:${m.sportsbook}`}
                    className={i ? 'lab-nested-line' : 'lab-primary-line'}
                  >
                    <td className="lab-group-rank" data-label="#">
                      {i ? '↳' : (page - 1) * 12 + index + 1}
                    </td>
                    <td className="lab-group-player">
                      {i ? (
                        <span className="lab-nested-caption">
                          ↳ {m.lineType === 'alternate' ? 'Alternate' : 'Additional standard'} line
                        </span>
                      ) : (
                        <>
                          <button className="lab-player" onClick={() => onOpen(m)}>
                            <PlayerAvatar
                              name={m.playerName}
                              headshotUrl={m.headshotUrl}
                              size={32}
                              transparent
                            />
                            <span>
                              <b>{m.playerName}</b>
                              <small>
                                {m.teamId} · {m.position}
                              </small>
                            </span>
                          </button>
                          {more > 0 && (
                            <button
                              className="lab-expand-lines"
                              aria-expanded={open}
                              aria-label={`${open ? 'Collapse' : 'Expand'} ${m.playerName} ${propMarketLabel(m)} lines`}
                              onClick={() => toggle(group.key)}
                            >
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {more}{' '}
                              more {more === 1 ? 'line' : 'lines'}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    <td className="lab-group-market" data-label="Prop">
                      <button onClick={() => onOpen(m)}>
                        {propMarketLabel(m)}
                        {m.lineType === 'alternate' && (
                          <small className="lab-alt-indicator">
                            ALT LINE{i === 0 ? ' · BEST AVAILABLE' : ''}
                          </small>
                        )}
                      </button>
                    </td>
                    <td data-label="Game" className="lab-group-game">
                      {game ? `${game.awayTeamId} @ ${game.homeTeamId}` : '—'}
                    </td>
                    <td data-label="Line" className="lab-selection-line">
                      <button onClick={() => onOpen(m)} aria-label={`Research ${name}`}>
                        {propPick(m)}
                      </button>
                    </td>
                    <td data-label="Odds" className="lab-selection-odds">
                      <b>{m.odds == null ? '—' : `${m.odds > 0 ? '+' : ''}${m.odds}`}</b>
                      <small>{sportsbookName(m.sportsbook)}</small>
                    </td>
                    <td data-label="Lab Score" className="lab-selection-score">
                      <strong
                        className="lab-score"
                        style={{
                          color: labScoreColor(score ?? undefined),
                          borderColor: labScoreColor(score ?? undefined),
                        }}
                      >
                        {score == null ? (
                          '—'
                        ) : (
                          <>
                            {Math.round(score)}
                            <small>{labScoreBand(score).label}</small>
                          </>
                        )}
                      </strong>
                      <span className="lab-mobile-score-help">
                        <LabScoreHelp />
                      </span>
                    </td>
                    <td data-label="Projection">{formatProjection(m)}</td>
                    <td data-label="L10">
                      {m.trend?.last10.games
                        ? `${m.trend.last10.hits}/${m.trend.last10.games}`
                        : '—'}
                    </td>
                    <td className="lab-group-add">
                      <button
                        className="lab-add"
                        aria-label={`Add ${name} to parlay`}
                        disabled={slip.some((s) => s.id === m.id && s.sportsbook === m.sportsbook)}
                        onClick={() => onAdd(m)}
                      >
                        <Plus size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
