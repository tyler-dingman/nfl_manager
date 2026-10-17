'use client';
import { isAnytimeTD } from '../../../packages/parlay/anytime-td';
import { labScoreColor } from '../../../packages/parlay/lab-score-config';

import { useEffect, useState } from 'react';
import {
  Plus,
  Save as SaveIcon,
  X,
  ChevronUp,
  Download,
  MessageCircle,
  Share2,
} from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import type { Sportsbook } from '@/server/odds/sportsbooks';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { displayOdds, slipOdds, slipText, slipPick } from '../../../packages/parlay/slip';
import {
  accountParlays,
  mergeSavedParlays,
  saveAccountParlay,
} from '../../../packages/parlay/account-saves';
import { snapshotSavedPlay, type SavedPlay } from './saved-plays';
import { saveSlipImage } from './slip-image';
import styles from './my-parlay-panel.module.css';
import { useSportsbookTransfers } from '../../../packages/parlay/use-sportsbook-transfers';
import { SportsbookTransfers } from './SportsbookTransfers';
export type ParlayPanelMarket = {
  id: string;
  playerName: string | null;
  headshotUrl?: string | null;
  teamId: string | null;
  marketType: string;
  side: string;
  line: number | null;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
  eventId?: string;
  playerId?: string | null;
  period?: string;
  trend?: {
    trendScore?: number;
    last10: { hits: number; games: number; hitRate: number | null };
  } | null;
  labResearch?: {
    labFindSide: 'OVER' | 'UNDER' | null;
    over: SideResearch | null;
    under: SideResearch | null;
  } | null;
};
type SideResearch = {
  sampleSize: number;
  positiveSignals: Array<{ label: string; value: string }>;
  concerns: Array<{ label: string; value: string }>;
};
type Props<T extends ParlayPanelMarket> = {
  legs: T[];
  events?: Array<{
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    kickoffAt: string;
    week?: number;
  }>;
  markets: T[];
  matchup: string;
  marketLabel: (market: T) => string;
  pickLabel: (market: T) => string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onResearch?: (market: T) => void;
  avatarColor?: (market: T) => string | null;
};

