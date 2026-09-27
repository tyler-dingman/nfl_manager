'use client';
import { PlayersNavIcon } from '@/components/ui/players-nav-icon';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileSecondaryNavigation } from '@/components/navigation/mobile-secondary-navigation';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import type { Team } from '@/features/team/team-store';
import {
  DdHomeIcon,
  DdGameCenterIcon,
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
  ['Players', '/parlay-lab/players', PlayersNavIcon],
  ['Teams', '/parlay-lab/teams', DdMyTeamIcon],
  ['Parlay Generator ✦', '/parlay-lab/generator', LabExperimentIcon],
  ['Alt Stack', '/parlay-lab/alt-stack', LabExperimentIcon],
  ['My Parlays', '/parlay-lab/my-plays', LabParlayIcon],
  ['Settings', '/parlay-lab/settings', DdSettingsIcon],
] as const;
export function DashboardShell({ team, children }: { team?: Team; children: ReactNode }) {
  const path = usePathname();
  const { favorite } = useParlayTeamContext();
  const navigation = links.map(([label, href, icon]) => ({
    label,
    icon,
    href:
      label === 'Teams'
        ? `/parlay-lab/games?team=${favorite?.abbr ?? team?.abbr ?? 'ARI'}`
        : `${href}${team ? `?team=${team.abbr}` : ''}`,
    active: path === href || (href.endsWith('/games') && Boolean(path?.includes('/game/'))),
  }));
  return (
    <TeamThemeProvider team={team}>
      <div data-parlay-dashboard>
        <MainSiteHeader active="parlay-lab" teamAbbr={team?.abbr} />
        <MobileSecondaryNavigation
          label="Explore Parlay Lab"
          items={navigation}
          currentRoute={path ?? ''}
          breakpoint={768}
        />
        <div className="lab-app-layout">
          <nav id="lab-navigation" className="lab-navigation" aria-label="Parlay Lab">
            {navigation.map(({ label, href, icon: Icon, active }) => (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
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
