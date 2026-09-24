'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowRight, Bookmark, ChevronRight, Trophy } from 'lucide-react';
import { useSaveStore } from '@/features/save/save-store';
import { TEAM_LIST } from '@/data/teams';
import { apiFetch } from '@/lib/api';
import { useProspectBoard } from '@/components/draft/use-prospect-board';
import { FrontOfficePhaseControl } from '@/components/front-office/front-office-phase-control';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import styles from './draft-central-home.module.css';
import tableHeading from '@/components/draft/draft-table-heading.module.css';
type Prospect = {
  id: string;
  name: string;
  position: string | null;
  school: string | null;
  height: string | null;
  weight: number | null;
  conference?: string | null;
  overall?: number | null;
  summary?: string | null;
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
type Pick = {
  id: string;
  year: number;
  round: number;
  displayOverall: number;
  compensatory?: boolean;
};
type Need = { position: string; score: number; level: 'High' | 'Moderate' | 'Low' };
export type DraftCentralHomeData = {
  draftInfo?: { startsAt: string; endsAt?: string; location?: string };
  week: number;
  draftYear: number;
  projectedSlot: number;
  needs: string[];
  needAnalysis: Need[];
  recommendations: Array<{ position: string; title: string; detail: string }>;
  picks: Pick[];
  remainingPicks?: Pick[];
  availableProspects?: Prospect[];
  prospects: Prospect[];
  fits: Prospect[];
  news: Array<{
    id: string;
    prospectId: string;
    createdAt?: string;
    category: string;
    headline: string;
    summary: string;
  }>;
};

const profile = (id: string) => `/front-office/draft/prospects/${encodeURIComponent(id)}`;
function Avatar({ p }: { p: Prospect }) {
  return p.headshotUrl ? (
    <Image src={p.headshotUrl} alt="" width={32} height={32} unoptimized />
  ) : (
    <span className={styles.initials}>
      {p.name
        .split(' ')
        .map((x) => x[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
export function DraftCentralPage() {
  const save = useSaveStore();
  const [data, setData] = useState<DraftCentralHomeData | null>(null);
  const [error, setError] = useState('');
  const [position, setPosition] = useState('');
  const [conference, setConference] = useState('');
  const [limit, setLimit] = useState(100);
  const [year, setYear] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const board = useProspectBoard(data?.draftYear ?? save.franchiseYear + 1);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!save.saveId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await apiFetch(
          `/api/front-office/draft-central?saveId=${encodeURIComponent(save.saveId!)}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load Draft Central.');
        if (!controller.signal.aborted) {
          setData(body);
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load Draft Central.');
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    window.addEventListener('front-office-week-complete', load);
    return () => {
      controller.abort();
      window.removeEventListener('front-office-simulation-advanced', load);
      window.removeEventListener('front-office-week-complete', load);
    };
  }, [save.saveId]);
  if (!data) return <p role="status">{error || 'Loading Draft Central…'}</p>;
  const featured = [...data.prospects].sort((a, b) => a.currentRank - b.currentRank)[0];
  const story = data.news.find((n) => n.prospectId === featured?.id);
  const selectedYear = year ?? data.draftYear;
  const years = [...new Set([data.draftYear, ...data.picks.map((p) => p.year)])].sort();
  const picks = data.picks
    .filter((p) => p.year === selectedYear)
    .sort((a, b) => a.displayOverall - b.displayOverall);
  const conferences = [
    ...new Set(data.prospects.map((p) => p.conference).filter((c): c is string => !!c)),
  ].sort();
  const prospects = data.prospects
    .filter(
      (p) =>
        (!position || p.position === position) &&
        (!conference || p.conference === conference) &&
        p.currentRank <= limit,
    )
    .slice(0, 10);
  const team = TEAM_LIST.find((t) => t.abbr === save.teamAbbr);
  const draftTime = data.draftInfo ? Date.parse(data.draftInfo.startsAt) : NaN;
  const remaining =
    now != null && Number.isFinite(draftTime)
      ? Math.max(0, Math.floor((draftTime - now) / 60000))
      : null;
  const countdown =
    remaining == null
      ? ['—', '—', '—']
      : [Math.floor(remaining / 1440), Math.floor(remaining / 60) % 24, remaining % 60];
  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.hero}>
          <FrontOfficeStrategicHero
            section="Draft"
            title="Draft Central"
            description="Scouting, analysis, projections, and everything you need to prepare for the next draft."
            compact
          />
          <FrontOfficeSectionNav section="draft" />
        </div>
        {error && <p role="status">{error}</p>}
        <div className={styles.editorial}>
          <section className={styles.feature} aria-label="Featured prospect">
            {featured ? (
              <>
                <div className={styles.featureCopy}>
                  <span className={styles.badge}>Featured Prospect</span>
                  <h2>{featured.name}</h2>
                  <h3>No. {featured.currentRank} in the current projection</h3>
                  <p>
                    {story?.summary ??
                      featured.summary ??
                      `${featured.position ?? 'Prospect'} from ${featured.school ?? 'the current draft class'}. Explore the full scouting report and projected draft range.`}
                  </p>
                  <div className={styles.featureActions}>
                    <Link href={profile(featured.id)}>
                      View Scouting Report <ArrowRight size={14} />
                    </Link>
                    <button
                      type="button"
                      aria-pressed={board.ids.includes(featured.id)}
                      onClick={() => board.toggle(featured.id)}
                    >
                      <Bookmark size={14} />
                      {board.ids.includes(featured.id) ? 'On Watchlist' : 'Add to Watchlist'}
                    </button>
                  </div>
                  <small>
                    {[
                      featured.position,
                      featured.school,
                      featured.height,
                      featured.weight ? `${featured.weight} lbs` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
                {featured.headshotUrl && (
                  <div className={styles.featureVisual}>
                    {featured.schoolLogo && (
                      <Image
                        className={styles.schoolWatermark}
                        src={featured.schoolLogo}
                        alt=""
                        width={180}
                        height={180}
                        unoptimized
                      />
                    )}
                    <Image
                      className={styles.cutout}
                      src={featured.headshotUrl}
                      alt={featured.name}
                      width={400}
                      height={400}
                      unoptimized
                    />
                  </div>
                )}
                <div className={styles.rank}>
                  <strong className="front-office-stat-value">#{featured.currentRank}</strong>
                  <span>Overall</span>
                </div>
              </>
            ) : (
              <p>No prospects are available for this draft class.</p>
            )}
          </section>
          <section className={styles.headlines} aria-label="Draft Headlines">
            <header>
              <h2>Draft Headlines</h2>
              <Link href="/front-office/draft/scouting">
                View All <ArrowRight size={12} />
              </Link>
            </header>
            {data.news.slice(0, 5).map((n) => (
              <Link className={styles.headline} key={n.id} href={profile(n.prospectId)}>
                <span>
                  <b
                    data-category={n.category
                      .trim()
                      .toLowerCase()
                      .replace(/[\s_]+/g, '-')}
                  >
                    {n.category}
                  </b>
                  <small>
                    {n.createdAt && now
                      ? `${Math.max(0, Math.floor((now - Date.parse(n.createdAt)) / 3600000))}h ago`
                      : `Week ${data.week}`}
                  </small>
                </span>
                <strong>{n.headline}</strong>
              </Link>
            ))}
            {!data.news.length && <p>No draft headlines yet.</p>}
          </section>
        </div>
        <section className={styles.board} aria-label="Top Prospects">
          <header>
            <h2>Top Prospects</h2>
            <div className={styles.filters}>
              <select
                aria-label="Prospect position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">All Positions</option>
                {[...new Set(data.prospects.map((p) => p.position).filter(Boolean))]
                  .sort()
                  .map((p) => (
                    <option key={p!}>{p}</option>
                  ))}
              </select>
              <select
                aria-label="Prospect conference"
                title={
                  !conferences.length ? 'Conference data is unavailable for this class' : undefined
                }
                disabled={!conferences.length}
                value={conference}
                onChange={(e) => setConference(e.target.value)}
              >
                <option value="">All Conferences</option>
                {conferences.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Prospect ranking range"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={100}>All Top 100</option>
                <option value={50}>Top 50</option>
                <option value={32}>First Round</option>
                <option value={9999}>All Prospects</option>
              </select>
            </div>
            <Link href="/front-office/draft/prospects">
              View All <ArrowRight size={12} />
            </Link>
          </header>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  {['Rank', 'Player', 'Pos', 'School', 'HT', 'WT', 'OVR', 'Grade', ''].map(
                    (v, i) => (
                      <th key={i} scope="col">
                        <span className={tableHeading.heading}>{v}</span>
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.currentRank}</td>
                    <td>
                      <Link href={profile(p.id)}>
                        <Avatar p={p} />
                        <strong>{p.name}</strong>
                      </Link>
                    </td>
                    <td>{p.position}</td>
                    <td>{p.school}</td>
                    <td>{p.height ?? '—'}</td>
                    <td>{p.weight ?? '—'}</td>
                    <td>{p.overall ?? '—'}</td>
                    <td>
                      <b className={styles.grade}>{p.scoutGrade}</b>
                    </td>
                    <td>
                      <Link href={profile(p.id)} aria-label={`View ${p.name}`}>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!prospects.length && <p>No prospects match these filters.</p>}
        </section>
      </div>
      <aside className={styles.rail} aria-label="Draft tools">
        <section className={styles.advance}>
          <FrontOfficePhaseControl
            season={save.franchiseYear}
            phase={save.phase}
            freeAgencyWave={save.freeAgencyWave}
          />
        </section>
        <section className={styles.panel}>
          <header>
            <h2>Draft Info</h2>
          </header>
          <div className={styles.draftInfo}>
            <Trophy size={38} />
            <div>
              <strong>{data.draftYear} NFL Draft</strong>
              <p>
                {data.draftInfo
                  ? new Date(data.draftInfo.startsAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Dates to be announced'}
                <br />
                {data.draftInfo?.location ?? 'Location to be announced'}
              </p>
            </div>
          </div>
          <div className={styles.countdown}>
            {['Days', 'Hours', 'Minutes'].map((label, i) => (
              <div key={label}>
                <strong className="front-office-stat-value">{countdown[i]}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <Link className={styles.railLink} href="/front-office/draft/room?mode=mock">
            Draft Order <ChevronRight size={14} />
          </Link>
          <details className={styles.compensatory}>
            <summary>Compensatory Picks</summary>
            <p>
              {picks
                .filter((p) => p.compensatory)
                .map((p) => `R${p.round} · #${p.displayOverall}`)
                .join(', ') || 'No compensatory designations are recorded for this draft capital.'}
            </p>
          </details>
          <Link className={styles.railLink} href="/front-office/draft/history">
            Past Draft Results <ChevronRight size={14} />
          </Link>
        </section>
        <section className={styles.panel}>
          <header>
            <h2>{team?.name.split(' ').slice(-1)[0] ?? save.teamAbbr} Draft Picks</h2>
            <select
              aria-label="Draft picks year"
              value={selectedYear}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </header>
          {picks.map((p) => (
            <Link className={styles.pick} href="/front-office/draft/room?mode=mock" key={p.id}>
              <b>R{p.round}</b>
              <strong>#{p.displayOverall}</strong>
              <ChevronRight size={14} />
            </Link>
          ))}
          {!picks.length && <p>No owned picks in {selectedYear}.</p>}
        </section>
        <section className={styles.panel}>
          <header>
            <h2>Team Needs</h2>
            <Link href="/front-office/draft/team-needs">Edit</Link>
          </header>
          {data.needAnalysis.slice(0, 5).map((n, i) => (
            <Link className={styles.need} href="/front-office/draft/team-needs" key={n.position}>
              <b>{i + 1}</b>
              <span>{n.position}</span>
              <small data-level={n.level}>{n.level === 'Moderate' ? 'Medium' : n.level}</small>
            </Link>
          ))}
          {!data.needAnalysis.length && <p>No team needs identified.</p>}
        </section>
        <section className={styles.panel}>
          <header>
            <h2>Quick Actions</h2>
          </header>
          {[
            ['Start Mock Draft', '/front-office/draft/room?mode=mock'],
            ['Explore Big Board', '/front-office/draft/big-board'],
            ['Compare Prospects', '/front-office/draft/prospects'],
            ['Trade Up/Down', '/front-office/trade-hub'],
          ].map(([label, href]) => (
            <Link className={styles.railLink} href={href} key={label}>
              {label}
              <ChevronRight size={14} />
            </Link>
          ))}
        </section>
      </aside>
    </div>
  );
}