export default function MyParlayPanel<T extends ParlayPanelMarket>(props: Props<T>) {
  const sportsbookTransfers = useSportsbookTransfers(props.legs, fetch);
  const [tab, setTab] = useState<'parlay' | 'saved'>('parlay');
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saved, setSaved] = useState<SavedPlay[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const readSaved = async () => {
    setSavedLoading(true);
    let local: SavedPlay[] = [];
    try {
      local = JSON.parse(localStorage.getItem('down-distance-parlay-lab-slips') ?? '[]');
      if (!Array.isArray(local)) local = [];
    } catch {}
    setSaved(local);
    try {
      setSaved(mergeSavedParlays(local, await accountParlays(fetch)));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSavedLoading(false);
    }
  };
  useEffect(() => {
    if (tab === 'saved') void readSaved();
  }, [tab]);
  const total = slipOdds(props.legs);
  const text = slipText(props.legs);
  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const event = props.events?.find((e) => props.legs.every((m) => m.eventId === e.id));
      const play = snapshotSavedPlay({
        id: crypto.randomUUID(),
        selections: props.legs,
        event: event ? { ...event, week: event.week ?? 0 } : null,
      });
      await saveAccountParlay(fetch, play);
      let local: SavedPlay[] = [];
      try {
        local = JSON.parse(localStorage.getItem('down-distance-parlay-lab-slips') ?? '[]');
      } catch {}
      const next = mergeSavedParlays(Array.isArray(local) ? local : [], [play]);
      try {
        localStorage.setItem('down-distance-parlay-lab-slips', JSON.stringify(next.slice(0, 20)));
      } catch {}
      setSaved(next);
      setMessage('Saved to your account and My Parlays.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Down & Distance · My Parlay', text });
      else {
        await navigator.clipboard.writeText(text);
        setMessage('Parlay copied to clipboard.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage('Unable to share. Please try again.');
    }
  };
  const summary = props.legs.length > 0 && (
    <div className={styles.actions}>
      <section className={styles.totalOdds}>
        <div>
          <strong>{props.legs.length} Leg Parlay</strong>
          <small>Estimated combined odds</small>
        </div>
        <b>{displayOdds(total)}</b>
      </section>
      {props.legs.some(
        (m, i) => m.eventId && props.legs.some((n, j) => i !== j && n.eventId === m.eventId),
      ) && (
        <p className={styles.note}>
          Same-game legs may be correlated. Sportsbook pricing may differ.
        </p>
      )}
      <SportsbookTransfers model={sportsbookTransfers} showDetails={detailsOpen} />
      <button
        className={styles.detailsToggle}
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen(!detailsOpen)}
      >
        Actions &amp; details{' '}
        <ChevronUp size={16} style={{ transform: detailsOpen ? undefined : 'rotate(180deg)' }} />
      </button>
      {detailsOpen && (
        <div>
          <div className={styles.utilities}>
            <button
              onClick={() => {
                try {
                  saveSlipImage(props.legs);
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <Download />
              Save Image
            </button>
            <a href={`sms:?&body=${encodeURIComponent(text)}`}>
              <MessageCircle />
              Messages
            </a>
            <button onClick={() => void share()}>
              <Share2 />
              Share
            </button>
          </div>
          <button className={styles.save} disabled={busy} onClick={() => void save()}>
            <SaveIcon size={16} />
            {busy ? 'Saving…' : 'Save'}
          </button>
          <p className={styles.note}>
            Odds and availability can change. Always confirm in your sportsbook.
          </p>
        </div>
      )}
    </div>
  );
  const content = (
    <aside className={styles.panel} aria-label="My Parlay">
      <header>
        <h2>My Parlay ({props.legs.length})</h2>
        {props.legs.length > 0 && <button onClick={props.onClear}>Clear</button>}
      </header>
      <div className={styles.tabs} role="tablist" aria-label="Parlay view">
        <button role="tab" aria-selected={tab === 'parlay'} onClick={() => setTab('parlay')}>
          Parlay
        </button>
        <button role="tab" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}>
          Saved
        </button>
      </div>
      <div className={styles.legs} role="tabpanel">
        {tab === 'saved' ? (
          <>
            <a className={styles.savedMessage} href="/parlay-lab/my-plays">
              View My Parlays →
            </a>
            {!saved.length && (
              <p className={styles.savedMessage}>
                {savedLoading ? 'Loading saved parlays…' : 'No saved parlays yet.'}
              </p>
            )}
            {saved.map((play) => (
              <article key={play.id} className={styles.saved}>
                <strong>
                  {play.selections.length} Leg Parlay · {displayOdds(play.savedCombinedOdds)}
                </strong>
                {play.selections.map((leg, i) => (
                  <small key={i}>
                    {leg.playerName ?? leg.teamId} · {leg.side} {leg.line}{' '}
                    {leg.marketType.replaceAll('_', ' ')}
                  </small>
                ))}
              </article>
            ))}
          </>
        ) : !props.legs.length ? (
          <div className={styles.empty}>
            <Plus />
            <h3>Build Your Parlay</h3>
            <p>Select player props from Trending Props to start building your slip.</p>
          </div>
        ) : (
          props.legs.map((leg) => {
            const event = props.events?.find((e) => e.id === leg.eventId);
            return (
              <article key={`${leg.id}:${leg.sportsbook}`} className={styles.leg}>
                <PlayerAvatar
                  name={leg.playerName}
                  headshotUrl={leg.headshotUrl}
                  teamColor={props.avatarColor?.(leg)}
                  size={34}
                />
                <div>
                  <button className={styles.player} onClick={() => props.onResearch?.(leg)}>
                    {leg.playerName ?? leg.teamId}
                  </button>
                  <span>
                    {isAnytimeTD(leg)
                      ? slipPick(leg)
                      : `${props.marketLabel(leg)} — ${props.pickLabel(leg)}`}
                  </span>
                  <small>
                    {event
                      ? `${leg.teamId} vs ${event.homeTeamId === leg.teamId ? event.awayTeamId : event.homeTeamId}`
                      : (leg.teamId ?? props.matchup)}
                  </small>
                  <div className={styles.metrics}>
                    <strong>{displayOdds(leg.odds)}</strong>
                    <small>
                      Lab Score{' '}
                      <b style={{ color: labScoreColor(leg.trend?.trendScore) }}>
                        {leg.trend?.trendScore ?? '—'}
                      </b>
                    </small>
                  </div>
                </div>
                <button
                  aria-label={`Remove ${leg.playerName ?? 'leg'}`}
                  onClick={() => props.onRemove(leg.id)}
                >
                  <X size={16} />
                </button>
              </article>
            );
          })
        )}
      </div>
      {tab === 'parlay' && summary}
      {message && (
        <p role="status" className={styles.note}>
          {message}
        </p>
      )}
    </aside>
  );
  return (
    <>
      <div className={styles.desktop}>{content}</div>
      <button className={styles.mobileBar} onClick={() => setOpen(true)}>
        My Parlay ({props.legs.length}) <b>{displayOdds(total)}</b>
        <span>
          Expand <ChevronUp size={16} />
        </span>
      </button>
      {open && (
        <BottomSheet
          title={`My Parlay (${props.legs.length})`}
          onClose={() => setOpen(false)}
          className={styles.sheet}
        >
          {content}
        </BottomSheet>
      )}
    </>
  );
}
