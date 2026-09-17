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
import { estimateParlayOdds } from './parlay-odds';
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
      {id.slice(0, 2)}
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
  const displayedLegOdds = props.legs.map(
    (leg) =>
      props.markets.find(
        (market) => market.id === leg.id && market.sportsbook === best?.sportsbook.id,
      )?.odds ?? leg.odds,
  );
  const estimatedTotalOdds = estimateParlayOdds(displayedLegOdds);
  const text = [
    "I've been cooking up parlays in the lab",
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
    'Built with the Down & Distance Parlay Lab — https://downdistance.com/parlay-lab',
  ].join('\n');
  const saveImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
    };
    const fitText = (value: string, maxWidth: number) => {
      if (ctx.measureText(value).width <= maxWidth) return value;
      let shortened = value;
      while (shortened.length && ctx.measureText(`${shortened}…`).width > maxWidth)
        shortened = shortened.slice(0, -1);
      return `${shortened}…`;
    };
    const logo = await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = '/assets/front-office-asset-pack/brand/down-distance-logo.png';
    });

    ctx.fillStyle = '#f3f6f8';
    ctx.fillRect(0, 0, 1080, 1080);

    if (logo) {
      const logoWidth = 184;
      const logoHeight = (logo.height / logo.width) * logoWidth;
      ctx.drawImage(logo, 58, 42, logoWidth, logoHeight);
    }
    ctx.fillStyle = '#071b30';
    ctx.font = '900 48px Arial';
    ctx.fillText('PARLAY LAB', 270, 94);
    ctx.fillStyle = '#60758a';
    ctx.font = '700 22px Arial';
    ctx.fillText('DOWN & DISTANCE', 272, 126);

    roundedRect(42, 168, 996, 820, 36);
    ctx.fillStyle = '#171a1d';
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '800 42px Arial';
    ctx.fillText(`${props.legs.length} Pick Parlay`, 82, 230);
    ctx.fillStyle = '#aeb5bc';
    ctx.font = '500 24px Arial';
    ctx.fillText(
      fitText(props.legs.map((leg) => leg.playerName ?? leg.teamId ?? 'Game').join(', '), 900),
      82,
      272,
    );

    const shownLegs = props.legs.slice(0, 7);
    shownLegs.forEach((leg, index) => {
      const top = 314 + index * 82;
      if (index) {
        ctx.strokeStyle = '#34383c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(82, top - 20);
        ctx.lineTo(998, top - 20);
        ctx.stroke();
      }
      ctx.fillStyle = '#282c30';
      ctx.beginPath();
      ctx.arc(104, top + 18, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8c900';
      ctx.font = '800 21px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(index + 1), 104, top + 26);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = '800 27px Arial';
      ctx.fillText(fitText(leg.playerName ?? leg.teamId ?? 'Game', 500), 148, top + 10);
      ctx.fillStyle = '#aeb5bc';
      ctx.font = '600 21px Arial';
      ctx.fillText(
        fitText(`${props.marketLabel(leg)} · ${props.pickLabel(leg)}`, 650),
        148,
        top + 42,
      );
      ctx.fillStyle = '#fff';
      ctx.font = '800 25px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(odds(leg.odds), 984, top + 24);
      ctx.textAlign = 'left';
    });

    if (props.legs.length > shownLegs.length) {
      ctx.fillStyle = '#aeb5bc';
      ctx.font = '700 20px Arial';
      ctx.fillText(`+${props.legs.length - shownLegs.length} more legs`, 148, 902);
    }
    ctx.strokeStyle = '#34383c';
    ctx.beginPath();
    ctx.moveTo(82, 914);
    ctx.lineTo(998, 914);
    ctx.stroke();
    ctx.fillStyle = '#43c786';
    ctx.font = '800 22px Arial';
    ctx.fillText(`LAB CHECK · ${labFinds} LAB FINDS`, 82, 952);
    ctx.fillStyle = '#aeb5bc';
    ctx.textAlign = 'right';
    ctx.fillText(
      best?.matchedLegs
        ? `${best.sportsbook.name} · ${best.matchedLegs}/${best.totalLegs} legs`
        : 'Research before you bet',
      998,
      952,
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#60758a';
    ctx.font = '600 20px Arial';
    ctx.fillText('downdistance.com/parlay-lab', 540, 1032);

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
              size={30}
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
      <section className={styles.totalOdds} aria-label="Estimated total parlay odds">
        <div>
          <small>Estimated Total Odds</small>
          <span>{props.legs.length} leg parlay</span>
        </div>
        <strong>{odds(estimatedTotalOdds)}</strong>
      </section>
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
