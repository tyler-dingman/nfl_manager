'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
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
  X,
  ChevronDown,
} from 'lucide-react';
import { OwnershipIcon } from '@/components/ui/ownership-icon';
import type { Team } from '@/features/team/team-store';

const OwnershipNavIcon = () => <OwnershipIcon name="owners-desk" />;

const items = [
  { label: 'Home', href: '/experience', icon: Home },
  { label: 'Roster', href: '/roster?view=roster', icon: Users },
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

export function FrontOfficeMobileNav({
  open,
  onOpen,
  preFranchise = false,
}: {
  open: boolean;
  onOpen: () => void;
  preFranchise?: boolean;
}) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const section = preFranchise ? 'Start' : currentSection(pathname, params?.get('view') ?? null);
  return (
    <div className="front-office-mobile-bar">
      <span>Front Office</span>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Front Office navigation: ${section}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="front-office-navigation"
      >
        <span>{section}</span>
        <ChevronDown aria-hidden="true" />
      </button>
    </div>
  );
}

export function FrontOfficeSidebar({
  team,
  season,
  open,
  onClose,
  preFranchise = false,
}: {
  team?: Team;
  season: number;
  open: boolean;
  onClose: () => void;
  preFranchise?: boolean;
}) {
  const pathname = usePathname()?.replace(/^\/offseasonmanager(?=\/)/, '') ?? '';
  const params = useSearchParams();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>('button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const links = Array.from(panel?.querySelectorAll<HTMLElement>('a, button') ?? []).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (!links?.length) return;
      const first = links[0],
        last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel?.addEventListener('keydown', trap);
    return () => {
      panel?.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [open]);
  return (
    <>
      {open && (
        <button
          className="fo-sidebar-backdrop"
          onClick={onClose}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}
      <aside
        ref={ref}
        id="front-office-navigation"
        className="fo-sidebar"
        data-open={open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Franchise navigation"
      >
        <div className="fo-sheet-heading">Front Office</div>
        <button className="fo-sidebar-close" onClick={onClose} aria-label="Close menu">
          <X aria-hidden="true" />
        </button>
        <Link
          href="/teams?switch=1"
          className="fo-sidebar-identity"
          aria-label={`Change team, currently ${team?.name ?? 'no team'}`}
        >
          {team?.logo_url && (
            <Image src={team.logo_url} alt="" width={56} height={56} unoptimized />
          )}
          <span>
            <strong>{team?.name ?? 'Your franchise'}</strong>
            <small>{season} Season</small>
          </span>
        </Link>
        <nav aria-label="Front Office">
          {(preFranchise
            ? [{ label: 'Start', href: '/experience', icon: Home }, items[items.length - 1]]
            : items
          ).map(({ label, href, icon: Icon }) => {
            const active = preFranchise
              ? label === 'Start'
              : currentSection(pathname, params?.get('view') ?? null) === label;
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
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
    </>
  );
}
