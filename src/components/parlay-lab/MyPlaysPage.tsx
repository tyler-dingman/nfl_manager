'use client';
import { Trophy, FlaskConical, CircleX, ExternalLink, Plus, RefreshCw } from 'lucide-react';

import { DdShareIcon as Share2 } from '@/components/ui/football-icons';

import Link from 'next/link';

import {
  DdSaveIcon as Bookmark,
  DdDownloadIcon as Download,
  DdMessagesIcon as MessageCircle,
} from '@/components/ui/football-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { hypotheticalPortfolioResult, hypotheticalReturn } from './parlay-odds';
import ParlayLabSecondaryNav from './ParlayLabSecondaryNav';
import PlayerAvatar from './PlayerAvatar';
import {
  deriveSavedPlayStatus,
  normalizeLegacySavedPlay,
  normalizedSavedMarketType,
  type SavedLeg,
  type SavedLegStatus,
  type SavedPlay,
  type SavedPlayStatus,
} from './saved-plays';
import styles from './my-plays-page.module.css';

type Filter = 'ALL' | 'UPCOMING' | 'LIVE' | 'HIT' | 'MISSED';
type Sort = 'RECENT' | 'OLDEST' | 'ODDS';
type GradeResult = {
  id: string;
  status: SavedPlayStatus;
  gradedAt?: string;
  event?: SavedPlay['event'];
  legs: Array<{
    id: string;
    status: SavedLegStatus;
    actualResult?: number | null;
    gradedAt?: string;
  }>;
};
const price = (value?: number | null) => (value == null ? '—' : `${value > 0 ? '+' : ''}${value}`);
const statusLabel: Record<SavedPlayStatus, string> = {
  UPCOMING: 'Upcoming',
  LIVE: 'Live',
  HIT: 'Hit',
  MISSED: 'Missed',
  VOID: 'Void',
};
const legStatusLabel: Record<SavedLegStatus, string> = {
  UPCOMING: 'Upcoming',
  LIVE: 'Live',
  HIT: 'Hit',
  MISS: 'Miss',
  PUSH: 'Push',
  VOID: 'Void',
  UNABLE_TO_GRADE: 'Pending result',
};
const selectionText = (leg: SavedLeg) =>
  `${leg.side === 'OVER' ? 'Over' : leg.side === 'UNDER' ? 'Under' : leg.side} ${leg.line ?? ''} ${marketDisplayName(normalizedSavedMarketType(leg))}`.trim();
const booksLabel = (play: SavedPlay) => {
  const books = new Set(play.selections.map((leg) => leg.sportsbook).filter(Boolean));
  return books.size === 1 ? [...books][0] : 'Multiple Books';
};
const filterMatches = (play: SavedPlay, filter: Filter) =>
  filter === 'ALL' || play.status === filter;
const matchup = (play: SavedPlay) =>
  play.event ? `${play.event.awayTeamId} @ ${play.event.homeTeamId}` : 'NFL';

