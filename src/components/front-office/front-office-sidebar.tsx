'use client';

import Link from 'next/link';
import { PlayersNavIcon } from '@/components/ui/players-nav-icon';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { MobileSecondaryNavigation } from '@/components/navigation/mobile-secondary-navigation';
import {
  Home,
  Users,
  Network,
  ArrowLeftRight,
  UserPlus,
  Trophy,
  Layers,
  FileText,
  Globe,
  Settings,
} from 'lucide-react';
import { OwnershipIcon } from '@/components/ui/ownership-icon';
import type { Team } from '@/features/team/team-store';

const OwnershipNavIcon = () => <OwnershipIcon name="owners-desk" />;

const changeTeam = { label: 'Change team', href: '/teams?switch=1', icon: Users };

const items = [
  { label: 'Home', href: '/experience', icon: Home },
  { label: 'Roster', href: '/roster?view=roster', icon: PlayersNavIcon },
  { label: 'Depth Chart', href: '/roster?view=depth', icon: Network },
  { label: 'Trades', href: '/front-office/trade-hub?context=roster', icon: ArrowLeftRight },
  { label: 'Free Agency', href: '/free-agents', icon: UserPlus },
  { label: 'Draft', href: '/front-office/draft', icon: Trophy },
  { label: 'Player Development', href: '/front-office/development', icon: Layers },
  { label: 'Contracts', href: '/roster?view=resign', icon: FileText },
  { label: 'League Intel', href: '/league', icon: Globe },
  { label: 'Ownership', href: '/front-office/ownership', icon: OwnershipNavIcon },
  { label: 'Settings', href: '/front-office/settings', icon: Settings },
];

function currentSection(pathname: string, view: string | null) {
  const path = pathname.replace(/^\/offseasonmanager(?=\/)/, '');
  if (path === '/roster')
    return view === 'depth' ? 'Depth Chart' : view === 'resign' ? 'Contracts' : 'Roster';
  if (path === '/cap-space') return 'Contracts';
  if (path.startsWith('/manage/trades')) return 'Trades';
  if (path.startsWith('/draft/')) return 'Draft';
  if (path.startsWith('/front-office/league')) return 'League Intel';
  return (
    items.find(
      ({ href }) => path === href.split('?')[0] || path.startsWith(`${href.split('?')[0]}/`),
    )?.label ?? 'Home'
  );
}

function navigationItems(preFranchise: boolean) {
  return preFranchise
    ? [{ label: 'Start', href: '/experience', icon: Home }, items[items.length - 1]]
    : items;
}
export function FrontOfficeMobileNav({ preFranchise = false }: { preFranchise?: boolean }) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const section =
    preFranchise && !pathname.includes('/settings')
      ? 'Start'
      : currentSection(pathname, params?.get('view') ?? null);
  return (
    <MobileSecondaryNavigation
      label="Front Office sections"
      breakpoint={1100}
      currentRoute={`${pathname}?${params}`}
      items={[...navigationItems(preFranchise), changeTeam].map((item) => ({
        ...item,
        active: item.label === section,
      }))}
    />
  );
}

export function FrontOfficeSidebar({
  team,
  season,
  preFranchise = false,
}: {
  team?: Team;
  season: number;
  preFranchise?: boolean;
}) {
  const pathname = usePathname()?.replace(/^\/offseasonmanager(?=\/)/, '') ?? '';
  const params = useSearchParams();
  return (
    <aside id="front-office-navigation" className="fo-sidebar" aria-label="Franchise navigation">
      <Link
        href={changeTeam.href}
        className="fo-sidebar-identity"
        aria-label={`Change team, currently ${team?.name ?? 'no team'}`}
      >
        {team?.logo_url && <Image src={team.logo_url} alt="" width={56} height={56} unoptimized />}
        <span>
          <strong>{team?.name ?? 'Your franchise'}</strong>
          <small>{season} Season</small>
        </span>
      </Link>
      <nav aria-label="Front Office">
        {navigationItems(preFranchise).map(({ label, href, icon: Icon }) => {
          const active = preFranchise
            ? label === 'Start'
            : currentSection(pathname, params?.get('view') ?? null) === label;
          return (
            <Link key={label} href={href} aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      {pathname === '/experience' && (
        <div className="fo-sidebar-ad">
          <a
            href="https://sportsbook.fanduel.com/"
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label="FanDuel sportsbook advertisement"
          >
            <Image
              src="/images/ads/fanduel_ad.png.jpg"
              alt="FanDuel: America's number one sportsbook. 21+ and present in eligible states. Terms apply."
              width={335}
              height={188}
            />
          </a>
          <small>21+ · Gambling problem? Call 1-800-GAMBLER.</small>
        </div>
      )}
    </aside>
  );
}
