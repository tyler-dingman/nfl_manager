'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardList,
  Lightbulb,
  RotateCcw,
  Target,
} from 'lucide-react';
import { DdSearchIcon as Search } from '@/components/ui/football-icons';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSaveStore } from '@/features/save/save-store';
import { computeTeamNeeds } from '@/lib/team-overview';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';
import styles from './draft-guide-page.module.css';

type View =
  | 'overview'
  | 'top'
  | 'position'
  | 'round'
  | 'fits'
  | 'strategy'
  | 'history'
  | 'articles';
type Insight = 'class' | 'depth' | 'value' | null;
const links: Array<[View, string]> = [
  ['overview', 'Overview'],
  ['top', 'Top Prospects'],
  ['position', 'By Position'],
  ['round', 'By Round'],
  ['fits', 'Team Fits'],
  ['strategy', 'Draft Strategies'],
  ['history', 'Historical Trends'],
  ['articles', 'Articles & Analysis'],
];
const gradeScore = (grade: string | null) =>
  ({ 'A+': 12, A: 11, 'A-': 10, 'B+': 9, B: 8, 'B-': 7, 'C+': 6, C: 5 })[
    grade?.toUpperCase() as 'A+'
  ] ?? 0;

export function DraftGuidePage({ prospects }: { prospects: DraftProspectRecord[] }) {
  const roster = useSaveStore((state) => state.roster);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const needs = useMemo(() => computeTeamNeeds(roster), [roster]);
  const year = prospects.find((item) => item.draftYear)?.draftYear ?? 2027;
  const [view, setView] = useState<View>('overview');
  const [insight, setInsight] = useState<Insight>(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [school, setSchool] = useState('ALL');
  const [sort, setSort] = useState<'rank' | 'grade' | 'position' | 'school'>('rank');
  const positions = useMemo(
    () =>
      [
        ...new Set(
          prospects.map((item) => item.position).filter((item): item is string => Boolean(item)),
        ),
      ].sort(),
    [prospects],
  );
  const schools = useMemo(
    () =>
      [
        ...new Set(
          prospects.map((item) => item.school).filter((item): item is string => Boolean(item)),
        ),
      ].sort(),
    [prospects],
  );
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const source =
      view === 'fits'
        ? prospects.filter((item) => needs.some((need) => String(need) === item.position))
        : prospects;
    return source
      .filter(
        (item) =>
          (!text ||
            `${item.name} ${item.school ?? ''} ${item.position ?? ''}`
              .toLowerCase()
              .includes(text)) &&
          (position === 'ALL' || item.position === position) &&
          (school === 'ALL' || item.school === school),
      )
      .slice()
      .sort((a, b) =>
        sort === 'grade'
          ? gradeScore(b.grade) - gradeScore(a.grade)
          : sort === 'position'
            ? (a.position ?? '').localeCompare(b.position ?? '')
            : sort === 'school'
              ? (a.school ?? '').localeCompare(b.school ?? '')
              : (a.ranking ?? 999) - (b.ranking ?? 999),
      );
  }, [needs, position, prospects, query, school, sort, view]);
  const depth = useMemo(
    () =>
      positions
        .map((pos) => ({
          position: pos,
          count: prospects.filter((item) => item.position === pos && (item.ranking ?? 999) <= 100)
            .length,
          top: prospects
            .filter((item) => item.position === pos)
            .sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999))
            .slice(0, 3),
        }))
        .sort((a, b) => b.count - a.count),
    [positions, prospects],
  );
  const rounds = useMemo(() => {
    const groups = new Map<string, DraftProspectRecord[]>();
    prospects.forEach((item) => {
      const key = item.projectedRange ?? 'Range not available';
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return [...groups.entries()];
  }, [prospects]);
  const reset = () => {
    setQuery('');
    setPosition('ALL');
    setSchool('ALL');
    setSort('rank');
  };

  const table = (
    <section className={styles.prospectPanel}>
      <header>
        <div>
          <h2>{view === 'fits' ? `${teamAbbr ?? 'Team'} Fits` : 'Top Prospects'}</h2>
          <p>
            {view === 'fits'
              ? `Prospects aligned with current needs: ${needs.join(', ') || 'No needs available'}.`
              : `The top players in the ${year} NFL Draft, based on consensus rankings and stored scouting data.`}
          </p>
        </div>
        <Link href="/front-office/draft/prospects">
          View full rankings <ArrowRight />
        </Link>
      </header>
      <div className={styles.tableHeader}>
        <span>Rank</span>
        <span>Player</span>
        <span>Pos</span>
        <span>School</span>
        <span>Height / Weight</span>
        <span>D&amp;D Grade</span>
        <span>Scouting Summary</span>
        <span />
      </div>
      <div>
        {filtered.slice(0, 10).map((item) => (
          <Link
            className={styles.prospectRow}
            href={`/front-office/draft/prospects/${item.id}`}
            key={item.id}
          >
            <strong>{item.ranking ?? '—'}</strong>
            <span className={styles.player}>
              {item.headshotUrl ? (
                <Image src={item.headshotUrl} alt="" width={34} height={34} unoptimized />
              ) : (
                <i>
                  {item.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')}
                </i>
              )}
              <b>{item.name}</b>
            </span>
            <span>{item.position ?? '—'}</span>
            <span className={styles.school}>
              {item.schoolLogo ? (
                <Image src={item.schoolLogo} alt="" width={23} height={23} unoptimized />
              ) : null}
              {item.school ?? '—'}
            </span>
            <span>
              {item.height ?? ''}
              {item.weight ? <small>{item.weight} lbs</small> : null}
            </span>
            <b className={styles.grade} data-grade={item.grade?.charAt(0)}>
              {item.grade ?? '—'}
            </b>
            <span className={styles.summary}>
              {item.summary ?? 'Scouting summary not added yet.'}
            </span>
            <ArrowRight />
          </Link>
        ))}
      </div>
      {!filtered.length ? (
        <div className={styles.empty}>No prospects match these filters.</div>
      ) : null}
    </section>
  );
  const center = insight ? (
    <InsightDetail
      insight={insight}
      prospects={prospects}
      positions={positions}
      depth={depth}
      year={year}
      onBack={() => setInsight(null)}
    />
  ) : view === 'position' ? (
    <GroupView
      title="By Position"
      copy="Position depth and leading prospects from the consensus board."
      groups={depth.map((item) => [item.position, `${item.count} top-100`, item.top])}
    />
  ) : view === 'round' ? (
    <GroupView
      title="By Round"
      copy="Grouped using each prospect’s stored projected range."
      groups={rounds.map(([label, items]) => [
        label,
        `${items.length} prospects`,
        items.slice(0, 5),
      ])}
    />
  ) : view === 'strategy' ? (
    <section className={styles.strategy}>
      <h2>Draft Strategies</h2>
      <p>Guidance based on current roster needs and class depth.</p>
      {needs.slice(0, 5).map((need) => {
        const count = depth.find((item) => item.position === need)?.count ?? 0;
        return (
          <article key={need}>
            <Target />
            <div>
              <h3>{need}</h3>
              <p>
                {count >= 6
                  ? `${count} top-100 prospects provide flexibility to wait for value.`
                  : `Only ${count} top-100 prospects are tracked; prioritize the position when value aligns.`}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  ) : view === 'history' ? (
    <Empty
      icon={<BarChart3 />}
      title="Historical trends are not available yet"
      copy="This section will activate when verified historical draft data is connected."
    />
  ) : view === 'articles' ? (
    <Empty
      icon={<BookOpen />}
      title="Draft analysis is coming"
      copy="Published Down & Distance draft coverage will appear here as the class takes shape."
    />
  ) : (
    table
  );
  return (
    <div className={styles.page}>
      <aside className={styles.left}>
        <nav>
          {links.map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={view === key}
              onClick={() => {
                setView(key);
                setInsight(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <section className={styles.filters}>
          <h2>Filters</h2>
          <label>
            Class
            <select disabled value={year}>
              <option value={year}>{year} NFL Draft</option>
            </select>
          </label>
          <label>
            Position
            <select value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="ALL">All positions</option>
              {positions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            School
            <select value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="ALL">All schools</option>
              {schools.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="rank">Consensus rank</option>
              <option value="grade">D&amp;D Grade</option>
              <option value="position">Position</option>
              <option value="school">School</option>
            </select>
          </label>
          <label className={styles.search}>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prospects"
            />
          </label>
          <button type="button" onClick={reset}>
            <RotateCcw /> Reset filters
          </button>
        </section>
      </aside>
      <main>{center}</main>
      <aside className={styles.right}>
        <section>
          <h2>Draft Insights</h2>
          <InsightButton
            icon={<Lightbulb />}
            title="Draft Class Overview"
            copy="Key metrics from the current class."
            onClick={() => setInsight('class')}
          />
          <InsightButton
            icon={<ClipboardList />}
            title="Strengths & Weaknesses"
            copy="Position depth based on rankings."
            onClick={() => setInsight('depth')}
          />
          <InsightButton
            icon={<Target />}
            title="Best Value Opportunities"
            copy="Grades compared with consensus rank."
            onClick={() => setInsight('value')}
          />
        </section>
        <section>
          <h2>Featured Analysis</h2>
          <div className={styles.analysisEmpty}>
            Draft analysis is coming as the class takes shape.
          </div>
        </section>
        <section className={styles.boardCta}>
          <ClipboardList />
          <div>
            <h2>Build Your Board</h2>
            <p>Add prospects to your Big Board and create your custom rankings.</p>
            <Link href="/front-office/draft/big-board">
              Go to Big Board <ArrowRight />
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}

function InsightButton({
  icon,
  title,
  copy,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.insightButton} onClick={onClick}>
      {icon}
      <span>
        <b>{title}</b>
        <small>{copy}</small>
      </span>
      <ArrowRight />
    </button>
  );
}
function Empty({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <section className={styles.emptyState}>
      {icon}
      <h2>{title}</h2>
      <p>{copy}</p>
    </section>
  );
}
function GroupView({
  title,
  copy,
  groups,
}: {
  title: string;
  copy: string;
  groups: Array<[string, string, DraftProspectRecord[]]>;
}) {
  return (
    <section className={styles.groupView}>
      <h2>{title}</h2>
      <p>{copy}</p>
      {groups.map(([label, count, items]) => (
        <article key={label}>
          <h3>
            {label}
            <span>{count}</span>
          </h3>
          {items.map((item) => (
            <Link key={item.id} href={`/front-office/draft/prospects/${item.id}`}>
              {item.ranking}. {item.name}
              <b>{item.grade ?? item.position}</b>
            </Link>
          ))}
        </article>
      ))}
    </section>
  );
}
function InsightDetail({
  insight,
  prospects,
  positions,
  depth,
  year,
  onBack,
}: {
  insight: Exclude<Insight, null>;
  prospects: DraftProspectRecord[];
  positions: string[];
  depth: Array<{ position: string; count: number }>;
  year: number;
  onBack: () => void;
}) {
  const values = prospects
    .filter((item) => gradeScore(item.grade) >= 9 && (item.ranking ?? 0) > 20)
    .sort((a, b) => gradeScore(b.grade) - gradeScore(a.grade))
    .slice(0, 8);
  return (
    <section className={styles.insightDetail}>
      <button type="button" onClick={onBack}>
        ← Back to overview
      </button>
      <h2>
        {insight === 'class'
          ? 'Draft Class Overview'
          : insight === 'depth'
            ? 'Strengths & Weaknesses'
            : 'Best Value Opportunities'}
      </h2>
      <p>
        {insight === 'class'
          ? `${prospects.length} prospects are tracked for the ${year} class across ${positions.length} positions.`
          : insight === 'depth'
            ? 'Depth is based on prospects ranked inside the consensus top 100.'
            : 'Stronger stored grades compared with later consensus positions.'}
      </p>
      <div>
        {insight === 'value'
          ? values.map((item) => (
              <Link key={item.id} href={`/front-office/draft/prospects/${item.id}`}>
                <b>{item.name}</b>Rank {item.ranking} · {item.grade}
              </Link>
            ))
          : depth.slice(0, 8).map((item) => (
              <span key={item.position}>
                <b>{item.position}</b>
                {item.count >= 6
                  ? 'Deeper group'
                  : item.count >= 3
                    ? 'Moderate depth'
                    : 'Limited top-100 depth'}
              </span>
            ))}
      </div>
    </section>
  );
}
