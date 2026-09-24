'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { useRosterQuery } from '@/features/players/queries';
import { TEAM_LIST } from '@/data/teams';
import { apiFetch } from '@/lib/api';
import { phaseDisplayName } from '@/lib/front-office-phase';
import {
  getActiveSimulationRoster,
  FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
} from '@/lib/front-office-roster';
import { computeTeamOverviewRaw, scaleOverviewScore } from '@/lib/team-overview';
import { formatMoneyMillions } from '@/server/logic/cap';
import type { FranchiseSimulationState } from '@/types/front-office';
import styles from './front-office-mobile-status.module.css';

/** One live franchise summary for every mobile Front Office route, including Home. */
export function FrontOfficeMobileStatus() {
  const save = useSaveStore();
  const teams = useTeamStore((s) => s.teams);
  const { data } = useRosterQuery(save.saveId, save.teamAbbr);
  const [simulation, setSimulation] = useState<FranchiseSimulationState | null>(null);
  useEffect(() => {
    if (!save.saveId) return;
    const controller = new AbortController();
    const refresh = () => {
      void apiFetch(`/api/front-office/simulate?saveId=${encodeURIComponent(save.saveId!)}`, {
        signal: controller.signal,
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((body) => {
          if (!controller.signal.aborted) setSimulation(body?.state ?? null);
        })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener('front-office-simulation-advanced', refresh);
    window.addEventListener('front-office-week-complete', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('front-office-simulation-advanced', refresh);
      window.removeEventListener('front-office-week-complete', refresh);
    };
  }, [save.saveId]);
  const active = getActiveSimulationRoster(
    data.length ? data : save.roster,
    save.teamAbbr,
    save.rosterLimit || FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
  );
  const bounds = teams
    .map((t) => t.teamOverviewRaw)
    .filter((n): n is number => typeof n === 'number');
  const raw = active.length ? computeTeamOverviewRaw(active).overall : null;
  const overall =
    raw == null
      ? (simulation?.teams[save.teamAbbr]?.overall ??
        teams.find((t) => t.abbr === save.teamAbbr)?.teamOverview)
      : bounds.length > 1
        ? scaleOverviewScore(raw, Math.min(...bounds), Math.max(...bounds), 69, 91)
        : Math.round(raw);
  const delta =
    overall != null && save.startingOverall != null ? overall - save.startingOverall : 0;
  const record = simulation?.teams[save.teamAbbr]?.record;
  const game = simulation?.games.find(
    (g) => !g.played && [g.homeTeam, g.awayTeam].includes(save.teamAbbr),
  );
  const opponent = TEAM_LIST.find(
    (t) => t.abbr === (game?.homeTeam === save.teamAbbr ? game?.awayTeam : game?.homeTeam),
  );
  const phase = simulation?.phase ?? save.phase;
  const phaseLabel =
    phase.startsWith('week-') && game?.week
      ? `Week ${game.week}`
      : phaseDisplayName(phase, save.freeAgencyWave);
  const values = [
    ['OVR', overall ?? '—'],
    [
      'Record',
      record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : '—',
    ],
    ['Cap', formatMoneyMillions(save.capSpace)],
    ['Roster', `${active.length}/${save.rosterLimit || FRONT_OFFICE_ACTIVE_ROSTER_LIMIT}`],
  ];
  return (
    <section className={styles.strip} aria-label="Franchise status">
      <dl>
        {values.map(([label, value]) => (
          <div key={label}>
            <dd>
              <span className="front-office-stat-value" data-long-value={String(value).length > 6}>
                {value}
              </span>
              {label === 'OVR' && delta !== 0 && (
                <small
                  data-positive={delta > 0}
                  aria-label={`Overall ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`}
                >
                  {delta > 0 ? '↑' : '↓'}
                  {Math.abs(delta)}
                </small>
              )}
            </dd>
            <dt>{label}</dt>
          </div>
        ))}
      </dl>
      <Link href="/front-office/league/schedule" className={styles.matchup}>
        {opponent && (
          <Image src={opponent.logoUrl} alt={opponent.name} width={32} height={32} unoptimized />
        )}
        <strong>
          {phaseLabel} · {opponent ? `vs ${opponent.name.split(' ').slice(-1)[0]}` : 'Schedule'}
        </strong>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
