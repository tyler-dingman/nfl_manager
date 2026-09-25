'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import type { Team } from '@/features/team/team-store';
import {
  DdHomeIcon,
  DdGameCenterIcon,
  DdPlayerComparisonIcon,
  DdMyTeamIcon,
  DdSettingsIcon,
} from '@/components/ui/football-icons';
import { LabTrendsIcon, LabExperimentIcon, LabParlayIcon } from './lab-icons';
import './dashboard.css';
import { useParlayTeamContext } from './use-parlay-team';
const links = [
  ['Home', '/parlay-lab', DdHomeIcon],
  ['Trending Props', '/parlay-lab/trends', LabTrendsIcon],
  ['Games', '/parlay-lab/games', DdGameCenterIcon],
  ['Players', '/parlay-lab/players', DdPlayerComparisonIcon],
  ['Teams', '/parlay-lab/teams', DdMyTeamIcon],
  ['Parlay Generator ✦', '/parlay-lab/generator', LabExperimentIcon],
  ['My Parlays', '/parlay-lab/my-plays', LabParlayIcon],
  ['Settings', '/parlay-lab/settings', DdSettingsIcon],
] as const;
export function DashboardShell({ team, children }: { team?: Team; children: ReactNode }) {
  const path = usePathname();
  const { favorite } = useParlayTeamContext();
  const [open, setOpen] = useState(false);
  return (
    <TeamThemeProvider team={team}>
      <div data-parlay-dashboard>
        <MainSiteHeader active="parlay-lab" teamAbbr={team?.abbr} />
        <button
          className="lab-nav-toggle"
          aria-expanded={open}
          aria-controls="lab-navigation"
          onClick={() => setOpen(!open)}
        >
          Parlay Lab menu {open ? '−' : '+'}
        </button>
        <div className="lab-app-layout">
          <nav
            id="lab-navigation"
            className="lab-navigation"
            data-open={open}
            aria-label="Parlay Lab"
          >
            {links.map(([label, href, Icon]) => (
              <Link
                key={href}
                href={
                  label === 'Teams'
                    ? `/parlay-lab/games?team=${favorite?.abbr ?? team?.abbr ?? 'ARI'}`
                    : `${href}${team ? `?team=${team.abbr}` : ''}`
                }
                aria-current={
                  path === href || (href.endsWith('/games') && path?.includes('/game/'))
                    ? 'page'
                    : undefined
                }
                onClick={() => setOpen(false)}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="lab-workspace">{children}</div>
        </div>
      </div>
    </TeamThemeProvider>
  );
}
