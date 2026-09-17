'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  DdTeamAnalyticsIcon as BarChart3,
  DdDraftGuideIcon as ClipboardList,
  DdPlaybookIcon as Sparkles,
  DdScoutingIcon as Target,
} from '@/components/ui/football-icons';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import { DraftNewsGraphic } from '@/components/front-office/story-graphics/FrontOfficeStoryGraphic';
import { adaptDraftNewsGraphic } from '@/components/front-office/story-graphics/story-graphic-model';
import styles from './draft-central.module.css';

type Prospect = {
  id: string;
  name: string;
  position: string | null;
  school: string | null;
  height: string | null;
  weight: number | null;
  headshotUrl?: string | null;
  schoolLogo?: string | null;
  currentRank: number;
  priorRank: number;
  rankingTrend: number;
  scoutGrade: number;
  projectedPickLow: number;
  projectedPickHigh: number;
  needFitScore?: number;
  availabilityScore?: number;
};
type Pick = { id: string; year: number; round: number; displayOverall: number };
type Need = { position: string; score: number; level: 'High' | 'Moderate' | 'Low' };
type Data = {
  week: number;
  draftYear: number;
  projectedSlot: number;
  needs: string[];
  needAnalysis: Need[];
  recommendations: Array<{ position: string; title: string; detail: string }>;
  picks: Pick[];
  prospects: Prospect[];
  fits: Prospect[];
  news: Array<{
    id: string;
    prospectId: string;
    category: string;
    headline: string;
    summary: string;
  }>;
};
const Trend = ({ n }: { n: number }) => (
  <i className={n > 0 ? styles.up : n < 0 ? styles.down : ''}>
    {n > 0 ? `↑ ${n}` : n < 0 ? `↓ ${Math.abs(n)}` : '—'}
  </i>
);
function Avatar({ p }: { p: Prospect }) {
  return (
    <span
      className={styles.avatar}
      style={p.headshotUrl ? { backgroundImage: `url(${p.headshotUrl})` } : undefined}
    >
      {!p.headshotUrl &&
        p.name
          .split(' ')
          .map((x) => x[0])
          .slice(0, 2)
          .join('')}
    </span>
  );
}
const Grade = ({ n }: { n: number }) => <b className={styles.grade}>{n}</b>;
function Player({ p, note }: { p: Prospect; note?: string }) {
  return (
    <Link className={styles.playerRow} href={`/front-office/draft/prospects/${p.id}`}>
      <Avatar p={p} />
      <span>
        <strong>{p.name}</strong>
        <small>
          {p.position} · {p.school}
        </small>
      </span>
      {note ? <em>{note}</em> : <Grade n={p.scoutGrade} />}
    </Link>
  );
}

