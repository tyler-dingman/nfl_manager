'use client';
import { isAnytimeTD, propPick, researchThreshold } from '../../../packages/parlay/anytime-td';
import { frontOfficeFont } from '@/components/front-office/front-office-font';
import { OverviewRail } from './OverviewRail';
import overviewStyles from './overview-dashboard.module.css';
import { overviewContext } from '../../../packages/parlay/projection-details';
import {
  Lightbulb,
  UserRound,
  Shield,
  Activity,
  BarChart3,
  ArrowUpRight,
  Check,
  ChevronRight,
  Plus,
  Star,
  X,
} from 'lucide-react';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

import { TEAM_LIST } from '@/data/teams';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { sportsbookName } from '@/server/odds/sportsbooks';
import PlayerAvatar from './PlayerAvatar';
import type { HomeMarket, ResearchDetail } from './ParlayLabHome';
import styles from './research-workspace.module.css';
import { LineBadge } from './TrendEducation';
import { labScoreTier } from './trending-context';
import { ProjectionDetails } from './ProjectionDetails';

const tabs = ['Overview', 'Game Log', 'Matchup', 'Splits', 'Line Ladder'] as const;
type Window = 'L5' | 'L10' | 'SEASON' | '2 YEARS';
const number = (v: number | null | undefined, signed = false) =>
  v == null || !Number.isFinite(v) ? '—' : `${signed && v > 0 ? '+' : ''}${Number(v.toFixed(1))}`;
