'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Search, Target } from 'lucide-react';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import styles from './draft-central.module.css';

type Prospect = {
  id: string;
  name: string;
  position: string | null;
  school: string | null;
  height: string | null;
  weight: number | null;
  age: number | null;
  currentRank: number;
  rankingTrend: number;
  scoutGrade: number;
  projectedPickLow: number;
  projectedPickHigh: number;
  needFitScore?: number;
  schemeFitScore?: number;
};
type DraftNews = {
  id: string;
  prospectId: string;
  category: string;
  headline: string;
  summary: string;
};
type Data = {
  week: number;
  season: number;
  draftYear: number;
  projectedSlot: number;
  needs: string[];
  picks: Array<{ id: string; year: number; round: number; displayOverall: number }>;
  prospects: Prospect[];
  fits: Prospect[];
  news: DraftNews[];
};
const tabs = [
  ['Overview', '/front-office/draft'],
  ['Prospects', '/front-office/draft/prospects'],
  ['My Big Board', '/front-office/draft/big-board'],
  ['Team Needs', '/front-office/draft/team-needs'],
  ['Mock Drafts', '/front-office/draft/mock-drafts'],
  ['Draft History', '/front-office/draft/history'],
  ['Scouting Reports', '/front-office/draft/scouting'],
] as const;
const trend = (value: number) => (value > 0 ? `↑ +${value}` : value < 0 ? `↓ ${value}` : '—');
function Avatar({ name }: { name: string }) {
  return (
    <span className={styles.avatar}>
      {name
        .split(' ')
        .map((word) => word[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
function Grade({ value }: { value: number }) {
  return <b className={styles.grade}>{value}</b>;
}
export function DraftCentralPage() {
  const saveId = useSaveStore((state) => state.saveId);
  const [data, setData] = useState<Data | null>(null);
  const [query, setQuery] = useState('');
  const [board, setBoard] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!saveId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await apiFetch(
          `/api/front-office/draft-central?saveId=${encodeURIComponent(saveId)}`,
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load Draft Central.');
        if (active) {
          setData(payload);
          setError('');
        }
      } catch (reason) {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Unable to load Draft Central.');
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
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data;
    return data
      ? {
          ...data,
          prospects: data.prospects.filter((item) =>
            `${item.name} ${item.position} ${item.school}`.toLowerCase().includes(needle),
          ),
          fits: data.fits.filter((item) =>
            `${item.name} ${item.position} ${item.school}`.toLowerCase().includes(needle),
          ),
          news: data.news.filter((item) =>
            `${item.headline} ${item.summary} ${item.category}`.toLowerCase().includes(needle),
          ),
        }
      : null;
  }, [data, query]);
  if (error) return <div className={styles.status}>{error}</div>;
  if (!visible) return <div className={styles.status}>Loading Draft Central…</div>;
  const boardProspects = board
    .map((id) => visible.prospects.find((prospect) => prospect.id === id))
    .filter((entry): entry is Prospect => Boolean(entry))
    .slice(0, 5);
  const featured = visible.news[0];
  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <nav>
            <Link href="/experience">Front Office</Link>
            <span>›</span>
            <strong>Draft</strong>
          </nav>
          <h1>Draft Central</h1>
          <p>Scouting. Analysis. Projections. Everything you need to prepare for the next draft.</p>
        </div>
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prospects, positions, schools, or topics..."
          />
        </label>
      </div>
      <nav className={styles.tabs}>
        {tabs.map(([label, href], index) => (
          <Link className={index === 0 ? styles.activeTab : undefined} href={href} key={label}>
            {label}
          </Link>
        ))}
      </nav>
      <div className={styles.layout}>
        <main>
          <div className={styles.topGrid}>
            <section className={styles.card}>
              <header>
                <h2>Top Draft News</h2>
                <Link href="/front-office/draft/scouting">
                  View all <ArrowRight />
                </Link>
              </header>
              <div className={styles.newsGrid}>
                {featured ? (
                  <Link
                    className={styles.feature}
                    href={`/front-office/draft/prospects/${featured.prospectId}`}
                  >
                    <small>{featured.category}</small>
                    <h3>{featured.headline}</h3>
                    <p>{featured.summary}</p>
                    <span>
                      Read full story <ArrowRight />
                    </span>
                  </Link>
                ) : (
                  <div className={styles.empty}>
                    Draft intelligence will update as the season advances.
                  </div>
                )}
                <div className={styles.newsList}>
                  {visible.news.slice(1, 5).map((story) => (
                    <Link href={`/front-office/draft/prospects/${story.prospectId}`} key={story.id}>
                      <b>{story.category}</b>
                      <span>{story.headline}</span>
                      <small>Week {visible.week}</small>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
            <section className={styles.card}>
              <header>
                <h2>Top 5 on My Big Board</h2>
                <Link href="/front-office/draft/big-board">
                  View / edit <ArrowRight />
                </Link>
              </header>
              {boardProspects.length ? (
                <div className={styles.board}>
                  {boardProspects.map((prospect, index) => (
                    <Link href={`/front-office/draft/prospects/${prospect.id}`} key={prospect.id}>
                      <em>{index + 1}</em>
                      <Avatar name={prospect.name} />
                      <span>
                        <strong>{prospect.name}</strong>
                        <small>
                          {prospect.position} | {prospect.school}
                        </small>
                      </span>
                      <Grade value={prospect.scoutGrade} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.boardEmpty}>
                  <p>You haven’t ranked any prospects yet.</p>
                  <Link href="/front-office/draft/big-board">
                    Build my Big Board <ArrowRight />
                  </Link>
                </div>
              )}
              <Link className={styles.fullButton} href="/front-office/draft/big-board">
                Go to My Big Board <ArrowRight />
              </Link>
            </section>
          </div>
          <div className={styles.bottomGrid}>
            <section className={styles.card}>
              <header>
                <div>
                  <h2>Top Prospects</h2>
                  <p>The highest-rated prospects in the {visible.draftYear} draft class.</p>
                </div>
                <Link href="/front-office/draft/prospects">
                  View all prospects <ArrowRight />
                </Link>
              </header>
              <div className={styles.prospectHead}>
                <span>Rank</span>
                <span>Player</span>
                <span>Pos</span>
                <span>School</span>
                <span>HT</span>
                <span>WT</span>
                <span>Age</span>
                <span>Grade</span>
                <span>Trend</span>
                <span />
              </div>
              <div className={styles.prospects}>
                {visible.prospects.slice(0, 10).map((prospect) => (
                  <div key={prospect.id}>
                    <b>{prospect.currentRank}</b>
                    <span>
                      <Avatar name={prospect.name} />
                      <strong>{prospect.name}</strong>
                    </span>
                    <span>{prospect.position}</span>
                    <span>{prospect.school}</span>
                    <span>{prospect.height ?? '—'}</span>
                    <span>{prospect.weight ?? '—'}</span>
                    <span>{prospect.age ?? '—'}</span>
                    <Grade value={prospect.scoutGrade} />
                    <i className={prospect.rankingTrend >= 0 ? styles.up : styles.down}>
                      {trend(prospect.rankingTrend)}
                    </i>
                    <Link href={`/front-office/draft/prospects/${prospect.id}`}>View</Link>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.card}>
              <header>
                <div>
                  <h2>Best Fits for Your Team</h2>
                  <p>Prospects who fit your team’s biggest needs.</p>
                </div>
                <Link href="/front-office/draft/prospects?fit=my-team">
                  View all <ArrowRight />
                </Link>
              </header>
              <div className={styles.fits}>
                {visible.fits.slice(0, 5).map((prospect) => (
                  <div key={prospect.id}>
                    <Avatar name={prospect.name} />
                    <span>
                      <strong>{prospect.name}</strong>
                      <small>
                        {prospect.position} | {prospect.school}
                      </small>
                      <Grade value={prospect.scoutGrade} />
                    </span>
                    <label>
                      Scheme fit<b>{(prospect.schemeFitScore ?? 0) >= 75 ? 'High' : 'Medium'}</b>
                    </label>
                    <label>
                      Need fit<b>{(prospect.needFitScore ?? 0) >= 70 ? 'High' : 'Medium'}</b>
                    </label>
                    <Link href={`/front-office/draft/prospects/${prospect.id}`}>View profile</Link>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
        <aside>
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
                  #{visible.picks[0]?.displayOverall ?? visible.projectedSlot}
                  <small>
                    Round {visible.picks[0]?.round ?? 1}, Pick {visible.projectedSlot}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Next Pick</dt>
                <dd>
                  #{visible.picks[1]?.displayOverall ?? visible.projectedSlot + 32}
                  <small>Round {visible.picks[1]?.round ?? 2}</small>
                </dd>
              </div>
              <div>
                <dt>Total Picks</dt>
                <dd>
                  {visible.picks.length}
                  <small>{visible.draftYear} Draft</small>
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
            <Link className={styles.insightLink} href="/front-office/draft/team-needs">
              <BarChart3 />
              <span>
                Draft Capital
                <strong>
                  {visible.picks
                    .slice(0, 3)
                    .map((pick) => `${pick.year} Rd ${pick.round}`)
                    .join(' · ') || 'No owned picks'}
                </strong>
              </span>
              <ArrowRight />
            </Link>
          </section>
          <section className={styles.promo}>
            <strong>
              The future
              <br />
              is yours.
            </strong>
            <span>Scout. Rank. Build.</span>
            <Link href="/front-office/draft/big-board">
              Go to Big Board <ArrowRight />
            </Link>
          </section>
          <section className={styles.card}>
            <header>
              <h2>Around the Draft</h2>
              <Link href="/front-office/draft/scouting">
                View all <ArrowRight />
              </Link>
            </header>
            <div className={styles.around}>
              {visible.news.slice(2, 7).map((story) => (
                <Link href={`/front-office/draft/prospects/${story.prospectId}`} key={story.id}>
                  {story.headline}
                  <small>Week {visible.week}</small>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
