'use client';

import {
  BarChart3,
  Download,
  ExternalLink,
  FlaskConical,
  MessageCircle,
  Plus,
  Save as SaveIcon,
  Share2,
  Target,
  TriangleAlert,
  Trophy,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Sportsbook } from '@/server/odds/sportsbooks';
import PlayerAvatar from './PlayerAvatar';
import { rankSportsbookFits } from './sportsbook-fit';
import styles from './my-parlay-panel.module.css';

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
  trend?: { last10: { hits: number; games: number; hitRate: number | null } } | null;
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
  markets: T[];
  matchup: string;
  marketLabel: (market: T) => string;
  pickLabel: (market: T) => string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSave: () => void;
  onResearch?: (market: T) => void;
  buildBookLink: (markets: T[], sportsbook: Sportsbook) => string | null;
  avatarColor?: (market: T) => string | null;
};
const odds = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value}`);
const sportsbookLogos: Partial<Record<Sportsbook, string>> = {
  FANDUEL: '/assets/sportsbooks/fanduel_logo.png',
  DRAFTKINGS: '/assets/sportsbooks/draftkings_logo.png',
  BETMGM: '/assets/sportsbooks/betmgm_logo.png',
  CAESARS: '/assets/sportsbooks/caesars_logo.png',
};
const SportsbookLogo = ({ id, featured = false }: { id: Sportsbook; featured?: boolean }) => {
  const logo = sportsbookLogos[id];
  return logo ? (
    // These locally supplied brand marks have mixed source formats, so they intentionally bypass image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${styles.bookLogo} ${featured ? styles.bookLogoFeatured : ''}`}
      src={logo}
      alt=""
      aria-hidden="true"
    />
  ) : (
    <span
      className={`${styles.bookLogoFallback} ${featured ? styles.bookLogoFeatured : ''}`}
      aria-hidden="true"
    >
      {id === 'BET365' ? '365' : id.slice(0, 2)}
    </span>
  );
};
const sideResearch = (market: ParlayPanelMarket) =>
  market.side === 'UNDER' ? market.labResearch?.under : market.labResearch?.over;
const recent = (market: ParlayPanelMarket) => {
  if (market.trend?.last10) return market.trend.last10;
  const signal =
    sideResearch(market)?.positiveSignals.find((item) => item.label === 'Recent form') ??
    sideResearch(market)?.concerns.find((item) => item.label === 'Recent form');
  const match = signal?.value.match(/(\d+)\/(\d+)/);
  return match
    ? {
        hits: Number(match[1]),
        games: Number(match[2]),
        hitRate: Number(match[2]) ? (Number(match[1]) / Number(match[2])) * 100 : null,
      }
    : null;
};

