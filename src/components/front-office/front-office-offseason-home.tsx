'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarDays, ChevronRight, Trophy } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { frontOfficeHomePhase } from '@/lib/front-office-home-phase';
import { phaseDisplayName } from '@/lib/front-office-phase';
import { formatMoneyMillions } from '@/server/logic/cap';
import { useProspectBoard } from '@/components/draft/use-prospect-board';
import type { PlayerRowDTO } from '@/types/player';
import type { DraftCentralHomeData } from './draft-central/DraftCentralPage';
import { FrontOfficeFeatureHeading } from './front-office-feature-heading';
import styles from './front-office-home.module.css';

export function useOffseasonHomeData(saveId: string, phase: string, season: number) {
  const [draft, setDraft] = useState<DraftCentralHomeData | null>(null);
  const [agents, setAgents] = useState<PlayerRowDTO[]>([]);
  const [error, setError] = useState('');
  const config = frontOfficeHomePhase(phase);
  const active = ['combine', 'free-agency', 'draft'].includes(config.kind);
  useEffect(() => {
    setDraft(null);
    setAgents([]);
    setError('');
    if (!active) return;
    const controller = new AbortController();
    const load = async () => {
      const paths = [
        '/api/front-office/draft-central',
        ...(config.kind === 'free-agency' ? ['/api/free-agents'] : []),
      ];
      const results = await Promise.allSettled(
        paths.map(async (path) => {
          const response = await apiFetch(`${path}?saveId=${encodeURIComponent(saveId)}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('Offseason information is unavailable.');
          return response.json();
        }),
      );
      if (controller.signal.aborted) return;
      if (results[0].status === 'fulfilled') setDraft(results[0].value);
      if (results[1]?.status === 'fulfilled') setAgents(results[1].value.players ?? []);
      if (results.some((result) => result.status === 'rejected'))
        setError('Some offseason information is unavailable. Open the linked section to retry.');
    };
    void load();
    return () => controller.abort();
  }, [saveId, phase, season, active, config.kind]);
  return { draft, agents, error };
}

type Props = {
  phase: string;
  data: ReturnType<typeof useOffseasonHomeData>;
  capSpace: number;
  season: number;
};
const prospectHref = (id: string) => `/front-office/draft/prospects/${encodeURIComponent(id)}`;
const playerName = (p: PlayerRowDTO) => `${p.firstName} ${p.lastName}`.trim();
const available = (players: PlayerRowDTO[]) =>
  players
    .filter((p) => !p.isSignedByUser && !p.isSignedByCpu && !/\bsigned\b/i.test(p.status ?? ''))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

export function OffseasonHomeHero({ phase, data }: Props) {
  const config = frontOfficeHomePhase(phase);
  const prospect = [...(data.draft?.availableProspects ?? data.draft?.prospects ?? [])].sort(
    (a, b) => a.currentRank - b.currentRank,
  )[0];
  const agent = available(data.agents)[0];
  const person =
    config.kind === 'free-agency'
      ? agent && {
          id: agent.id,
          name: playerName(agent),
          image: agent.headshotUrl,
          detail: `${agent.position} · Free Agent`,
          href: '/free-agents',
        }
      : prospect && {
          id: prospect.id,
          name: prospect.name,
          image: prospect.headshotUrl,
          detail: `${prospect.position ?? 'Prospect'} · ${prospect.school ?? 'Draft class'}`,
          href: prospectHref(prospect.id),
        };
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <section className={styles.hero} aria-label={config.eyebrow}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>
          <CalendarDays size={14} aria-hidden="true" />
          {config.eyebrow}
        </p>
        <FrontOfficeFeatureHeading>{config.title}</FrontOfficeFeatureHeading>
        <p className={styles.heroSummary}>{config.summary}</p>
        <Link className={styles.cta} href={config.href}>
          {config.cta}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.heroVisual}>
        {person?.image && failed !== person.id ? (
          <Image
            className={styles.heroPhoto}
            src={person.image}
            alt={person.name}
            width={440}
            height={360}
            unoptimized
            onError={() => setFailed(person.id)}
          />
        ) : (
          <Trophy className={styles.offseasonHeroIcon} aria-hidden="true" />
        )}
        <div className={styles.heroPlayer}>
          {person ? (
            <>
              <Link href={person.href}>{person.name}</Link>
              <span>{person.detail}</span>
              <i />
              <small>
                {config.kind === 'free-agency' ? 'Available talent' : 'Prospect spotlight'}
              </small>
            </>
          ) : (
            <span>
              {config.kind === 'free-agency' ? 'Build your roster' : 'Shape your draft board'}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Card({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <header>
        <h2>{title}</h2>
        {href && (
          <Link href={href}>
            View All <ArrowRight size={12} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export function OffseasonHomeMarket({ phase, data }: Props) {
  const config = frontOfficeHomePhase(phase);
  const fa = config.kind === 'free-agency';
  const prospects = [...(data.draft?.availableProspects ?? data.draft?.prospects ?? [])]
    .sort((a, b) => a.currentRank - b.currentRank)
    .slice(0, 4);
  const players = available(data.agents).slice(0, 4);
  return (
    <section
      className={`${styles.panel} ${styles.market}`}
      aria-label={fa ? 'Free Agency Targets' : 'Top Prospects'}
    >
      <header>
        <h2>{fa ? 'Free Agency Targets' : 'Top Prospects'}</h2>
        <Link href={fa ? '/free-agents' : '/front-office/draft/prospects'}>
          View All <ArrowRight size={12} />
        </Link>
      </header>
      {fa
        ? players.map((p) => (
            <Link className={styles.offseasonRow} href="/free-agents" key={p.id}>
              {p.headshotUrl ? (
                <Image src={p.headshotUrl} alt="" width={44} height={44} unoptimized />
              ) : (
                <Trophy aria-hidden="true" />
              )}
              <span>
                <strong>{playerName(p)}</strong>
                <small>
                  {p.position} · {p.rating ?? p.maddenRating ?? '—'} OVR
                </small>
              </span>
              <ChevronRight size={16} />
            </Link>
          ))
        : prospects.map((p) => (
            <Link className={styles.offseasonRow} href={prospectHref(p.id)} key={p.id}>
              {p.headshotUrl ? (
                <Image src={p.headshotUrl} alt="" width={44} height={44} unoptimized />
              ) : (
                <Trophy aria-hidden="true" />
              )}
              <span>
                <strong>{p.name}</strong>
                <small>
                  #{p.currentRank} · {p.position} · {p.school}
                </small>
              </span>
              <ChevronRight size={16} />
            </Link>
          ))}
      {(fa ? !players.length : !prospects.length) && (
        <p className={styles.caption}>
          {data.error || 'No current data available. Explore the full marketplace or draft board.'}
        </p>
      )}
    </section>
  );
}

export function OffseasonHomeRail({ phase, data, capSpace, season }: Props) {
  const board = useProspectBoard(data.draft?.draftYear ?? season + 1);
  const picks = (data.draft?.remainingPicks ?? data.draft?.picks ?? [])
    .filter((p) => p.year === (data.draft?.draftYear ?? season + 1))
    .sort((a, b) => a.displayOverall - b.displayOverall);
  return (
    <>
      <Card title={phase === 'draft' ? 'Draft Info' : 'Offseason Timeline'}>
        <ol className={styles.offseasonTimeline}>
          {[
            ['scouting_combine', 'Scouting Combine', '/front-office/draft/prospects'],
            ['free_agency', 'Phase 1 · Tampering Window', '/free-agents'],
            ['free_agency_open', 'Phase 2 · Free Agency', '/free-agents'],
            ['draft', 'NFL Draft', '/front-office/draft'],
          ].map(([key, label, href]) => (
            <li key={key} aria-current={phase === key ? 'step' : undefined}>
              <Link href={href}>
                {label}
                {phase === key && <small>Current</small>}
              </Link>
            </li>
          ))}
        </ol>
        <p className={styles.caption}>{phaseDisplayName(phase)}</p>
      </Card>
      <Card
        title={phase.startsWith('free_agency') ? 'Cap Outlook' : 'Draft Capital'}
        href={phase.startsWith('free_agency') ? '/roster?view=resign' : '/front-office/draft'}
      >
        {phase.startsWith('free_agency') ? (
          <>
            <strong className="front-office-stat-value">{formatMoneyMillions(capSpace)}</strong>
            <p>Available cap space</p>
          </>
        ) : (
          <>
            <p>
              {data.draft
                ? `${picks.length} owned picks · ${data.draft.draftYear}`
                : 'Loading owned picks…'}
            </p>
            <strong>
              {picks[0]
                ? `Next pick: Round ${picks[0].round} · #${picks[0].displayOverall}`
                : 'No next pick listed'}
            </strong>
            {picks.slice(0, 7).map((p) => (
              <p className={styles.offseasonPick} key={p.id}>
                <span>Round {p.round}</span>
                <strong>#{p.displayOverall}</strong>
              </p>
            ))}
          </>
        )}
      </Card>
      <Card title="Team Needs" href="/front-office/draft/team-needs">
        {(data.draft?.needAnalysis ?? []).slice(0, 5).map((n) => (
          <p className={styles.offseasonPick} key={n.position}>
            <strong>{n.position}</strong>
            <span>{n.level}</span>
          </p>
        ))}
        {!data.draft?.needAnalysis?.length && (
          <p className={styles.caption}>Review your roster to identify priority positions.</p>
        )}
      </Card>
      {!phase.startsWith('free_agency') && (
        <Card title="Draft Board" href="/front-office/draft/big-board">
          <p>{board.ids.length} prospects on your board</p>
          <Link href="/front-office/draft/scouting">
            Review scouting reports <ArrowRight size={12} />
          </Link>
        </Card>
      )}
      {data.error && (
        <p role="status" className={styles.caption}>
          {data.error}
        </p>
      )}
    </>
  );
}