const odds = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}`);
export default function ResearchWorkspace({
  market,
  data,
  error,
  onClose,
  onAdd,
  added,
  chartWindow,
  setChartWindow,
  renderDetails,
}: {
  market: HomeMarket;
  data: ResearchDetail | null;
  error: string;
  onClose: () => void;
  onAdd: () => void;
  added: boolean;
  chartWindow: Window;
  setChartWindow: (value: Window) => void;
  renderDetails: (tab: string) => ReactNode;
}) {
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(true, dialog, onClose);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Overview');
  const [imageFailed, setImageFailed] = useState(false);
  const favoriteKey = `dd-research-favorite:${market.playerId ?? market.playerName}`;
  const [favorite, setFavorite] = useState(() => {
    try {
      return localStorage.getItem(favoriteKey) === 'true';
    } catch {
      return false;
    }
  });
  const team = TEAM_LIST.find((t) => t.abbr === (market.teamId ?? data?.player?.teamId));
  const name = market.playerName ?? data?.player?.name ?? team?.name ?? 'Team prop';
  const names = name.split(' '),
    last = names.pop(),
    first = names.join(' ');
  const stat = marketDisplayName(data?.market.statType ?? market.marketType);
  const sample = data?.summary.last10;
  const average = data?.summary.recentAverage10;
  const years = [...new Set(data?.gameByGame.map((g) => g.season) ?? [])].sort((a, b) => b - a);
  const points = (data?.gameByGame ?? []).filter((p) =>
    chartWindow === 'SEASON'
      ? p.season === years[0]
      : chartWindow !== '2 YEARS' || p.season >= years[0] - 1,
  );
  const shown =
    chartWindow === 'L5' ? points.slice(-5) : chartWindow === 'L10' ? points.slice(-10) : points;
  const chartTitle =
    chartWindow === 'L5'
      ? 'Last 5 Games'
      : chartWindow === 'L10'
        ? 'Last 10 Games'
        : chartWindow === 'SEASON'
          ? `${years[0] ?? ''} Season`
          : 'Last 2 Years';
  const controls = (
    <div className={styles.windows} aria-label="Historical sample">
      {(['L5', 'L10', 'SEASON', '2 YEARS'] as const).map((w) => (
        <button key={w} aria-pressed={chartWindow === w} onClick={() => setChartWindow(w)}>
          {w === 'SEASON' ? 'Season' : w === '2 YEARS' ? '2 Years' : w}
        </button>
      ))}
    </div>
  );
  const prices = data?.currentPrices ?? [];
  const changeTab = (next: (typeof tabs)[number]) => {
    setTab(next);
    dialog.current?.querySelector('[data-research-body]')?.scrollTo({ top: 0 });
  };
  const hitCount = shown.filter((p) => p.result === 'HIT').length;
  const chartAverage = shown.length ? shown.reduce((s, p) => s + p.value, 0) / shown.length : null;
  return createPortal(
    <div
      className={`${styles.backdrop} ${frontOfficeFont.variable}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        data-parlay-research
        className={styles.dialog}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-player-name"
        style={{ '--research-accent': team?.colors[0] ?? '#f44c16' } as CSSProperties}
      >
        <header className={styles.hero}>
          <button className={styles.close} onClick={onClose} aria-label="Close player research">
            <X />
          </button>
          <div className={styles.portrait} aria-hidden="true">
            <span>{data?.player?.position ?? ''}</span>
            {/* Existing public team and player image pipeline. */}
            {team && (
              <Image
                unoptimized
                width={220}
                height={220}
                className={styles.teamMark}
                src={team.logoUrl}
                alt=""
              />
            )}
            {market.headshotUrl && !imageFailed ? (
              <Image
                unoptimized
                width={360}
                height={260}
                className={styles.headshot}
                src={market.headshotUrl}
                alt=""
                onError={() => setImageFailed(true)}
              />
            ) : (
              <PlayerAvatar name={name} teamColor={team?.colors[0]} size={140} />
            )}
          </div>
          <div className={styles.identity}>
            <h2 id="research-player-name">
              <small>{first}</small>
              {last}
              <button
                aria-label={favorite ? 'Unfavorite player' : 'Favorite player'}
                aria-pressed={favorite}
                onClick={() => {
                  setFavorite(!favorite);
                  try {
                    localStorage.setItem(favoriteKey, String(!favorite));
                  } catch {}
                }}
              >
                <Star fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </h2>
            <p>{[data?.player?.position, team?.name].filter(Boolean).join('  |  ')}</p>
            <p className={styles.prop}>
              {stat}{' '}
              <span>
                ·{' '}
                {isAnytimeTD(market)
                  ? `Anytime TD — ${propPick(market)}`
                  : `${market.side} ${market.line ?? '—'}`}
              </span>
            </p>
            <LineBadge passive lineType={market.lineType} mainLine={market.mainLine} />
            <div className={styles.prices}>
              {(['FANDUEL', 'DRAFTKINGS'] as const).map((book) => (
                <span key={book}>
                  {sportsbookName(book)}{' '}
                  <b>
                    {odds(
                      book === market.sportsbook
                        ? market.odds
                        : prices.find(
                            (p) =>
                              p.sportsbook === book &&
                              p.line === market.line &&
                              p.side === market.side,
                          )?.odds,
                    )}
                  </b>
                </span>
              ))}
              {!['FANDUEL', 'DRAFTKINGS'].includes(market.sportsbook) && (
                <span>
                  {sportsbookName(market.sportsbook)} <b>{odds(market.odds)}</b>
                </span>
              )}
            </div>
          </div>
          <div className={styles.decision}>
            <div className={styles.kpis}>
              <Kpi
                label="L10"
                value={sample?.games ? `${sample.hits}/${sample.games}` : '—'}
                detail={sample?.hitRate == null ? 'No history' : `${number(sample.hitRate)}%`}
                positive
              />
              <Kpi label="AVG" value={number(average)} detail={`${stat} / game`} />
              <Kpi
                label="MARGIN"
                value={number(data?.lineMargin.averageMargin, true)}
                detail="vs line · L10"
              />
              <Kpi
                label="LAB SCORE"
                value={data?.summary.last10.games ? number(data.summary.trendScore) : '—'}
                detail={
                  data?.summary.last10.games
                    ? labScoreTier(data.summary.trendScore, data.summary.scoreVersion).label
                    : 'No history'
                }
                positive
              />
            </div>
            <button className={styles.add} onClick={onAdd} disabled={added || !market.available}>
              {added ? <Check /> : <Plus />}
              {added ? 'Added to parlay' : 'Add to parlay'}
            </button>
            <span className={styles.selection}>
              {sportsbookName(market.sportsbook)} · {odds(market.odds)}
            </span>
          </div>
        </header>
        <div className={styles.navigation}>
          <div className={styles.tabs} role="tablist" aria-label="Player research">
            {tabs.map((t, i) => (
              <button
                key={t}
                id={`research-tab-${i}`}
                role="tab"
                aria-selected={tab === t}
                aria-controls="research-tab-panel"
                tabIndex={tab === t ? 0 : -1}
                onClick={() => changeTab(t)}
                onKeyDown={(e) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault();
                    const next =
                      e.key === 'Home'
                        ? 0
                        : e.key === 'End'
                          ? tabs.length - 1
                          : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                    changeTab(tabs[next]);
                    document.getElementById(`research-tab-${next}`)?.focus();
                  }
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <select
            aria-label="Chart season context"
            value={chartWindow === 'SEASON' ? 'season' : 'recent'}
            onChange={(e) => setChartWindow(e.target.value === 'season' ? 'SEASON' : 'L10')}
          >
            <option value="recent">Recent games</option>
            {years[0] && <option value="season">{years[0]} Season</option>}
          </select>
        </div>
        <div
          data-research-body
          className={styles.body}
          id="research-tab-panel"
          role="tabpanel"
          aria-labelledby={`research-tab-${tabs.indexOf(tab)}`}
          tabIndex={0}
        >
          {!data ? (
            <p className={styles.loading} role={error ? 'alert' : 'status'}>
              {error || 'Loading player research…'}
            </p>
          ) : tab === 'Overview' ? (
            <>
              <div className={overviewStyles.layout}>
                <div className={overviewStyles.dashboard}>
                  <ProjectionDetails
                    projection={data.summary.projection}
                    active={data.summary.scoreVersion === 'v2'}
                    stat={stat}
                    position={market.position ?? data.player?.position}
                  >
                    <div className={overviewStyles.tiles} data-overview-order="tiles">
                      {overviewContext(data, market).tiles.map((tile, i) => {
                        const Icon = [BarChart3, Shield, UserRound, ArrowUpRight][i]!;
                        return (
                          <button
                            key={tile.label}
                            onClick={() => changeTab(tile.target as typeof tab)}
                          >
                            <Icon />
                            <div>
                              <small>{tile.label}</small>
                              <strong>{tile.value}</strong>
                              <span>{tile.note}</span>
                            </div>
                            <ChevronRight />
                          </button>
                        );
                      })}
                    </div>
                  </ProjectionDetails>
                </div>
                <OverviewRail data={data} market={market} onTab={changeTab} />
                <div className={overviewStyles.lower} data-overview-order="chart">
                  <section className={styles.chartCard}>
                    <header>
                      <h3>{chartTitle}</h3>
                      {controls}
                    </header>
                    <CompactChart points={shown} line={researchThreshold(market)} label={stat} />
                  </section>
                  <div className={styles.insight}>
                    <Lightbulb />
                    <div>
                      <b>Lab Insight</b>
                      <p>
                        {shown.length
                          ? `${name} hit ${market.side.toLowerCase()} ${market.line} ${stat.toLowerCase()} in ${hitCount} of ${shown.length} games in this sample, averaging ${number(chartAverage)} per game.`
                          : 'Not enough qualifying history for this prop.'}{' '}
                        {data.generatedInsight}{' '}
                        {data.summary.researchScore?.lineContext.explanation}
                        {market.lineType === 'alternate' && (
                          <>
                            {' '}
                            Selected-line hit rates describe this alternate threshold.{' '}
                            {data.summary.researchScore?.lineContext.scoreBasis}. Odds do not
                            establish betting value.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <footer className={styles.statStrip}>
                {(
                  data.seasonStats?.items ?? [
                    { label: stat + ' / game', value: number(data.summary.average) },
                    { label: 'Median', value: number(data.summary.median) },
                    {
                      label: 'Vs opponent',
                      value: `${data.summary.vsOpponent.hits}/${data.summary.vsOpponent.games}`,
                    },
                    {
                      label: 'Home',
                      value: `${data.summary.home.hits}/${data.summary.home.games}`,
                    },
                    {
                      label: 'Away',
                      value: `${data.summary.away.hits}/${data.summary.away.games}`,
                    },
                  ]
                ).map((s) => (
                  <div key={s.label}>
                    <Activity />
                    <span>
                      <small>
                        {data.seasonStats?.season ? `${data.seasonStats.season} · ` : ''}
                        {s.label}
                      </small>
                      <b>{s.value}</b>
                    </span>
                  </div>
                ))}
              </footer>
              <p className={styles.disclaimer}>
                Lab Score ranks research signals; it is not a win probability. Prices are stored and
                may have changed.
              </p>
            </>
          ) : (
            <div className={styles.details}>{renderDetails(tab)}</div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
function Kpi({
  label,
  value,
  detail,
  positive = false,
}: {
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
      <span className={positive ? styles.positive : undefined}>{detail}</span>
    </div>
  );
}
function CompactChart({
  points,
  line,
  label,
}: {
  points: ResearchDetail['gameByGame'];
  line: number | null;
  label: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 760, height: 235 });
  const hasPoints = points.length > 0;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [hasPoints]);
  if (!points.length) return <p className={styles.loading}>Not enough qualifying game history.</p>;
  const ceiling = Math.max(1, ...points.map((p) => p.value), line ?? 0) * 1.18;
  const baseline = size.height - 38;
  const plotRight = size.width - 52;
  const y = (value: number) => baseline - (value / ceiling) * (baseline - 25),
    step = (plotRight - 36) / points.length;
  return (
    <div ref={frameRef} className={styles.chartFrame}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`${label} by game; selected line ${line}. Bars include hit or miss labels and keyboard-accessible game details.`}
      >
        {[0, 1, 2, 3, 4].map((t) => (
          <g key={t}>
            <line
              x1="36"
              x2={plotRight}
              y1={y((ceiling * t) / 4)}
              y2={y((ceiling * t) / 4)}
              stroke="var(--lab-border)"
            />
            <text x="28" y={y((ceiling * t) / 4) + 4} textAnchor="end">
              {Math.round((ceiling * t) / 4)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g
            key={p.gameId}
            tabIndex={0}
            role="img"
            aria-label={`${p.date}, ${p.opponent}: ${p.value} ${label}, line ${p.line}, ${p.result}`}
          >
            <title>{`${p.date} · ${p.opponent} · ${p.value} ${label} · Line ${p.line} · ${p.result}`}</title>
            <rect
              x={36 + i * step + step * 0.15}
              y={y(p.value)}
              width={step * 0.7}
              height={Math.max(1, baseline - y(p.value))}
              rx="3"
              fill={p.result === 'HIT' ? 'var(--lab-green)' : 'var(--lab-muted)'}
            />
            {points.length <= 18 && (
              <text
                className={styles.barValue}
                x={36 + (i + 0.5) * step}
                y={y(p.value) - 7}
                textAnchor="middle"
              >
                {p.value}
              </text>
            )}
            <text x={36 + (i + 0.5) * step} y={baseline + 18} textAnchor="middle">
              {points.length <= 18 ? p.opponent : i % 4 === 0 ? p.opponent : ''}
            </text>
            <text x={36 + (i + 0.5) * step} y={baseline + 34} textAnchor="middle">
              {points.length <= 18
                ? p.result === 'HIT'
                  ? '✓'
                  : p.result === 'PUSH'
                    ? '='
                    : '×'
                : ''}
            </text>
          </g>
        ))}
        {line !== null && (
          <g>
            <line
              x1="36"
              x2={plotRight}
              y1={y(line)}
              y2={y(line)}
              stroke="#ff510a"
              strokeDasharray="7 4"
              strokeWidth="2"
            />
            <text x={plotRight + 7} y={y(line) - 3} fill="#ef4c0b">
              Line
            </text>
            <text x={plotRight + 7} y={y(line) + 13} fill="#ef4c0b">
              {line}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
