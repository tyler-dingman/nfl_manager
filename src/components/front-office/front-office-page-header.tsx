'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { computeTeamOverviewRaw } from '@/lib/team-overview';
import { formatMoneyMillions } from '@/server/logic/cap';

export type FrontOfficeTool = {
  label: string;
  href?: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
};

export function FrontOfficePageHeader({
  title,
  strapline,
  description,
  tools = [],
}: {
  title: string;
  strapline: string;
  description?: string;
  tools?: FrontOfficeTool[];
}) {
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const roster = useSaveStore((state) => state.roster);
  const capSpace = useSaveStore((state) => state.capSpace);
  const team = teams.find((entry) => entry.id === selectedTeamId) ?? teams[0];
  const activeRoster = roster.filter((player) => player.status?.toLowerCase() !== 'cut');
  const averageAge = activeRoster.length
    ? activeRoster.reduce((sum, player) => sum + (player.age ?? 0), 0) / activeRoster.length
    : 0;
  const overall = activeRoster.length
    ? Math.round(computeTeamOverviewRaw(activeRoster).overall)
    : (team?.teamOverview ?? 0);

  return (
    <header className="fo-page-header">
      <div className="fo-page-header-inner">
        <div className="fo-page-heading">
          <p className="fo-title-eyebrow text-[var(--team-primary-text)]">{strapline}</p>
          <h1 className="dd-home-hero-display">{title}</h1>
          {description ? <p className="fo-description">{description}</p> : null}
        </div>
        <div className="fo-page-header-side">
          <section className="fo-team-metrics" aria-label="Team summary">
            <div className="fo-team-picker">
              {team?.logo_url ? (
                <Image src={team.logo_url} alt="" width={30} height={30} aria-hidden="true" />
              ) : null}
              <span>{team?.name ?? 'Selected team'}</span>
            </div>
            <dl>
              <div>
                <dt>Total players</dt>
                <dd>{activeRoster.length}</dd>
              </div>
              <div>
                <dt>Avg age</dt>
                <dd>{averageAge ? averageAge.toFixed(1) : '—'}</dd>
              </div>
              <div>
                <dt>Cap space</dt>
                <dd>{formatMoneyMillions(capSpace)}</dd>
              </div>
              <div className="fo-ovr">
                <dt>Team OVR</dt>
                <dd>{overall || '—'}</dd>
              </div>
            </dl>
          </section>
          {tools.length ? (
            <section className="fo-tools" aria-label={`${title} tools`}>
              <h2>{title} tools</h2>
              <div>
                {tools.map(({ label, href, icon: Icon, onClick, disabled }) => {
                  const content = (
                    <>
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </>
                  );
                  return href && !disabled ? (
                    <Link key={label} href={href} className="fo-tool">
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={label}
                      type="button"
                      className="fo-tool"
                      onClick={onClick}
                      disabled={disabled}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </header>
  );
}