export default function MyParlayPanel<T extends ParlayPanelMarket>(props: Props<T>) {
  const [message, setMessage] = useState('');
  const fits = useMemo(
    () => rankSportsbookFits(props.legs, props.markets),
    [props.legs, props.markets],
  );
  const best = fits[0];
  const details = props.legs.map((leg) => {
    const research = sideResearch(leg),
      last10 = recent(leg),
      labFind = leg.labResearch?.labFindSide === leg.side;
    const review =
      !labFind &&
      Boolean(
        research?.concerns.length && research.concerns.length >= research.positiveSignals.length,
      );
    const favorable = Boolean(
      research?.positiveSignals.some((signal) => /opponent|matchup|defense/i.test(signal.label)),
    );
    return {
      leg,
      research,
      last10,
      labFind,
      review,
      favorable,
      score: labFind ? 100 : review ? 40 : (last10?.hitRate ?? 60),
    };
  });
  const labFinds = details.filter((item) => item.labFind).length;
  const review = details.filter((item) => item.review);
  const rates = details
    .map((item) => item.last10?.hitRate)
    .filter((value): value is number => value !== null && value !== undefined);
  const average = rates.length
    ? Math.round(rates.reduce((sum, value) => sum + value, 0) / rates.length)
    : null;
  const favorable = details.filter((item) => item.favorable).length;
  const weakest = [...details].sort((a, b) => a.score - b.score)[0];
  const setup =
    labFinds >= Math.max(2, Math.ceil(props.legs.length * 0.7))
      ? 'Strong setup'
      : review.length > Math.ceil(props.legs.length / 2)
        ? 'Worth a review'
        : labFinds
          ? 'Solid setup'
          : 'Mixed setup';
  const bookMarkets = best
    ? props.legs
        .map((leg) =>
          props.markets.find(
            (market) =>
              market.id === leg.id && market.sportsbook === best.sportsbook.id && market.available,
          ),
        )
        .filter((market): market is T => Boolean(market))
    : [];
  const bookLink = best
    ? (props.buildBookLink(bookMarkets, best.sportsbook.id) ?? best.sportsbook.url)
    : null;
  const text = [
    'PARLAY LAB',
    '',
    props.matchup,
    '',
    ...props.legs.map(
      (leg, index) =>
        `${index + 1}. ${leg.playerName ?? leg.teamId} — ${props.marketLabel(leg)} ${props.pickLabel(leg)}`,
    ),
    '',
    best?.matchedLegs
      ? `Best sportsbook fit: ${best.sportsbook.name} (${best.matchedLegs}/${best.totalLegs})`
      : 'No single sportsbook match found.',
    '',
    'Built with Down & Distance Parlay Lab',
  ].join('\n');
  const saveImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#071b30';
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = '#f16832';
    ctx.fillRect(0, 0, 1080, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '800 38px Arial';
    ctx.fillText('DOWN & DISTANCE', 70, 92);
    ctx.font = '900 64px Arial';
    ctx.fillText('PARLAY LAB', 70, 172);
    ctx.fillStyle = '#f16832';
    ctx.font = '800 28px Arial';
    ctx.fillText('MY PARLAY', 70, 230);
    ctx.fillStyle = '#fff';
    ctx.font = '700 27px Arial';
    props.legs
      .slice(0, 8)
      .forEach((leg, index) =>
        ctx.fillText(
          `${index + 1}. ${leg.playerName ?? leg.teamId} — ${props.marketLabel(leg)} ${props.pickLabel(leg)}`.slice(
            0,
            62,
          ),
          70,
          300 + index * 58,
        ),
      );
    ctx.fillStyle = '#f16832';
    ctx.font = '800 28px Arial';
    ctx.fillText(
      `LAB CHECK · ${labFinds} LAB FINDS${average === null ? '' : ` · ${average}% AVG L10`}`,
      70,
      835,
    );
    ctx.fillStyle = '#fff';
    ctx.fillText(
      best?.matchedLegs
        ? `BEST SPORTSBOOK FIT · ${best.sportsbook.name} · ${best.matchedLegs}/${best.totalLegs}`
        : 'NO SINGLE SPORTSBOOK MATCH',
      70,
      895,
    );
    ctx.fillStyle = '#9eb0c1';
    ctx.font = '500 23px Arial';
    ctx.fillText('Odds and availability can change.', 70, 1010);
    const link = document.createElement('a');
    link.download = `parlay-lab-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: 'Down & Distance Parlay Lab', text });
    else {
      await navigator.clipboard.writeText(text);
      setMessage('Parlay copied to your clipboard.');
    }
  };
  if (!props.legs.length)
    return (
      <aside className={styles.panel}>
        <header>
          <h2>
            My Parlay <span>0</span>
          </h2>
        </header>
        <div className={styles.empty}>
          <Plus />
          <h3>Build your parlay</h3>
          <p>Add the legs you like while you research.</p>
        </div>
      </aside>
    );
  return (
    <aside className={styles.panel}>
      <header>
        <h2>
          My Parlay <span>{props.legs.length}</span>
        </h2>
        <button onClick={props.onClear}>Clear All</button>
      </header>
      <div className={styles.legs}>
        {details.map(({ leg, last10, labFind, review: needsReview }, index) => (
          <article key={leg.id}>
            <i>{index + 1}</i>
            <PlayerAvatar
              name={leg.playerName}
              headshotUrl={leg.headshotUrl}
              teamColor={props.avatarColor?.(leg)}
              size={34}
            />
            <div>
              <strong>{leg.playerName ?? leg.teamId}</strong>
              <span>
                {props.marketLabel(leg)} · {props.pickLabel(leg)}
              </span>
              <small>
                {best?.sportsbook.name ?? leg.sportsbook}{' '}
                {odds(
                  props.markets.find(
                    (market) => market.id === leg.id && market.sportsbook === best?.sportsbook.id,
                  )?.odds ?? leg.odds,
                )}
              </small>
              <button
                className={labFind ? styles.find : needsReview ? styles.review : styles.neutral}
                onClick={() => props.onResearch?.(leg)}
              >
                <FlaskConical /> {labFind ? 'Lab Find' : needsReview ? 'Review' : 'Research'}
                {last10 ? ` · ${last10.hits}/${last10.games} L10` : ''}
              </button>
            </div>
            <button aria-label="Remove leg" onClick={() => props.onRemove(leg.id)}>
              <X />
            </button>
          </article>
        ))}
      </div>
      <section className={styles.lab}>
        <div className={styles.sectionTitle}>
          <FlaskConical />
          <div>
            <small>Lab Check</small>
            <h3>{setup}</h3>
            <p>
              {labFinds} of {props.legs.length} legs have strong research support.
            </p>
          </div>
        </div>
        <div className={styles.metrics}>
          <span>
            <FlaskConical />
            <b>{labFinds}</b>
            <small>Lab Finds</small>
          </span>
          <span>
            <BarChart3 />
            <b>{average === null ? '—' : `${average}%`}</b>
            <small>Avg. L10</small>
          </span>
          <span>
            <Target />
            <b>{favorable}</b>
            <small>Favorable</small>
          </span>
          <span>
            <TriangleAlert />
            <b>{review.length}</b>
            <small>To Review</small>
          </span>
        </div>
        {weakest && props.onResearch ? (
          <button className={styles.reviewWeakest} onClick={() => props.onResearch?.(weakest.leg)}>
            Review weakest leg →
          </button>
        ) : null}
      </section>
      <section className={styles.fit}>
        <div className={styles.sectionTitle}>
          <Trophy />
          <div>
            <small>Best Sportsbook Fit</small>
            {best?.matchedLegs ? (
              <div className={styles.bestBook}>
                <SportsbookLogo id={best.sportsbook.id} featured />
                <div>
                  <h3>{best.sportsbook.name}</h3>
                  <p>
                    {best.matchedLegs} of {best.totalLegs} legs available
                    {best.matchedLegs === best.totalLegs ? ' · Best match' : ''}
                  </p>
                </div>
              </div>
            ) : (
              <h3>No single sportsbook match found</h3>
            )}
          </div>
        </div>
        {best?.missingLegIds.length ? (
          <p className={styles.missing}>
            Missing:{' '}
            {best.missingLegIds
              .map((id) => props.legs.find((leg) => leg.id === id)?.playerName ?? id)
              .join(', ')}
          </p>
        ) : null}
        {best?.matchedLegs ? (
          <button
            className={styles.open}
            onClick={() => bookLink && window.open(bookLink, '_blank', 'noopener,noreferrer')}
            disabled={!bookLink}
          >
            Open {best.sportsbook.name} <ExternalLink />
          </button>
        ) : null}
        <h4>Other Sportsbooks</h4>
        {fits.slice(1).map((fit) => (
          <div className={styles.other} key={fit.sportsbook.id}>
            <div className={styles.otherBook}>
              <SportsbookLogo id={fit.sportsbook.id} />
              <div>
                <b>{fit.sportsbook.name}</b>
                <strong>
                  {fit.matchedLegs}/{fit.totalLegs}
                </strong>
              </div>
            </div>
            <span>
              {fit.missingLegIds.length
                ? `Missing ${fit.missingLegIds.length} leg${fit.missingLegIds.length === 1 ? '' : 's'}`
                : 'All legs available'}
            </span>
          </div>
        ))}
      </section>
      <div className={styles.utilities}>
        <button onClick={saveImage}>
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
      <button
        className={styles.save}
        onClick={() => {
          props.onSave();
          setMessage('Saved to My Plays.');
        }}
      >
        <SaveIcon /> Save
      </button>
      {message ? <p className={styles.status}>{message}</p> : null}
      <p className={styles.disclaimer}>
        Odds and availability can change. Always confirm in your sportsbook.
      </p>
    </aside>
  );
}
