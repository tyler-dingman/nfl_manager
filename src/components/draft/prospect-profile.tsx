'use client';
import * as React from 'react';
import { Star, ChevronDown, ArrowRight } from 'lucide-react';
import { resolveCollegeBrandTheme } from '@/lib/college-brand-themes';
import { getCollegeLogoUrl } from '@/server/collegeLogos';
import { buildProspectDetailsModel, type ProspectDetailsModel } from '@/lib/draft-prospect-details';
import { useTeamStore } from '@/features/team/team-store';
import { useSaveStore } from '@/features/save/save-store';
import type { PlayerRowDTO } from '@/types/player';
import type { DraftBoardEntry } from '@/lib/draft-board';
import type { SearchResult } from '@/features/search/types';
import { apiFetch } from '@/lib/api';
import styles from './prospect-profile.module.css';

const tabs = ['Overview', 'Stats', 'Film', 'Analysis', 'Comparisons', 'News'] as const;
type Tab = (typeof tabs)[number];
type Props = {
  player: PlayerRowDTO;
  model: ProspectDetailsModel;
  teamAbbr?: string;
  teamNeeds: string[];
  boardEntry?: DraftBoardEntry | null;
  year: number;
  isOnBoard: boolean;
  onToggleBoard: () => void;
  canDraft: boolean;
  draftBusy: boolean;
  onDraft?: () => void;
  navigation: React.ReactNode;
};
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Info({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className={styles.info}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ProspectProfile({
  player,
  model,
  teamAbbr,
  year,
  isOnBoard,
  onToggleBoard,
  canDraft,
  draftBusy,
  onDraft,
  navigation,
}: Props) {
  const [tab, setTab] = React.useState<Tab>('Overview');
  const [showFits, setShowFits] = React.useState(false);
  const [failedPhoto, setFailedPhoto] = React.useState(false);
  const [failedLogo, setFailedLogo] = React.useState(false);
  const teams = useTeamStore((s) => s.teams);
  const savedTeam = useSaveStore((s) => s.teamAbbr);
  const activeTeam = teams.find((t) => t.abbr === (teamAbbr ?? savedTeam));
  const theme = resolveCollegeBrandTheme(model.school);
  const logo = getCollegeLogoUrl(model.school);
  const projection =
    player.projectedRange || player.projectedPick || player.rank ? model.projectedRange : null;
  const rank = player.rank;
  const physical = [
    player.height,
    player.weight ? `${player.weight} lbs` : null,
    player.age ? `Age ${player.age}` : null,
  ].filter(Boolean);
  const knownInfo: Array<[string, React.ReactNode]> = [
    ['Position', player.position],
    ['School', model.school],
  ];
  if (player.classYear && !player.classYear.includes('Draft'))
    knownInfo.push(['Class', player.classYear]);
  if (player.age) knownInfo.push(['Age', player.age]);
  if (player.height) knownInfo.push(['Height', player.height]);
  if (player.weight) knownInfo.push(['Weight', `${player.weight} lbs`]);
  const fits = React.useMemo(
    () =>
      teams
        .map((t) => ({
          team: t,
          fit: buildProspectDetailsModel({ player, teamNeeds: t.allTeamNeeds ?? t.teamNeeds }),
        }))
        .sort((a, b) => b.fit.fitScore - a.fit.fitScore),
    [player, teams],
  );
  const tabId = React.useId();
  const fitCard = (
    <Card title="Team Fit">
      <div className={styles.fit}>
        <div
          className={styles.fitCircle}
          style={{ '--fit': `${model.fitScore}%` } as React.CSSProperties}
        >
          <strong className="front-office-stat-value">{model.fitScore}</strong>
          <small>Fit Score</small>
        </div>
        <div>
          <b>{activeTeam?.name ?? 'Your team'}</b>
          <p>{model.fitLabel}</p>
        </div>
      </div>
      <p>{model.fitReason}</p>
      <button
        className={styles.textLink}
        onClick={() => {
          setTab('Analysis');
          setShowFits(true);
        }}
      >
        View Team Fits <ArrowRight size={15} />
      </button>
    </Card>
  );
  return (
    <div className={styles.scroll}>
      <header
        className={styles.hero}
        style={
          {
            '--college-primary': theme?.primary ?? '#17334c',
            '--player-accent': theme?.primary ?? '#17334c',
            '--college-secondary': theme?.secondary ?? '#a6b6c5',
          } as React.CSSProperties
        }
      >
        <div className={styles.utility}>
          <span>DRAFT PROSPECT</span>
          <nav aria-label="Prospect navigation">{navigation}</nav>
        </div>
        <span className={styles.rankBackdrop} aria-hidden="true">
          {player.position}
        </span>
        <div className={styles.portrait}>
          {model.headshotUrl && !failedPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.headshotUrl} alt={model.name} onError={() => setFailedPhoto(true)} />
          ) : (
            <span>
              {player.firstName[0]}
              {player.lastName[0]}
            </span>
          )}
        </div>
        <div className={styles.identity}>
          <span className={styles.firstName}>{player.firstName}</span>
          <h2>
            {player.lastName}
            <small>{player.position}</small>
          </h2>
          <p className={styles.schoolLine}>
            <Star size={16} />
            {model.school}
            {rank ? ` · #${rank}` : ''}
          </p>
          {physical.length > 0 && <p>{physical.join('  |  ')}</p>}
          {player.archetype && <p>{player.archetype}</p>}
          {model.indicators
            .filter(
              (i) =>
                (player.rating ?? player.maddenRating) != null &&
                ['pro-ready', 'needs-dev'].includes(i.key),
            )
            .slice(0, 1)
            .map((i) => (
              <span className={styles.badge} key={i.key}>
                {i.label}
              </span>
            ))}
        </div>
        <div className={styles.schoolMark} aria-hidden="true">
          {logo && !failedLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" onError={() => setFailedLogo(true)} />
          ) : (
            <span>{theme?.displayName ?? model.school}</span>
          )}
        </div>
        {projection && (
          <div className={styles.projectionHero}>
            <small>PROJECTED</small>
            <strong>{projection}</strong>
            {rank && rank <= 32 ? <span>Round 1</span> : null}
          </div>
        )}
      </header>
      <div className={styles.tabBar}>
        <div role="tablist" aria-label="Prospect profile sections" className={styles.tabs}>
          {tabs.map((t, i) => (
            <button
              role="tab"
              id={`${tabId}-${t}`}
              aria-controls={`${tabId}-panel`}
              aria-selected={tab === t}
              tabIndex={tab === t ? 0 : -1}
              key={t}
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  e.preventDefault();
                  const index =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? tabs.length - 1
                        : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                  setTab(tabs[index]);
                  document.getElementById(`${tabId}-${tabs[index]}`)?.focus();
                }
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <button onClick={onToggleBoard}>{isOnBoard ? '✓ On My Board' : '+ Add to Board'}</button>
          <button
            onClick={onToggleBoard}
            aria-label={isOnBoard ? 'Remove from My Board' : 'Add to My Board'}
            aria-pressed={isOnBoard}
          >
            <Star size={17} fill={isOnBoard ? 'currentColor' : 'none'} />
          </button>
          {canDraft && onDraft && (
            <button className={styles.draft} disabled={draftBusy} onClick={onDraft}>
              {draftBusy ? 'Drafting…' : 'Draft Player'}
            </button>
          )}
          <details>
            <summary>
              Draft Actions <ChevronDown size={15} />
            </summary>
            <div>
              <button onClick={onToggleBoard}>
                {isOnBoard ? 'Remove from My Board' : 'Add to My Board'}
              </button>
              <button onClick={() => setTab('Comparisons')}>Compare Prospect</button>
              <button
                onClick={() => {
                  setTab('Analysis');
                  setShowFits(true);
                }}
              >
                View Team Fit
              </button>
            </div>
          </details>
        </div>
      </div>
      <div
        className={styles.content}
        role="tabpanel"
        id={`${tabId}-panel`}
        aria-labelledby={`${tabId}-${tab}`}
        tabIndex={0}
      >
        {tab === 'Overview' && (
          <div className={styles.overview}>
            <div className={styles.column}>
              <Card title="Player Summary">
                <p>{model.summary}</p>
              </Card>
              <div className={styles.scouting}>
                <Card title="Strengths">
                  <ul className={styles.strengths}>
                    {model.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Card>
                <Card title="Weaknesses">
                  <ul className={styles.weaknesses}>
                    {model.weaknesses.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Card>
              </div>
              <p className={styles.note}>
                Strengths and weaknesses reflect the existing Down & Distance positional assessment.
              </p>
            </div>
            <div className={styles.column}>
              <Card title="Key Info">
                <Info rows={knownInfo} />
              </Card>
              <Card title="Physical Measurables">
                <Info
                  rows={[
                    ['Height', player.height ?? 'N/A'],
                    ['Weight', player.weight ? `${player.weight} lbs` : 'N/A'],
                    ['Arm length', 'N/A'],
                    ['Hand size', 'N/A'],
                    ['40-yard dash', 'N/A'],
                    ['Vertical jump', 'N/A'],
                  ]}
                />
              </Card>
            </div>
            <div className={styles.column}>
              <Card title="Draft Projection">
                <strong className={styles.projection}>
                  {projection ?? 'Projection not available'}
                </strong>
                {rank && (
                  <p>
                    {player.source === 'tankathon' ? 'Tankathon rank' : 'Board rank'}:{' '}
                    <b>#{rank}</b>
                  </p>
                )}
                <p>{year} Draft</p>
              </Card>
              {fitCard}
            </div>
          </div>
        )}
        {tab === 'Stats' && (
          <Card title="College Production">
            {Object.entries(player.stats ?? {}).filter(([, v]) => typeof v === 'number').length ? (
              <Info
                rows={Object.entries(player.stats ?? {})
                  .filter(([, v]) => typeof v === 'number')
                  .map(([k, v]) => [
                    k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
                    String(v),
                  ])}
              />
            ) : (
              <p>College statistics are not yet available for {model.name}.</p>
            )}
          </Card>
        )}
        {tab === 'Analysis' && (
          <div className={styles.analysis}>
            <div className={styles.column}>
              <Card title="Scouting Analysis">
                <p>{model.outlook}</p>
                {player.archetype && <Info rows={[['Player archetype', player.archetype]]} />}
                <p className={styles.note}>Down & Distance evaluation</p>
              </Card>
              {showFits && (
                <Card title="Team Fits">
                  <p className={styles.note}>
                    Need-based fit using current team needs. Your team&apos;s score also considers
                    current board value.
                  </p>
                  <Info
                    rows={fits.map(({ team, fit }) => [
                      team.name,
                      `${fit.fitScore} · ${fit.fitLabel}`,
                    ])}
                  />
                </Card>
              )}
            </div>
            {fitCard}
          </div>
        )}
        {tab === 'Comparisons' && (
          <Card title="NFL Comparisons">
            <p>A sourced NFL comparison is not yet available for {model.name}.</p>
          </Card>
        )}
        {(tab === 'Film' || tab === 'News') && (
          <ProspectContent name={model.name} teamAbbr={activeTeam?.abbr} kind={tab} />
        )}
      </div>
    </div>
  );
}
function ProspectContent({
  name,
  teamAbbr,
  kind,
}: {
  name: string;
  teamAbbr?: string;
  kind: 'Film' | 'News';
}) {
  const [items, setItems] = React.useState<SearchResult[]>([]);
  const [status, setStatus] = React.useState('loading');
  React.useEffect(() => {
    let active = true;
    setStatus('loading');
    void (async () => {
      try {
        const response = await apiFetch('/api/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: name,
            teamId: teamAbbr ?? 'KC',
            limit: 25,
            includeAnswer: false,
          }),
        });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (active) {
          setItems(
            (body.results ?? []).filter((r: SearchResult) =>
              `${r.title} ${r.summary}`.toLowerCase().includes(name.toLowerCase()),
            ),
          );
          setStatus('ready');
        }
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [name, teamAbbr]);
  const visible = items.filter((r) =>
    kind === 'Film'
      ? ['video', 'press_conference'].includes(r.type)
      : ['story', 'article', 'injury'].includes(r.type),
  );
  return (
    <Card title={kind === 'Film' ? 'Prospect Film' : 'Prospect News'}>
      {status === 'loading' ? (
        <p>Loading indexed coverage…</p>
      ) : status === 'error' ? (
        <p>Coverage is temporarily unavailable. Reopen this tab to try again.</p>
      ) : visible.length ? (
        visible.map((r) => (
          <article className={styles.story} key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.title} ↗
            </a>
            <p>{r.summary}</p>
            <small>{r.sourceName}</small>
          </article>
        ))
      ) : (
        <p>
          No {kind.toLowerCase()} is currently indexed for {name}.
        </p>
      )}
    </Card>
  );
}