export function DraftCentralPage() {
  const saveId = useSaveStore((s) => s.saveId),
    [data, setData] = useState<Data | null>(null),
    [board, setBoard] = useState<string[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    if (!saveId) return;
    let active = true;
    const load = async () => {
      try {
        const r = await apiFetch(
            `/api/front-office/draft-central?saveId=${encodeURIComponent(saveId)}`,
          ),
          p = await r.json();
        if (!r.ok) throw new Error(p.error ?? 'Unable to load Draft Central.');
        if (active) {
          setData(p);
          setError('');
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load Draft Central.');
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    try {
      setBoard(JSON.parse(localStorage.getItem(`dd-draft-big-board:${saveId}`) ?? '[]'));
    } catch {
      setBoard([]);
    }
    return () => {
      active = false;
      window.removeEventListener('front-office-simulation-advanced', load);
    };
  }, [saveId]);
  if (error) return <div className={styles.status}>{error}</div>;
  if (!data) return <div className={styles.status}>Loading Draft Central…</div>;
  const visible = data;
  const boardRank = new Map(board.map((id, i) => [id, i + 1])),
    picks = visible.picks.filter((p) => p.year === visible.draftYear).slice(0, 5),
    first = picks[0],
    featured = visible.news[0],
    featuredProspect = featured
      ? visible.prospects.find((prospect) => prospect.id === featured.prospectId)
      : undefined;
  const targets = (pick: Pick) =>
    [...visible.fits]
      .sort((a, b) => {
        const aa =
            a.projectedPickLow <= pick.displayOverall + 8 &&
            a.projectedPickHigh >= pick.displayOverall - 8,
          ba =
            b.projectedPickLow <= pick.displayOverall + 8 &&
            b.projectedPickHigh >= pick.displayOverall - 8;
        return (
          Number(ba) - Number(aa) ||
          (boardRank.get(a.id) ?? 999) - (boardRank.get(b.id) ?? 999) ||
          (b.needFitScore ?? 0) - (a.needFitScore ?? 0)
        );
      })
      .slice(0, 3);
  const radar = [...visible.fits]
      .sort(
        (a, b) =>
          (boardRank.get(a.id) ?? 999) - (boardRank.get(b.id) ?? 999) ||
          (b.needFitScore ?? 0) - (a.needFitScore ?? 0),
      )
      .slice(0, 6),
    movers = visible.prospects.filter((p) => p.rankingTrend !== 0),
    risers = [...movers].sort((a, b) => b.rankingTrend - a.rankingTrend).slice(0, 3),
    fallers = [...movers].sort((a, b) => a.rankingTrend - b.rankingTrend).slice(0, 3);
  const groups = (
      [...new Set(visible.prospects.map((p) => p.position).filter(Boolean))] as string[]
    )
      .map((position) => {
        const g = visible.prospects.filter((p) => p.position === position),
          score =
            g.filter((p) => p.currentRank <= 50).length * 3 +
            g.filter((p) => p.currentRank <= 100).length;
        return { position, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8),
    max = Math.max(...groups.map((g) => g.score), 1);
  return (
    <div className={styles.page}>
      <div className={styles.firstRow}>
        <section className={styles.card}>
          <header>
            <h2>Top Draft News</h2>
            <Link href="/front-office/draft/scouting">
              Draft Guide <ArrowRight />
            </Link>
          </header>
          {featured ? (
            <div className={styles.newsGrid}>
              <Link
                className={styles.storyFeature}
                href={`/front-office/draft/prospects/${featured.prospectId}`}
              >
                <DraftNewsGraphic
                  size="hero"
                  identityLine={[featuredProspect?.position, featuredProspect?.school]
                    .filter(Boolean)
                    .join(' · ')}
                  actionLabel="View prospect"
                  story={adaptDraftNewsGraphic({
                    id: featured.id,
                    headline: featured.headline,
                    summary: featured.summary,
                    category: featured.category,
                    prospectName: featuredProspect?.name,
                    school: featuredProspect?.school,
                    schoolLogo: featuredProspect?.schoolLogo,
                    previousRank: featuredProspect?.priorRank,
                    currentRank: featuredProspect?.currentRank,
                    dateLabel: `Week ${visible.week}`,
                  })}
                />
              </Link>
              <div className={styles.newsList}>
                {visible.news.slice(1, 6).map((x) => (
                  <Link key={x.id} href={`/front-office/draft/prospects/${x.prospectId}`}>
                    <b>{x.category}</b>
                    <span>{x.headline}</span>
                    <small>Week {visible.week}</small>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.empty}>No major draft developments yet.</div>
          )}
        </section>
        <section className={styles.card}>
          <header>
            <h2>
              <BarChart3 /> Draft Insights
            </h2>
          </header>
          <dl className={styles.insights}>
            <div>
              <dt>Your Pick</dt>
              <dd>
                #{first?.displayOverall ?? visible.projectedSlot}
                <small>Overall · Round {first?.round ?? 1}</small>
              </dd>
            </div>
            <div>
              <dt>Next Pick</dt>
              <dd>
                {picks[1] ? `#${picks[1].displayOverall}` : '—'}
                <small>{picks[1] ? `Overall · Round ${picks[1].round}` : 'No later pick'}</small>
              </dd>
            </div>
            <div>
              <dt>Total Picks</dt>
              <dd>
                {visible.picks.length}
                <small>{visible.draftYear} and future</small>
              </dd>
            </div>
          </dl>
          <Link className={styles.insightLink} href="/front-office/draft/team-needs">
            <Target />
            <span>
              Team Needs<strong>{visible.needs.slice(0, 3).join(' · ')}</strong>
            </span>
            <ArrowRight />
          </Link>
          <Link className={styles.insightLink} href="/front-office/trade-hub">
            <BarChart3 />
            <span>
              Draft Capital
              <strong>
                {picks
                  .slice(0, 3)
                  .map((p) => `#${p.displayOverall}`)
                  .join(' · ') || 'No owned picks'}
              </strong>
            </span>
            <ArrowRight />
          </Link>
        </section>
      </div>
      <div className={styles.secondRow}>
        <section className={`${styles.card} ${styles.planCard}`}>
          <header>
            <div>
              <h2>
                <ClipboardList /> Your Draft Plan
              </h2>
              <p>Need-weighted targets near each owned selection.</p>
            </div>
            <Link href="/front-office/draft/room?mode=mock">
              Open Mock Draft <ArrowRight />
            </Link>
          </header>
          {picks.length ? (
            <div className={styles.planList}>
              {picks.slice(0, 4).map((pick) => (
                <div key={pick.id} className={styles.planPick}>
                  <div>
                    <b>Pick #{pick.displayOverall}</b>
                    <small>Round {pick.round}</small>
                  </div>
                  <p>
                    <span>Priority</span>
                    {visible.needs.slice(0, 3).join(' · ')}
                  </p>
                  <div className={styles.targetChips}>
                    {targets(pick).map((p) => (
                      <Link key={p.id} href={`/front-office/draft/prospects/${p.id}`}>
                        {p.name}
                        <small>
                          {p.position} · Grade {p.scoutGrade}
                        </small>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>No owned selections are available for this draft.</div>
          )}
        </section>
        <section className={styles.card}>
          <header>
            <h2>
              <Target /> On Your Radar
            </h2>
            <Link href="/front-office/draft/prospects">
              All prospects <ArrowRight />
            </Link>
          </header>
          <div className={styles.radar}>
            {radar.map((p) => (
              <Player
                key={p.id}
                p={p}
                note={
                  boardRank.has(p.id)
                    ? `Big Board #${boardRank.get(p.id)}`
                    : (p.needFitScore ?? 0) >= 70
                      ? `High need: ${p.position}`
                      : `Near Pick #${first?.displayOverall ?? visible.projectedSlot}`
                }
              />
            ))}
          </div>
        </section>
      </div>
      <div className={styles.thirdRow}>
        <section className={`${styles.card} ${styles.prospectCard}`}>
          <header>
            <div>
              <h2>Top Prospects</h2>
              <p>Shared rankings used across the draft experience.</p>
            </div>
            <Link href="/front-office/draft/prospects">
              View all <ArrowRight />
            </Link>
          </header>
          <div className={styles.prospectHead}>
            <span>Rank</span>
            <span>Player</span>
            <span>Pos</span>
            <span>School</span>
            <span>HT</span>
            <span>WT</span>
            <span>Grade</span>
            <span>Trend</span>
          </div>
          <div className={styles.prospects}>
            {visible.prospects.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/front-office/draft/prospects/${p.id}`}>
                <b>{p.currentRank}</b>
                <span>
                  <Avatar p={p} />
                  <strong>{p.name}</strong>
                </span>
                <span>{p.position}</span>
                <span>{p.school}</span>
                <span>{p.height ?? '—'}</span>
                <span>{p.weight ?? '—'}</span>
                <Grade n={p.scoutGrade} />
                <Trend n={p.rankingTrend} />
              </Link>
            ))}
          </div>
        </section>
        <section className={styles.card}>
          <header>
            <h2>Best Fits for Your Team</h2>
            <Link href="/front-office/draft/prospects?fit=my-team">
              View all <ArrowRight />
            </Link>
          </header>
          <div className={styles.fits}>
            {visible.fits.slice(0, 6).map((p) => (
              <div key={p.id}>
                <Avatar p={p} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.position} · {p.school}
                  </small>
                </span>
                <Grade n={p.scoutGrade} />
                <label>
                  Need<b>{Math.round(p.needFitScore ?? 0)}</b>
                </label>
                <label>
                  Available<b>{Math.round(p.availabilityScore ?? 0)}</b>
                </label>
                <Link href={`/front-office/draft/prospects/${p.id}`}>View</Link>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.card}>
          <header>
            <h2>Draft Stock</h2>
          </header>
          {movers.length ? (
            <div className={styles.stock}>
              <div>
                <h3>Risers</h3>
                {risers.map((p) => (
                  <Player key={p.id} p={p} note={`↑ ${p.rankingTrend}`} />
                ))}
              </div>
              <div>
                <h3>Fallers</h3>
                {fallers.map((p) => (
                  <Player key={p.id} p={p} note={`↓ ${Math.abs(p.rankingTrend)}`} />
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.empty}>No major movement this week.</div>
          )}
        </section>
      </div>
      <div className={styles.fourthRow}>
        <section className={styles.card}>
          <header>
            <h2>Position Strength</h2>
            <Link href="/front-office/draft/position-rankings">
              Rankings <ArrowRight />
            </Link>
          </header>
          <div className={styles.strength}>
            {groups.map((g) => {
              const need = visible.needAnalysis.find((n) => n.position === g.position),
                label =
                  g.score >= max * 0.72
                    ? 'Deep'
                    : g.score >= max * 0.42
                      ? 'Strong'
                      : g.score >= max * 0.2
                        ? 'Average'
                        : 'Thin';
              return (
                <div key={g.position}>
                  <b>{g.position}</b>
                  <span>
                    <i style={{ width: `${Math.max(12, (g.score / max) * 100)}%` }} />
                  </span>
                  <strong>{label}</strong>
                  <small>{need ? `${need.level} need · ${need.score}` : 'Class depth'}</small>
                </div>
              );
            })}
          </div>
        </section>
        <section className={styles.card}>
          <header>
            <h2>
              <Sparkles /> Draft Strategy
            </h2>
            <Link href="/front-office/draft/team-needs">
              Team needs <ArrowRight />
            </Link>
          </header>
          <div className={styles.strategy}>
            {visible.recommendations.slice(0, 4).map((x, i) => (
              <div key={`${x.position}-${i}`}>
                <em>{i + 1}</em>
                <span>
                  <strong>{x.title}</strong>
                  <small>{x.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.card}>
          <header>
            <h2>What If?</h2>
          </header>
          <div className={styles.whatIf}>
            <Link href="/front-office/draft/room?mode=mock">
              Stay at #{first?.displayOverall ?? visible.projectedSlot}
              <ArrowRight />
            </Link>
            <Link href="/front-office/trade-hub">
              Explore a trade back
              <ArrowRight />
            </Link>
            <Link href="/front-office/draft/room?mode=mock">
              Address {visible.needs[0] ?? 'value'} first
              <ArrowRight />
            </Link>
          </div>
        </section>
      </div>
      <div className={styles.finalRow}>
        <section className={styles.card}>
          <header>
            <h2>Latest Mock Draft</h2>
          </header>
          <div className={styles.calloutEmpty}>
            <span>No saved mock draft yet.</span>
            <p>Run a mock draft to see your latest results here.</p>
            <Link href="/front-office/draft/room?mode=mock">
              Start Mock Draft <ArrowRight />
            </Link>
          </div>
        </section>
        <section className={styles.card}>
          <header>
            <h2>Recent Draft Activity</h2>
          </header>
          <div className={styles.activity}>
            {board.length ? (
              <div>
                <span>Big Board</span>
                <strong>
                  {board.length} prospect{board.length === 1 ? '' : 's'} ranked
                </strong>
                <Link href="/front-office/draft/big-board">
                  Review <ArrowRight />
                </Link>
              </div>
            ) : (
              <div className={styles.calloutEmpty}>
                <span>No recent draft activity.</span>
                <p>Board and saved mock activity will appear here.</p>
              </div>
            )}
          </div>
        </section>
        <section className={styles.card}>
          <header>
            <h2>Draft Capital</h2>
            <Link href="/front-office/trade-hub">
              Trade Machine <ArrowRight />
            </Link>
          </header>
          <div className={styles.capital}>
            {visible.picks.slice(0, 8).map((p) => (
              <div key={p.id}>
                <b>#{p.displayOverall}</b>
                <span>
                  {p.year}
                  <small>Round {p.round}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