export default function MyPlaysPage() {
  const [plays, setPlays] = useState<SavedPlay[]>([]);
  const [current, setCurrent] = useState<SavedLeg[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('RECENT');
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const persist = useCallback((next: SavedPlay[]) => {
    setPlays(next);
    localStorage.setItem('down-distance-parlay-lab-slips', JSON.stringify(next));
  }, []);
  const refreshResults = useCallback(
    async (source: SavedPlay[]) => {
      if (!source.length) return;
      setRefreshing(true);
      try {
        const response = await fetch('/api/parlay-lab/my-plays/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plays: source }),
        });
        if (!response.ok) throw new Error('Results are temporarily unavailable.');
        const body = (await response.json()) as { results?: GradeResult[] };
        const byPlay = new Map((body.results ?? []).map((result) => [result.id, result]));
        const next = source.map((play) => {
          const result = byPlay.get(play.id);
          if (!result) return play;
          const used = new Set<number>();
          const selections = play.selections.map((leg) => {
            const index = result.legs.findIndex(
              (item, candidate) => item.id === leg.id && !used.has(candidate),
            );
            if (index < 0) return leg;
            used.add(index);
            return { ...leg, ...result.legs[index], gradingStatus: result.legs[index].status };
          });
          return {
            ...play,
            event: result.event ?? play.event,
            selections,
            status: deriveSavedPlayStatus(selections.map((leg) => leg.gradingStatus ?? 'UPCOMING')),
            gradedAt: result.gradedAt ?? play.gradedAt,
          };
        });
        persist(next);
        setMessage('Results are up to date.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Results are temporarily unavailable.');
      } finally {
        setRefreshing(false);
      }
    },
    [persist],
  );
  useEffect(() => {
    try {
      const rawSaved = JSON.parse(localStorage.getItem('down-distance-parlay-lab-slips') ?? '[]');
      const rawCurrent = JSON.parse(
        localStorage.getItem('down-distance-parlay-lab-current') ?? '[]',
      );
      const history = Array.isArray(rawSaved)
        ? (rawSaved as SavedPlay[]).map(normalizeLegacySavedPlay)
        : [];
      const currentSelections = Array.isArray(rawCurrent) ? (rawCurrent as SavedLeg[]) : [];
      setPlays(history);
      setCurrent(
        history.some(
          (play) => JSON.stringify(play.selections) === JSON.stringify(currentSelections),
        )
          ? []
          : currentSelections,
      );
      void refreshResults(history);
    } catch {
      setPlays([]);
    }
  }, [refreshResults]);
  const visible = useMemo(
    () =>
      plays
        .filter((play) => filterMatches(play, filter))
        .sort((a, b) => {
          if (sort === 'ODDS')
            return (b.savedCombinedOdds ?? -Infinity) - (a.savedCombinedOdds ?? -Infinity);
          const delta = new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
          return sort === 'OLDEST' ? -delta : delta;
        }),
    [filter, plays, sort],
  );
  const allTime = useMemo(
    () =>
      hypotheticalPortfolioResult(
        plays.map((play) => ({
          status: play.status,
          odds: play.savedCombinedOdds,
          hasVoidLeg: play.selections.some(
            (leg) => leg.gradingStatus === 'VOID' || leg.gradingStatus === 'PUSH',
          ),
        })),
      ),
    [plays],
  );
  const textFor = (play: SavedPlay) =>
    [
      `The Parlay Bus · ${play.selections.length} Picks · ${price(play.savedCombinedOdds)}`,
      matchup(play),
      '',
      ...play.selections.map(
        (leg, index) =>
          `${leg.gradingStatus === 'HIT' ? '✓ ' : leg.gradingStatus === 'MISS' ? '✕ ' : ''}${index + 1}. ${leg.playerName ?? leg.teamId ?? 'Game'} — ${selectionText(leg)}${leg.actualResult == null ? '' : ` — Final: ${leg.actualResult}`}`,
      ),
      '',
      statusLabel[play.status ?? 'UPCOMING'],
      'Built with the Down & Distance The Parlay Bus — https://downdistance.com/parlay-lab',
    ].join('\n');
  const share = async (play: SavedPlay) => {
    const text = textFor(play);
    if (navigator.share) await navigator.share({ title: 'Down & Distance The Parlay Bus', text });
    else {
      await navigator.clipboard.writeText(text);
      setMessage('Saved play copied.');
    }
  };
  return (
    <div className={styles.shell}>
      <MainSiteHeader active="parlay-lab" tone="merch" />
      <ParlayLabSecondaryNav />
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span>
              <Bookmark /> Saved research
            </span>
            <h1>My Plays</h1>
            <p>What you researched, what the Lab saw, and what happened.</p>
          </div>
          <button onClick={() => void refreshResults(plays)} disabled={refreshing}>
            <RefreshCw className={refreshing ? styles.spinning : ''} /> Refresh Results
          </button>
        </header>
        {message ? (
          <p className={styles.message} role="status">
            {message}
          </p>
        ) : null}
        {current.length ? (
          <section className={styles.current}>
            <div>
              <small>Current Parlay</small>
              <strong>{current.length} unsaved legs</strong>
            </div>
            <Link href="/parlay-lab/games">
              Continue researching <ExternalLink />
            </Link>
          </section>
        ) : null}
        {allTime.count ? (
          <section className={styles.allTime} aria-label="All-time hypothetical performance">
            <div>
              <small>All-Time $10 Test</small>
              <strong>
                If you had bet $10 on each graded parlay,{' '}
                {allTime.net > 0
                  ? `you would have won $${allTime.net.toFixed(2)}`
                  : allTime.net < 0
                    ? `you would be down $${Math.abs(allTime.net).toFixed(2)}`
                    : 'you would have broken even'}
                .
              </strong>
            </div>
            <p>
              {allTime.count} graded parlays · ${allTime.staked.toFixed(2)} hypothetical stake · $
              {allTime.totalReturn.toFixed(2)} total return
            </p>
          </section>
        ) : null}
        {plays.length ? (
          <>
            <div className={styles.toolbar}>
              <nav aria-label="Filter saved plays">
                {(['ALL', 'UPCOMING', 'LIVE', 'HIT', 'MISSED'] as Filter[]).map((item) => (
                  <button
                    key={item}
                    className={filter === item ? styles.active : ''}
                    onClick={() => setFilter(item)}
                  >
                    {item[0] + item.slice(1).toLowerCase()}
                  </button>
                ))}
              </nav>
              <label>
                Sort{' '}
                <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  <option value="RECENT">Most Recent</option>
                  <option value="OLDEST">Oldest</option>
                  <option value="ODDS">Best Odds</option>
                </select>
              </label>
            </div>
            {visible.length ? (
              <div className={styles.grid}>
                {visible.map((play) => (
                  <PlayCard
                    key={play.id}
                    play={play}
                    text={textFor(play)}
                    onShare={() => void share(play)}
                    onMessage={() => setMessage('Opening Messages…')}
                    onSaved={() => setMessage('Saved play image downloaded.')}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.noMatches}>No saved plays match this filter.</p>
            )}
          </>
        ) : (
          <section className={styles.empty}>
            <Plus />
            <h2>No saved plays yet</h2>
            <p>Build a research slip and choose Save to add it here.</p>
            <Link href="/parlay-lab/trends">Explore Parlay Lab</Link>
          </section>
        )}
      </main>
    </div>
  );
}

function PlayCard({
  play,
  text,
  onShare,
  onMessage,
  onSaved,
}: {
  play: SavedPlay;
  text: string;
  onShare: () => void;
  onMessage: () => void;
  onSaved: () => void;
}) {
  const status = play.status ?? 'UPCOMING';
  const hits = play.selections.filter((leg) => leg.gradingStatus === 'HIT').length;
  const voids = play.selections.filter(
    (leg) => leg.gradingStatus === 'VOID' || leg.gradingStatus === 'PUSH',
  ).length;
  const active = play.selections.length - voids;
  const returnValue = voids ? null : hypotheticalReturn(play.savedCombinedOdds, 10);
  const saveImage = async () => {
    await downloadPlayImage(play, returnValue);
    onSaved();
  };
  return (
    <article className={styles.card}>
      <header>
        <div className={styles.cardTitle}>
          <small>{play.createdAt ? new Date(play.createdAt).toLocaleString() : 'Saved play'}</small>
          <h2>{play.selections.length} Pick Parlay</h2>
          <span>{matchup(play)}</span>
        </div>
        <ResultPanel
          play={play}
          status={status}
          hits={hits}
          active={active}
          voids={voids}
          returnValue={returnValue}
        />
      </header>
      <div className={styles.summary}>
        <span>
          <small>Total Odds</small>
          <b>{price(play.savedCombinedOdds)}</b>
        </span>
        <span>
          <small>Legs</small>
          <b>{play.selections.length}</b>
        </span>
        <span>
          <small>Sportsbook</small>
          <b>{booksLabel(play)}</b>
        </span>
      </div>
      <ol>
        {play.selections.map((leg, index) => (
          <li key={`${leg.id}-${index}`}>
            <i>{index + 1}</i>
            <PlayerAvatar name={leg.playerName} headshotUrl={leg.headshotUrl} size={32} />
            <div className={styles.legCopy}>
              <strong>
                {leg.wasLabFindAtSave ? (
                  <span
                    className={styles.labFind}
                    title="This leg was a Lab Find when you saved this play"
                    aria-label="Lab Find"
                  >
                    <FlaskConical />
                  </span>
                ) : null}
                {leg.playerName ?? leg.teamId ?? 'Game'}
              </strong>
              <span>{selectionText(leg)}</span>
              <small>
                {matchup(play)} · {leg.sportsbook} · {price(leg.odds)}
              </small>
            </div>
            <div className={styles.result}>
              <b className={styles[(leg.gradingStatus ?? 'UPCOMING').toLowerCase()]}>
                {legStatusLabel[leg.gradingStatus ?? 'UPCOMING']}
              </b>
              {leg.actualResult != null ? <small>Final: {leg.actualResult}</small> : null}
            </div>
          </li>
        ))}
      </ol>
      <footer>
        <button onClick={() => void saveImage()}>
          <Download /> Save Image
        </button>
        <a href={`sms:?&body=${encodeURIComponent(text)}`} onClick={onMessage}>
          <MessageCircle /> Messages
        </a>
        <button onClick={onShare}>
          <Share2 /> Share
        </button>
      </footer>
    </article>
  );
}

function ResultPanel({
  play,
  status,
  hits,
  active,
  voids,
  returnValue,
}: {
  play: SavedPlay;
  status: SavedPlayStatus;
  hits: number;
  active: number;
  voids: number;
  returnValue: number | null;
}) {
  const settled = status === 'HIT' || status === 'MISSED' || status === 'VOID';
  const detail =
    status === 'HIT'
      ? `All ${active} active legs hit${voids ? ` · ${voids} void` : ''}!`
      : status === 'MISSED'
        ? `${hits} of ${active} active legs hit`
        : status === 'LIVE'
          ? `${play.selections.filter((leg) => ['HIT', 'MISS', 'PUSH', 'VOID'].includes(leg.gradingStatus ?? '')).length} of ${play.selections.length} legs settled`
          : status === 'VOID'
            ? 'All legs voided'
            : startsLabel(play.event?.kickoffAt);
  return (
    <aside className={`${styles.resultPanel} ${styles[`panel_${status.toLowerCase()}`]}`}>
      {status === 'HIT' ? (
        <Trophy />
      ) : status === 'MISSED' ? (
        <CircleX />
      ) : (
        <span className={styles.resultDot} />
      )}
      <div>
        <strong>{statusLabel[status]}</strong>
        <p>{detail}</p>
        {returnValue !== null ? (
          <small>
            {settled && status === 'MISSED' ? 'If it hit · return on $10' : '$10 would return'}{' '}
            <b>${returnValue.toFixed(2)}</b>
          </small>
        ) : null}
      </div>
    </aside>
  );
}

const startsLabel = (kickoff?: string) => {
  if (!kickoff) return 'Awaiting game time';
  const ms = new Date(kickoff).getTime() - Date.now();
  if (ms <= 0) return 'Awaiting final result';
  const hours = Math.ceil(ms / 3600000);
  return hours < 48
    ? `Starts in ${hours} hour${hours === 1 ? '' : 's'}`
    : `Starts in ${Math.ceil(hours / 24)} days`;
};

async function downloadPlayImage(play: SavedPlay, returnValue: number | null) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#f3f6f8';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#071b30';
  ctx.font = '900 48px Arial';
  ctx.fillText('DOWN & DISTANCE · THE PARLAY BUS', 60, 82);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(42, 120, 996, 850, 32);
  ctx.fill();
  ctx.fillStyle = '#071b30';
  ctx.font = '900 40px Arial';
  ctx.fillText(`${play.selections.length} Pick Parlay`, 78, 185);
  ctx.font = '700 24px Arial';
  ctx.fillStyle = '#63798d';
  ctx.fillText(`${matchup(play)} · ${price(play.savedCombinedOdds)}`, 78, 225);
  ctx.textAlign = 'right';
  ctx.fillStyle =
    play.status === 'HIT' ? '#168354' : play.status === 'MISSED' ? '#b62f35' : '#071b30';
  ctx.font = '900 38px Arial';
  ctx.fillText(statusLabel[play.status ?? 'UPCOMING'].toUpperCase(), 996, 185);
  ctx.textAlign = 'left';
  play.selections.slice(0, 7).forEach((leg, index) => {
    const y = 300 + index * 85;
    ctx.strokeStyle = '#e2e8ee';
    ctx.beginPath();
    ctx.moveTo(78, y - 28);
    ctx.lineTo(996, y - 28);
    ctx.stroke();
    ctx.fillStyle = '#071b30';
    ctx.font = '800 26px Arial';
    ctx.fillText(`${index + 1}. ${leg.playerName ?? leg.teamId ?? 'Game'}`, 78, y);
    ctx.fillStyle = '#61778c';
    ctx.font = '600 21px Arial';
    ctx.fillText(`${selectionText(leg)} · ${leg.sportsbook} ${price(leg.odds)}`, 78, y + 32);
    ctx.textAlign = 'right';
    ctx.fillStyle =
      leg.gradingStatus === 'HIT'
        ? '#168354'
        : leg.gradingStatus === 'MISS'
          ? '#b62f35'
          : '#61778c';
    ctx.font = '800 22px Arial';
    ctx.fillText(
      `${legStatusLabel[leg.gradingStatus ?? 'UPCOMING']}${leg.actualResult == null ? '' : ` · ${leg.actualResult}`}`,
      996,
      y + 12,
    );
    ctx.textAlign = 'left';
  });
  if (returnValue !== null) {
    ctx.fillStyle = '#071b30';
    ctx.font = '800 24px Arial';
    ctx.fillText(`$10 WOULD RETURN  $${returnValue.toFixed(2)}`, 78, 925);
  }
  ctx.fillStyle = '#61778c';
  ctx.font = '600 20px Arial';
  ctx.fillText('downdistance.com/parlay-lab', 78, 1025);
  const link = document.createElement('a');
  link.download = `parlay-lab-${play.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
