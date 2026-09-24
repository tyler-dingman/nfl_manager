'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { OwnershipIcon } from '@/components/ui/ownership-icon';
import {
  ownershipProjectIcons,
  ownershipLabelIcons,
  ownershipSectionIcons,
} from './ownership-icons';
import { useSaveStore } from '@/features/save/save-store';
import { TEAM_LIST } from '@/data/teams';
import { useOwnershipStore } from '@/features/ownership/store';
import {
  PROJECTS,
  SPONSORS,
  MAJOR_PROJECTS,
  initialOwnership,
  ownershipMetrics,
  reportCard,
  gradeFor,
  type Project,
  type OwnershipAction,
} from '@/features/ownership/model';
import { apiFetch } from '@/lib/api';
import styles from './ownership.module.css';

type Section =
  | 'central'
  | 'stadium'
  | 'facilities'
  | 'business'
  | 'fans'
  | 'report-card'
  | 'legacy';
const root = '/front-office/ownership';
const dollars = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${n.toFixed(n % 1 ? 1 : 0)}M`;
const impactNames = {
  fans: 'Fan experience',
  revenue: 'Annual revenue ($M)',
  development: 'Development resources',
  recovery: 'Recovery resources',
  appeal: 'Free-agent appeal',
  community: 'Community impact',
};
const fanTabs = [
  'Fan Experience',
  'Ticketing',
  'Community',
  'Digital & Social',
  'Game Day',
  'Fan Feedback',
];
function LabelIcon({ label }: { label: string }) {
  const name = ownershipLabelIcons[label];
  return name ? <OwnershipIcon name={name} size={20} className={styles.labelIcon} /> : null;
}
function Panel({
  title,
  href,
  children,
  className = '',
}: {
  title: string;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <header>
        <h2 className={styles.iconLabel}>
          <LabelIcon label={title} />
          {title}
        </h2>
        {href && (
          <Link href={href} aria-label={`View ${title}`}>
            <ArrowRight size={18} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.meter}>
      <span className={styles.iconLabel}>
        <LabelIcon label={label} />
        {label}
      </span>
      <b>{Math.round(value)}</b>
      <progress max={100} value={value} aria-label={label} />
    </div>
  );
}
function Ring({ value }: { value: number }) {
  return (
    <div className={styles.ring} style={{ '--score': `${value}%` } as CSSProperties}>
      <b className="front-office-stat-value">{Math.round(value)}</b>
    </div>
  );
}
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.iconLabel}>
        <LabelIcon label={label} />
        {label}
      </span>
      <strong className="front-office-stat-value">{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function OwnershipPage({ section }: { section: Section }) {
  const save = useSaveStore();
  const year = save.franchiseYear || 2026;
  const key = save.saveId ? `${save.saveId}:${save.teamAbbr}` : null;
  const week = Number(save.phase.match(/week[- ]?(\d+)/i)?.[1] ?? 0);
  const stored = useOwnershipStore((s) => (key ? s.saves[key] : undefined));
  const act = useOwnershipStore((s) => s.act);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<string | null>(null);
  const [fanTab, setFanTab] = useState('Fan Experience');
  const [ticket, setTicket] = useState(100);
  const [record, setRecord] = useState<{ wins: number; losses: number; ties: number } | null>(null);
  const state = useMemo(() => stored ?? initialOwnership(year), [stored, year]);
  const metrics = ownershipMetrics(state, year);
  const grades = reportCard(state, year);
  const overall = Math.round(grades.reduce((n, g) => n + g.score, 0) / grades.length);
  const team = TEAM_LIST.find((t) => t.abbr === save.teamAbbr);
  const teamName = team?.name ?? 'Your franchise';
  const stadiumCode =
    save.teamAbbr === 'SF'
      ? 'san'
      : save.teamAbbr === 'ARI'
        ? 'az'
        : (save.teamAbbr || 'kc').toLowerCase();
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && key) act(key, year, week, { type: 'advance' });
  }, [act, key, year, week, ready]);
  useEffect(() => {
    setTicket(state.ticketPrice);
  }, [state.ticketPrice]);
  useEffect(() => {
    setImageError(false);
    setReview(null);
    setMessage('');
  }, [key]);
  useEffect(() => {
    if (!save.saveId) return;
    const controller = new AbortController();
    void apiFetch(`/api/front-office/simulate?saveId=${encodeURIComponent(save.saveId)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRecord(data?.state?.teams?.[save.teamAbbr]?.record ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [save.saveId, save.teamAbbr, save.phase]);
  useEffect(() => {
    if (ready && key && record) act(key, year, week, { type: 'record', record });
  }, [act, key, year, week, ready, record]);
  const previousSnapshot = state.snapshots?.[year - 1];
  function dispatch(action: OwnershipAction, text: string) {
    if (!key) return;
    act(key, year, week, action);
    setMessage(text);
    setReview(null);
  }
  function projectCard(p: Project) {
    const scheduled = state.projects.find((x) => x.id === p.id);
    const completed = scheduled?.completed;
    const enough = state.capital >= p.cost;
    return (
      <article className={styles.project} key={p.id} id={p.id}>
        <div className={styles.projectTitle}>
          <OwnershipIcon
            name={ownershipProjectIcons[p.id as keyof typeof ownershipProjectIcons]}
            size={22}
          />
          <h3>{p.name}</h3>
          <span>{completed ? 'Level 4 / 5' : 'Level 3 / 5'}</span>
        </div>
        <p>{p.description}</p>
        <div className={styles.projectMeta}>
          <b>{dollars(p.cost)}</b>
          <span>
            <OwnershipIcon name="project-timeline" size={20} /> {p.weeks} weeks
          </span>
        </div>
        <div className={styles.chips}>
          {Object.entries(p.impacts).map(([k, v]) => (
            <span key={k}>
              +{v} {impactNames[k as keyof typeof impactNames]}
            </span>
          ))}
        </div>
        {scheduled ? (
          <p className={styles.good}>
            {completed
              ? 'Completed'
              : `In progress · ${Math.max(0, scheduled.due - (year * 52 + week))} weeks remaining`}
          </p>
        ) : (
          <>
            <button
              className={styles.secondary}
              onClick={() => setReview(review === p.id ? null : p.id)}
              aria-expanded={review === p.id}
            >
              View Details <ArrowRight size={15} />
            </button>
            {review === p.id && (
              <div className={styles.review}>
                <strong>Approve {p.name}?</strong>
                <p>
                  {dollars(p.cost)} is deducted from ownership capital now. Benefits take effect
                  after {p.weeks} simulation weeks. Player salary cap is separate.
                </p>
                <p>Remaining capital: {dollars(state.capital - p.cost)}</p>
                <button
                  className={styles.primary}
                  disabled={!enough || !key}
                  onClick={() =>
                    dispatch(
                      { type: 'approve', id: p.id },
                      `${p.name} approved. Construction is now in progress.`,
                    )
                  }
                >
                  {enough ? 'Approve project' : 'Insufficient capital'}
                </button>
                <button className={styles.secondary} onClick={() => setReview(null)}>
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </article>
    );
  }
  const stadiumImage = (
    <div className={styles.stadiumArt}>
      {!imageError && (
        <Image
          src={`/images/gameday/stadium/${stadiumCode}/gameday.png`}
          alt={`${teamName} stadium illustration`}
          priority
          fill
          unoptimized
          sizes="(max-width: 767px) 100vw, 60vw"
          onError={() => setImageError(true)}
        />
      )}
      <div>
        <small>HOME OF THE {teamName.toUpperCase()}</small>
        <h3>{teamName} Stadium</h3>
        <p>Stadium rating {Math.min(100, 74 + metrics.effects.fans)} · Your franchise home</p>
      </div>
    </div>
  );
  const kpis = (
    <div className={styles.kpis}>
      <Stat label="Franchise Value" value={dollars(metrics.value)} note="Simulated valuation" />
      <Stat
        label="Annual Revenue"
        value={dollars(metrics.revenue)}
        note="Projected annual revenue"
      />
      <Stat
        label="Operating Income"
        value={dollars(metrics.income)}
        note="After operating expenses"
      />
      <Stat
        label="Available Capital"
        value={dollars(state.capital)}
        note="Separate from salary cap"
      />
    </div>
  );
  const gradeRows = (
    <div className={styles.rows}>
      {grades.slice(0, 6).map((g) => (
        <div key={g.name}>
          <span className={styles.iconLabel}>
            <LabelIcon label={g.name} />
            {g.name}
          </span>
          <b
            className={styles.grade}
            data-tone={g.score >= 80 ? 'good' : g.score < 68 ? 'low' : 'mid'}
          >
            {g.grade}
          </b>
        </div>
      ))}
    </div>
  );
  const activity = (
    <>
      {state.history.length ? (
        state.history.slice(0, 6).map((h) => (
          <div className={styles.activity} key={h.id}>
            <OwnershipIcon name="milestones" size={22} />
            <div>
              <b>{h.text}</b>
              <small>
                {h.year} season {h.cost > 0 ? `· ${dollars(h.cost)} invested` : ''}
              </small>
            </div>
          </div>
        ))
      ) : (
        <p className={styles.muted}>
          Your ownership activity will appear here as you approve projects and make decisions.
        </p>
      )}
    </>
  );
  const snapshot = (
    <>
      <Meter label="Attendance" value={metrics.attendance} />
      <Meter label="Game-day atmosphere" value={metrics.fans} />
      <Meter label="Ticket affordability" value={metrics.affordability} />
      <Meter
        label="Concessions & food"
        value={state.projects.some((p) => p.id === 'concessions' && p.completed) ? 88 : 72}
      />
      <Meter
        label="Parking & transportation"
        value={state.projects.some((p) => p.id === 'transit' && p.completed) ? 85 : 70}
      />
      <Meter label="Fan sentiment" value={metrics.sentiment} />
      <Meter label="Community involvement" value={metrics.community} />
    </>
  );
  const feedback = (
    <>
      <div className={styles.insight}>
        <OwnershipIcon name="fan-sentiment" />
        <div>
          <b>
            {metrics.fans >= 85
              ? 'A game-day experience to be proud of'
              : 'Fans see room for improvement'}
          </b>
          <p>
            {metrics.fans >= 85
              ? 'Recent investments are improving the experience.'
              : 'Convenience, value and access remain priorities.'}
          </p>
        </div>
      </div>
      <div className={styles.insight}>
        <OwnershipIcon name="fan-feedback" />
        <div>
          <b>
            {metrics.affordability < 70
              ? 'Ticket prices are a concern'
              : 'Keep game day accessible'}
          </b>
          <p>
            {metrics.affordability < 70
              ? 'Consider a more affordable ticket policy.'
              : 'Fans value affordable tickets and easy arrival.'}
          </p>
        </div>
      </div>
      <small className={styles.muted}>Simulated feedback based on your current fan metrics.</small>
    </>
  );
  if (!ready) return <div className={styles.page}>Loading Ownership…</div>;
  return (
    <div className={styles.page}>
      <div className={styles.context}>
        <span>
          <OwnershipIcon name={ownershipSectionIcons[section]} size={20} /> {teamName} · {year}{' '}
          Ownership
        </span>
        <small>Simulated ownership metrics · Saved on this device</small>
      </div>
      {!key && <p role="status">Select a franchise to save ownership decisions.</p>}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {section === 'central' && (
        <>
          {kpis}
          <div className={styles.centralGrid}>
            <Panel title="Stadium" href={`${root}/stadium`} className={styles.stadiumPanel}>
              {stadiumImage}
              <div className={styles.actions}>
                <Link href={`${root}/stadium#renovate`}>Renovate Stadium</Link>
                <Link href={`${root}/stadium#new-stadium`}>Build New Stadium</Link>
                <Link href={`${root}/business`}>Naming Rights</Link>
              </div>
            </Panel>
            <Panel title="Player Report Card" href={`${root}/report-card`}>
              <div className={styles.gradeOverview}>
                <strong>{gradeFor(overall)}</strong>
                <div>
                  Overall Grade<small>Organization score {overall}/100</small>
                </div>
              </div>
              {gradeRows}
              <Link className={styles.textLink} href={`${root}/report-card`}>
                View Full Report Card <ArrowRight size={15} />
              </Link>
            </Panel>
            <Panel title="Owner’s Desk">
              <div className={styles.desk}>
                <Link href={`${root}/business`}>
                  <OwnershipIcon name="naming-rights" />
                  <div>
                    <small>BUSINESS OPPORTUNITY</small>
                    <b>
                      {metrics.activePartners.length
                        ? 'Review partnerships'
                        : 'Horizon naming-rights proposal'}
                    </b>
                    <span>Review offer →</span>
                  </div>
                </Link>
                <Link href={`${root}/stadium#renovate`}>
                  <OwnershipIcon name="renovate" />
                  <div>
                    <small>CAPITAL PROJECT</small>
                    <b>Stadium renovation</b>
                    <span>{dollars(140)} · Review project →</span>
                  </div>
                </Link>
                <Link href={`${root}/fans`}>
                  <OwnershipIcon name="fan-insights" />
                  <div>
                    <small>FAN EXPERIENCE</small>
                    <b>
                      {metrics.affordability < 70
                        ? 'Review ticket affordability'
                        : 'Improve arrival and concessions'}
                    </b>
                    <span>View fan insights →</span>
                  </div>
                </Link>
              </div>
            </Panel>
            <Panel title="Facilities" href={`${root}/facilities`}>
              <Meter label="Development resources" value={metrics.development} />
              <Meter label="Health & recovery" value={metrics.recovery} />
              <Meter label="Player amenities / appeal" value={metrics.appeal} />
              <Meter label="Overall facilities" value={metrics.facilities} />
              <Link className={styles.textLink} href={`${root}/facilities`}>
                Manage Facilities →
              </Link>
            </Panel>
            <Panel title="Fan & Market" href={`${root}/fans`}>
              <div className={styles.miniGrid}>
                <Stat label="Fan Approval" value={`${metrics.sentiment}%`} />
                <Stat label="Season Ticket Renewal" value={`${metrics.renewal}%`} />
                <Stat label="Community Impact" value={`${metrics.community}`} />
                <Stat label="Stadium Experience" value={`${metrics.fans}`} />
              </div>
              <Link className={styles.textLink} href={`${root}/fans`}>
                View Fan Insights →
              </Link>
            </Panel>
            <Panel title="Business & Partnerships" href={`${root}/business`}>
              <p className={styles.muted}>Current naming rights</p>
              <h3>
                {metrics.activePartners.some((p) => p.id === 'naming')
                  ? 'Horizon Field'
                  : 'Available for negotiation'}
              </h3>
              <div className={styles.partners}>
                {metrics.activePartners.map((p) => (
                  <span key={p.id}>{SPONSORS.find((s) => s.id === p.id)?.company}</span>
                ))}
              </div>
              <Meter label="Tickets" value={28} />
              <Meter label="Sponsorships" value={22} />
              <Meter label="Merchandise" value={18} />
              <Link className={styles.textLink} href={`${root}/business`}>
                View Full Financials →
              </Link>
            </Panel>
            <Panel title="Recent Ownership Activity" href={`${root}/legacy`}>
              {activity}
            </Panel>
          </div>
        </>
      )}
      {section === 'stadium' && (
        <>
          <div className={styles.sectionTitle}>
            <div>
              <h2 className={styles.iconLabel}>
                <OwnershipIcon name="stadium" />
                Stadium
              </h2>
              <p>Invest in the home your fans return to every season.</p>
            </div>
            <Stat label="Available Capital" value={dollars(state.capital)} />
          </div>
          <div className={styles.twoColumns}>
            <Panel title="Your Stadium">
              {stadiumImage}
              <div className={styles.miniGrid}>
                <Stat
                  label="Stadium Rating"
                  value={String(Math.min(100, 74 + metrics.effects.fans))}
                />
                <Stat
                  label="Active Projects"
                  value={String(
                    state.projects.filter(
                      (p) =>
                        !p.completed && PROJECTS.find((d) => d.id === p.id)?.area === 'stadium',
                    ).length,
                  )}
                />
              </div>
            </Panel>
            <Panel title="Stadium Snapshot">
              <Ring value={metrics.fans} />
              <h3>Fan Experience</h3>
              {snapshot}
            </Panel>
          </div>
          <h2 className={styles.heading}>Stadium Improvements</h2>
          <div className={styles.projectGrid}>
            {PROJECTS.filter((p) => p.area === 'stadium' && !MAJOR_PROJECTS.includes(p.id)).map(
              projectCard,
            )}
          </div>
          <h2 className={styles.heading}>Major Stadium Projects</h2>
          <div className={styles.projectGrid}>
            {PROJECTS.filter((p) => MAJOR_PROJECTS.includes(p.id)).map(projectCard)}
          </div>
        </>
      )}
      {section === 'facilities' && (
        <>
          <div className={styles.sectionTitle}>
            <div>
              <h2 className={styles.iconLabel}>
                <OwnershipIcon name="training-facility" />
                Facilities
              </h2>
              <p>Give your players and staff the resources to improve.</p>
            </div>
            <Stat label="Available Capital" value={dollars(state.capital)} />
          </div>
          <div className={styles.twoColumns}>
            <Panel title={`${teamName} Training Center`}>
              <div className={styles.facilityHero}>
                <OwnershipIcon name="training-facility" size={72} />
                <div>
                  <h3>Build a better environment</h3>
                  <p>
                    Training, recovery, nutrition and player amenities are part of one connected
                    organization.
                  </p>
                </div>
              </div>
              <div className={styles.miniGrid}>
                <Stat label="Overall Rating" value={String(metrics.facilities)} />
                <Stat
                  label="Completed Investments"
                  value={String(
                    state.projects.filter(
                      (p) =>
                        p.completed && PROJECTS.find((d) => d.id === p.id)?.area === 'facilities',
                    ).length,
                  )}
                />
              </div>
            </Panel>
            <Panel title="Category Ratings">
              <Meter label="Development resources" value={metrics.development} />
              <Meter label="Health & recovery resources" value={metrics.recovery} />
              <Meter label="Free-agent appeal" value={metrics.appeal} />
              <p className={styles.muted}>
                Completed investments update these ownership resource ratings and the annual report
                card. They do not directly change player ratings or injury outcomes.
              </p>
            </Panel>
          </div>
          <h2 className={styles.heading}>Facility Upgrades</h2>
          <div className={styles.projectGrid}>
            {PROJECTS.filter((p) => p.area === 'facilities').map(projectCard)}
          </div>
        </>
      )}
      {section === 'business' && (
        <>
          {kpis}
          <div className={styles.twoColumns}>
            <Panel title="Annual Revenue Breakdown">
              {[
                ['Tickets', 28],
                ['Sponsorships', 22],
                ['Naming Rights', 12],
                ['Merchandise', 18],
                ['Concessions', 12],
                ['Other', 8],
              ].map(([label, percent]) => (
                <div key={label}>
                  <Meter label={String(label)} value={Number(percent)} />
                  <small className={styles.muted}>
                    {dollars((metrics.revenue * Number(percent)) / 100)} projected · {percent}%
                    allocation
                  </small>
                </div>
              ))}
            </Panel>
            <Panel title="Current Partnerships">
              {metrics.activePartners.length ? (
                metrics.activePartners.map((p) => {
                  const sponsor = SPONSORS.find((s) => s.id === p.id)!;
                  return (
                    <div className={styles.activity} key={p.id}>
                      <OwnershipIcon name="partnerships" />
                      <div>
                        <b>{sponsor.company}</b>
                        <small>
                          {dollars(sponsor.annual)} / year · {p.year + sponsor.years - year} years
                          remaining
                        </small>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className={styles.muted}>
                  No signed partnerships yet. Review opportunities below.
                </p>
              )}
              <p className={styles.muted}>
                All partner brands are fictional. Signing credits the first annual payment to
                capital.
              </p>
            </Panel>
          </div>
          <h2 className={styles.heading}>Business Opportunities</h2>
          <div className={styles.projectGrid}>
            {SPONSORS.map((s) => {
              const signed = metrics.activePartners.some((p) => p.id === s.id);
              return (
                <article className={styles.project} key={s.id}>
                  <small>PARTNERSHIP OFFER</small>
                  <h3 className={styles.iconLabel}>
                    <OwnershipIcon
                      name={s.id === 'naming' ? 'naming-rights' : 'sponsorship'}
                      size={22}
                    />
                    {s.company}
                  </h3>
                  <p>{s.description}</p>
                  <div className={styles.projectMeta}>
                    <b>{dollars(s.annual)} / year</b>
                    <span>{s.years} years</span>
                  </div>
                  {signed ? (
                    <p className={styles.good}>Active partnership</p>
                  ) : (
                    <>
                      <button
                        className={styles.secondary}
                        onClick={() => setReview(review === s.id ? null : s.id)}
                      >
                        Review offer →
                      </button>
                      {review === s.id && (
                        <div className={styles.review}>
                          <p>
                            Accept a {s.years}-year agreement at {dollars(s.annual)} annually. First
                            payment is credited immediately.
                          </p>
                          <button
                            className={styles.primary}
                            disabled={!key}
                            onClick={() =>
                              dispatch(
                                { type: 'partner', id: s.id },
                                `${s.company} partnership signed.`,
                              )
                            }
                          >
                            Accept agreement
                          </button>
                          <button className={styles.secondary} onClick={() => setReview(null)}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
          <h2 className={styles.heading}>Business Initiatives</h2>
          <div className={styles.projectGrid}>
            {PROJECTS.filter((p) => ['merch', 'concessions', 'markets'].includes(p.id)).map(
              projectCard,
            )}
          </div>
        </>
      )}
      {section === 'fans' && (
        <>
          <div className={styles.fansHero}>
            <OwnershipIcon name="fans" size={36} />
            <div>
              <small>FRONT OFFICE · OWNERSHIP · FANS</small>
              <h2>Fans</h2>
              <p>
                Passionate fans fuel winning. Invest in the game-day experience and your community.
              </p>
            </div>
          </div>
          <nav className={styles.fanNav} aria-label="Fans sections">
            {fanTabs.map((t) => (
              <button key={t} aria-pressed={fanTab === t} onClick={() => setFanTab(t)}>
                {t}
              </button>
            ))}
          </nav>
          {fanTab === 'Fan Experience' && (
            <div className={styles.fanGrid}>
              <div>
                <Panel title="Fan Experience Rating">
                  <div className={styles.ratingFeature}>
                    <div>
                      <Ring value={metrics.fans} />
                      <small>League rank: not yet available</small>
                    </div>
                    <div>
                      <h3>
                        {metrics.fans >= 85
                          ? 'A top-tier fan experience'
                          : 'Build a stronger fan experience'}
                      </h3>
                      <p>
                        Keep investing in access, affordability and atmosphere for {teamName} fans.
                      </p>
                      <div className={styles.miniGrid}>
                        <Stat label="Attendance" value={`${metrics.attendance}%`} />
                        <Stat label="Fan Sentiment" value={String(metrics.sentiment)} />
                        <Stat label="Season Ticket Renewal" value={`${metrics.renewal}%`} />
                        <Stat label="Community Impact" value={String(metrics.community)} />
                      </div>
                    </div>
                  </div>
                </Panel>
                <div className={styles.twoColumns}>
                  <Panel title="Key Fan Insights">
                    <div className={styles.insight}>
                      <OwnershipIcon name="attendance" />
                      <div>
                        <b>{metrics.attendance}% projected attendance</b>
                        <p>Fan experience and pricing influence demand.</p>
                      </div>
                    </div>
                    <div className={styles.insight}>
                      <OwnershipIcon name="fan-insights" />
                      <div>
                        <b>Improve convenience</b>
                        <p>
                          Concessions, connectivity and entry upgrades improve the fan experience.
                        </p>
                      </div>
                    </div>
                    <div className={styles.insight}>
                      <OwnershipIcon name="digital-social" />
                      <div>
                        <b>Fans want more team access</b>
                        <p>Community and digital initiatives build lasting connections.</p>
                      </div>
                    </div>
                  </Panel>
                  <Panel title="Featured Initiative">
                    {projectCard(PROJECTS.find((p) => p.id === 'transit')!)}
                  </Panel>
                </div>
              </div>
              <aside>
                <Link className={styles.primary} href={`${root}/stadium`}>
                  Make an Improvement <ArrowRight size={18} />
                </Link>
                <Panel title="Fan Snapshot">{snapshot}</Panel>
                <Panel title="What Fans Are Saying">{feedback}</Panel>
              </aside>
            </div>
          )}
          {fanTab === 'Ticketing' && (
            <div className={styles.twoColumns}>
              <Panel title="Ticketing Policy">
                <p>Balance ticket income against affordability and fan sentiment.</p>
                <label className={styles.field}>
                  Average ticket price ($)
                  <input
                    type="number"
                    min={50}
                    max={250}
                    value={ticket}
                    onChange={(e) => setTicket(Number(e.target.value))}
                  />
                </label>
                <p className={styles.muted}>
                  Allowed range: $50–$250. Current policy: ${state.ticketPrice}.
                </p>
                <button
                  className={styles.primary}
                  disabled={!key || ticket < 50 || ticket > 250 || ticket === state.ticketPrice}
                  onClick={() =>
                    dispatch(
                      { type: 'ticket', price: ticket },
                      'Ticket policy updated. Revenue and fan projections have been recalculated.',
                    )
                  }
                >
                  Apply ticket policy
                </button>
              </Panel>
              <Panel title="Fan & Revenue Impact">
                <Meter label="Affordability" value={metrics.affordability} />
                <Meter label="Fan sentiment" value={metrics.sentiment} />
                <Stat label="Projected Revenue" value={dollars(metrics.revenue)} />
              </Panel>
            </div>
          )}
          {['Community', 'Digital & Social', 'Game Day'].includes(fanTab) && (
            <div className={styles.projectGrid}>
              {PROJECTS.filter((p) =>
                fanTab === 'Community'
                  ? p.id === 'community'
                  : fanTab === 'Digital & Social'
                    ? ['digital', 'wifi'].includes(p.id)
                    : ['transit', 'concessions', 'gates', 'sound'].includes(p.id),
              ).map(projectCard)}
            </div>
          )}
          {fanTab === 'Fan Feedback' && (
            <div className={styles.twoColumns}>
              <Panel title="What Fans Are Saying">{feedback}</Panel>
              <Panel title="Fan Snapshot">{snapshot}</Panel>
            </div>
          )}
        </>
      )}
      {section === 'report-card' && (
        <>
          <div className={styles.sectionTitle}>
            <div>
              <h2 className={styles.iconLabel}>
                <OwnershipIcon name="report-card" />
                {year} Organizational Report Card
              </h2>
              <p>Investment decisions shape the environment around your players.</p>
            </div>
            <div className={styles.gradeOverview}>
              <strong>{gradeFor(overall)}</strong>
              <div>
                Overall Grade<small>{overall}/100 · League rank pending</small>
              </div>
            </div>
          </div>
          <p className={styles.muted}>
            {previousSnapshot
              ? `Previous season: ${gradeFor(previousSnapshot.grade)}. Organization score ${overall - previousSnapshot.grade >= 0 ? '+' : ''}${overall - previousSnapshot.grade} versus ${year - 1}.`
              : 'Previous-year comparison will be available after a full ownership season.'}{' '}
            Grades are simulation ratings, not an NFLPA survey.
          </p>
          <div className={styles.projectGrid}>
            {grades.map((g) => (
              <Panel title={g.name} key={g.name}>
                <div className={styles.gradeOverview}>
                  <strong>{g.grade}</strong>
                  <div>
                    {g.score.toFixed(0)} / 100
                    <small>
                      {state.projects.some((p) => p.id === g.projectId && p.completed)
                        ? '↑ Improved by completed investment'
                        : 'Baseline · Investment opportunity'}
                    </small>
                  </div>
                </div>
                <p>{PROJECTS.find((p) => p.id === g.projectId)?.description}</p>
                <Link
                  className={styles.textLink}
                  href={`${root}/${PROJECTS.find((p) => p.id === g.projectId)?.area === 'fans' ? 'fans' : 'facilities'}#${g.projectId}`}
                >
                  Suggested improvement →
                </Link>
              </Panel>
            ))}
          </div>
        </>
      )}
      {section === 'legacy' && (
        <>
          <div className={styles.sectionTitle}>
            <div>
              <h2 className={styles.iconLabel}>
                <OwnershipIcon name="legacy" />
                Your Ownership Legacy
              </h2>
              <p>The decisions that shape your franchise over time.</p>
            </div>
          </div>
          <div className={styles.kpis}>
            <Stat
              label="Owner Tenure"
              value={`${Math.max(1, year - state.startedYear + 1)} seasons`}
              note={`Since ${state.startedYear}`}
            />
            <Stat
              label="Franchise Value Growth"
              value={`${((metrics.value / 6400 - 1) * 100).toFixed(1)}%`}
              note="Since ownership began"
            />
            <Stat
              label="Capital Invested"
              value={dollars(state.history.reduce((n, h) => n + Math.max(0, h.cost), 0))}
            />
            <Stat
              label="Current Record"
              value={
                record
                  ? `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ''}`
                  : '—'
              }
              note="Current simulation season"
            />
          </div>
          <div className={styles.twoColumns}>
            <Panel title="Franchise Milestones">
              <div className={styles.rows}>
                <div>
                  <span>Championships</span>
                  <b>Not recorded yet</b>
                </div>
                <div>
                  <span>Playoff appearances</span>
                  <b>Not recorded yet</b>
                </div>
                <div>
                  <span>Completed stadium projects</span>
                  <b>
                    {
                      state.projects.filter(
                        (p) =>
                          p.completed && PROJECTS.find((d) => d.id === p.id)?.area === 'stadium',
                      ).length
                    }
                  </b>
                </div>
                <div>
                  <span>Facility investment</span>
                  <b>
                    {dollars(
                      state.projects.reduce(
                        (n, p) =>
                          n +
                          (PROJECTS.find((d) => d.id === p.id && d.area === 'facilities')?.cost ??
                            0),
                        0,
                      ),
                    )}
                  </b>
                </div>
                <div>
                  <span>Community investment</span>
                  <b>{dollars(state.projects.some((p) => p.id === 'community') ? 5 : 0)}</b>
                </div>
                <div>
                  <span>Business agreements</span>
                  <b>{state.partnerships.length}</b>
                </div>
                <div>
                  <span>Current fan approval</span>
                  <b>{metrics.sentiment}%</b>
                </div>
              </div>
            </Panel>
            <Panel title="Season & Fan Approval History">
              {Object.values(state.snapshots ?? {})
                .sort((a, b) => b.year - a.year)
                .map((s) => (
                  <div className={styles.activity} key={s.year}>
                    <OwnershipIcon name="win-loss-history" size={22} />
                    <div>
                      <b>
                        {s.year} · Fan approval {s.fans}% · {dollars(s.value)} franchise value
                      </b>
                      <small>
                        Organization grade {gradeFor(s.grade)} · Record{' '}
                        {s.record
                          ? `${s.record.wins}–${s.record.losses}–${s.record.ties}`
                          : 'Not recorded'}
                      </small>
                    </div>
                  </div>
                ))}
            </Panel>
            <Panel title="Ownership Timeline">
              {activity}
              {state.history.slice(6).map((h) => (
                <div className={styles.activity} key={h.id}>
                  <OwnershipIcon name="legacy" size={22} />
                  <div>
                    <b>{h.text}</b>
                    <small>{h.year}</small>
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
