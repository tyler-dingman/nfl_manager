'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUp,
  ClipboardList,
  FileText,
  Handshake,
  Home,
  Lock,
  Menu,
  Shield,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';

import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { TeamNeeds } from '@/components/team-needs';
import { PhaseStepper } from '@/components/phase-stepper';
import { TeamFavicon } from '@/components/team-favicon';
import { TradeOfferToast } from '@/components/trade-offer-toast';
import { AdSlot } from '@/components/ads/AdSlot';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useExperienceStore } from '@/features/experience/experience-store';
import {
  getRouteForStep,
  getStepForPath,
  isStepUnlocked,
} from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { getOffseasonManagerRoute } from '@/features/team/offseason-manager-route';
import { useTeamStore } from '@/features/team/team-store';
import { buildCapCrisisAlert } from '@/lib/falco-alerts';
import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import { formatMoneyMillions } from '@/server/logic/cap';
import {
  computeTeamNeeds,
  computeTeamOverviewRaw,
  scaleOverviewScore,
  type TeamNeed,
} from '@/lib/team-overview';
import { cn } from '@/lib/utils';

const navRoutes = {
  Overview: '/experience',
  Roster: '/roster?view=roster',
  Contracts: '/roster?view=contracts',
  'Cap Space': '/cap-space',
  'Depth Chart': '/roster?view=depth',
  'Re-sign/Cut Players': '/roster?view=resign',
  'Trade Hub': '/manage/trades',
  'Free Agency': '/free-agents',
  'Draft Board': '/draft/room?mode=mock',
} as const;

type NavItem = keyof typeof navRoutes;

const navIcons: Record<NavItem, LucideIcon> = {
  Overview: Home,
  Roster: Users,
  Contracts: FileText,
  'Cap Space': WalletCards,
  'Depth Chart': Shield,
  'Re-sign/Cut Players': Handshake,
  'Trade Hub': ArrowLeftRight,
  'Free Agency': ClipboardList,
  'Draft Board': Lock,
};

const navSections: { title?: string; items: NavItem[] }[] = [
  {
    items: ['Overview', 'Roster', 'Contracts', 'Cap Space', 'Depth Chart'],
  },
  {
    title: 'Manage Team',
    items: ['Re-sign/Cut Players', 'Trade Hub'],
  },
  {
    title: 'Free Agency',
    items: ['Free Agency'],
  },
  {
    title: 'Draft',
    items: ['Draft Board'],
  },
];

const shellRightRailRoutes = [
  '/experience',
  '/manage-team',
  '/manage/trades',
  '/cap-space',
] as const;

function HeaderDelta({ delta, suffix = '' }: { delta: number | null; suffix?: string }) {
  if (!delta) return null;

  const positive = delta > 0;
  const negative = delta < 0;
  if (!positive && !negative) return null;

  const Icon = positive ? ArrowUp : ArrowDownRight;
  const displayValue = Math.abs(delta);
  const label =
    suffix === 'M'
      ? `${displayValue.toFixed(1)}${suffix}`
      : Number.isInteger(displayValue)
        ? `${displayValue}${suffix}`
        : `${displayValue.toFixed(1)}${suffix}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none',
        positive ? 'text-emerald-600' : 'text-red-600',
      )}
      aria-label={`${positive ? 'Up' : 'Down'} ${label}`}
      title={`${positive ? '+' : '-'}${label}`}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.2} />
      <span>{label}</span>
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const saveId = useSaveStore((state) => state.saveId);
  const storedTeamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const startingCapSpace = useSaveStore((state) => state.startingCapSpace);
  const startingOverall = useSaveStore((state) => state.startingOverall);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const isUserOnClock = useSaveStore((state) => state.isUserOnClock);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const mode = useExperienceStore((state) => state.mode);
  const experienceHasHydrated = useExperienceStore((state) => state.hasHydrated);
  const isHydrated = hasHydrated && experienceHasHydrated;
  const currentStep = useExperienceStore((state) => state.currentStep);
  const completedSteps = useExperienceStore((state) => state.completedSteps);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [trajectoryPulse, setTrajectoryPulse] = useState(false);
  const wasNegativeRef = useRef(false);
  const lastSaveIdRef = useRef<string | null>(null);
  const lastTrajectoryStateRef = useRef<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeStep = pathname ? getStepForPath(pathname) : null;

  useEffect(() => {
    if (!isHydrated) return;
    if (!saveId && pathname !== '/') {
      router.replace('/');
    }
  }, [isHydrated, pathname, router, saveId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [selectedTeamId, teams],
  );
  const liveRosterPlayers = useMemo(
    () =>
      roster.filter(
        (player) =>
          player.status?.toLowerCase() !== 'cut' &&
          (!selectedTeam?.abbr || !player.teamAbbr || player.teamAbbr === selectedTeam.abbr),
      ),
    [roster, selectedTeam?.abbr],
  );
  const liveTeamSummary = useMemo(() => {
    if (liveRosterPlayers.length === 0) {
      return {
        overall: selectedTeam?.teamOverview ?? null,
        needs: selectedTeam?.teamNeeds ?? [],
      };
    }

    const rawOverview = computeTeamOverviewRaw(liveRosterPlayers);
    const teamsWithRawOverview = teams.filter(
      (team): team is typeof team & { teamOverviewRaw: number } =>
        typeof team.teamOverviewRaw === 'number' && Number.isFinite(team.teamOverviewRaw),
    );
    const overallRawValues = teamsWithRawOverview.map((team) => team.teamOverviewRaw);
    const overall =
      overallRawValues.length > 1
        ? scaleOverviewScore(
            rawOverview.overall,
            Math.min(...overallRawValues),
            Math.max(...overallRawValues),
            69,
            91,
          )
        : (selectedTeam?.teamOverview ?? null);

    return {
      overall,
      needs: selectedTeam?.teamNeeds ?? computeTeamNeeds(liveRosterPlayers),
    };
  }, [liveRosterPlayers, selectedTeam?.teamNeeds, selectedTeam?.teamOverview, teams]);
  const liveOverallDelta = useMemo(() => {
    const baselineOverall = startingOverall ?? selectedTeam?.teamOverview ?? null;
    if (
      liveTeamSummary.overall === null ||
      liveTeamSummary.overall === undefined ||
      baselineOverall === null ||
      baselineOverall === undefined
    ) {
      return null;
    }

    const delta = liveTeamSummary.overall - baselineOverall;
    return delta === 0 ? null : delta;
  }, [liveTeamSummary.overall, selectedTeam?.teamOverview, startingOverall]);
  const liveCapSpaceDelta = useMemo(() => {
    const baselineCapSpace = startingCapSpace ?? null;
    if (baselineCapSpace === null || baselineCapSpace === undefined) {
      return null;
    }

    const delta = Number((capSpace - baselineCapSpace).toFixed(1));
    return delta === 0 ? null : delta;
  }, [capSpace, startingCapSpace]);
  const liveTrajectory = useMemo(
    () =>
      computeFranchiseTrajectory({
        roster: liveRosterPlayers,
        teamOverview: liveTeamSummary.overall,
        capSpace,
        capLimit,
      }),
    [capLimit, capSpace, liveRosterPlayers, liveTeamSummary.overall],
  );

  const showTeamNeeds = Boolean(pathname);

  const showOnTheClock = Boolean(isUserOnClock && pathname?.startsWith('/draft'));

  const lockedRoutes = useMemo(() => {
    const locked = new Set<NavItem>();
    if (!unlocked.freeAgency || phase === 'draft' || phase === 'season') {
      locked.add('Free Agency');
    }
    if (!unlocked.draft) {
      locked.add('Draft Board');
    }
    return locked;
  }, [phase, unlocked.draft, unlocked.freeAgency]);

  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);

  useEffect(() => {
    if (!saveId) return;
    if (lastSaveIdRef.current !== saveId) {
      lastSaveIdRef.current = saveId;
      wasNegativeRef.current = false;
    }
    const isNegative = capSpace < 0;
    let timer: number | undefined;
    if (isNegative && !wasNegativeRef.current) {
      pushAlert(buildCapCrisisAlert());
    }
    wasNegativeRef.current = isNegative;
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [capSpace, pushAlert, saveId]);

  useEffect(() => {
    if (!saveId) return;
    const previous = lastTrajectoryStateRef.current;
    const next = liveTrajectory.state;
    lastTrajectoryStateRef.current = next;
    if (!previous || previous === next) return;
    setTrajectoryPulse(true);
    const timer = window.setTimeout(() => setTrajectoryPulse(false), 700);
    return () => window.clearTimeout(timer);
  }, [liveTrajectory.state, saveId]);

  const tradeOfferScopeKey = useMemo(() => {
    if (!saveId || !pathname) return null;
    if (pathname.startsWith('/roster')) {
      return `${saveId}:manage`;
    }
    if (pathname.startsWith('/free-agents')) {
      return `${saveId}:freeAgency`;
    }
    if (pathname.startsWith('/draft')) {
      return `${saveId}:draft`;
    }
    return null;
  }, [pathname, saveId]);

  const trajectoryAccentClass =
    liveTrajectory.state === 'Contender' || liveTrajectory.state === 'Rising'
      ? 'text-emerald-600'
      : liveTrajectory.state === 'Balanced'
        ? 'text-amber-600'
        : liveTrajectory.state === 'Declining'
          ? 'text-orange-600'
          : 'text-red-600';
  useEffect(() => {
    if (!pathname) return;
    if (mode === 'full') {
      const requestedStep = getStepForPath(pathname);
      if (!requestedStep) return;
      if (!isStepUnlocked(requestedStep, currentStep)) {
        router.replace(getRouteForStep(currentStep));
      }
      return;
    }

    if (currentStep === 'manage') {
      if (pathname.startsWith('/free-agents') || pathname.startsWith('/draft')) {
        router.replace('/roster');
      }
      return;
    }
    if (currentStep === 'free-agency') {
      if (pathname.startsWith('/draft')) {
        router.replace('/free-agents');
      }
      return;
    }
  }, [pathname, router, mode, currentStep]);

  useEffect(() => {
    if (storedTeamAbbr) {
      const matchingTeam = teams.find((team) => team.abbr === storedTeamAbbr);
      if (matchingTeam && matchingTeam.id !== selectedTeamId) {
        setSelectedTeamId(matchingTeam.id);
      }
    }
  }, [selectedTeamId, setSelectedTeamId, storedTeamAbbr, teams]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  if (!isHydrated) {
    return (
      <TeamThemeProvider team={teams[0]}>
        <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 md:flex-row" />
      </TeamThemeProvider>
    );
  }

  if (!saveId && pathname !== '/') {
    return null;
  }

  const showShellRightRail = pathname
    ? shellRightRailRoutes.some((route) => pathname.startsWith(route))
    : false;
  const showOffseasonStepper =
    Boolean(routeStep) ||
    pathname === '/experience' ||
    pathname?.startsWith('/experience/') ||
    pathname === '/offseason-recap' ||
    pathname?.startsWith('/offseason-recap/') ||
    pathname === '/sim-season' ||
    pathname?.startsWith('/sim-season/') ||
    pathname === '/season-recap' ||
    pathname?.startsWith('/season-recap/');

  return (
    <TeamThemeProvider team={selectedTeam}>
      <TeamFavicon teamAbbr={selectedTeam?.abbr ?? null} />
      <MainSiteHeader teamAbbr={selectedTeam?.abbr} active="front-office" />
      <div className="front-office-app min-h-screen overflow-x-hidden bg-[#f7f4ee]">
        <div className="front-office-shell flex min-h-[calc(100vh-var(--site-header-height))] flex-col bg-[#f7f4ee] md:flex-row md:items-stretch">
          {isMobileSidebarOpen ? (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />
          ) : null}

          <aside
            className="front-office-sidebar fixed bottom-0 left-0 top-[var(--site-header-height)] z-50 w-64 -translate-x-full overflow-y-auto border-r border-border bg-white px-5 pb-6 pt-0 transition-transform md:relative md:inset-auto md:z-auto md:flex md:min-h-full md:translate-x-0 md:flex-col md:self-stretch"
            style={{ transform: isMobileSidebarOpen ? 'translateX(0)' : undefined }}
          >
            <div className="mb-[20px] mt-7 flex items-start justify-between gap-3 text-left text-sm">
              <Link
                href={getOffseasonManagerRoute('/experience', selectedTeam?.abbr)}
                aria-label="Go to experience selection"
                className="inline-flex min-w-0 flex-1 cursor-pointer flex-col items-start py-1"
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                  Front Office
                </span>
              </Link>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white md:hidden"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <nav className="flex flex-col gap-6 text-sm">
              {navSections.map((section) => (
                <div key={section.title ?? 'overview'} className="space-y-2">
                  {section.title ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {section.title}
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const href = navRoutes[item];
                      const [hrefPath, hrefQuery] = href.split('?');
                      const isActive =
                        pathname === hrefPath &&
                        (!hrefQuery ||
                          hrefQuery.split('&').every((entry) => {
                            const [key, value] = entry.split('=');
                            return searchParams?.get(key) === value;
                          }));
                      const Icon = navIcons[item];
                      if (lockedRoutes.has(item)) {
                        return (
                          <span
                            key={item}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground/70 opacity-70"
                            title="Locked until the next phase"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground/70" />
                            <span>{item}</span>
                          </span>
                        );
                      }

                      return (
                        <Link
                          key={item}
                          href={href}
                          aria-current={isActive ? 'page' : undefined}
                          className="front-office-nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className={isActive ? 'text-foreground' : undefined}>{item}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
            <header className="front-office-team-summary border-b border-border bg-[#fffdf9]/90 px-4 py-3 md:bg-[#fffdf9]/95 md:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 md:hidden">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white md:hidden"
                    onClick={() => setIsMobileSidebarOpen((open) => !open)}
                    aria-label={isMobileSidebarOpen ? 'Close menu' : 'Open menu'}
                  >
                    {isMobileSidebarOpen ? (
                      <X className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Menu className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <Link
                    href="/teams?switch=1"
                    aria-label="Change team"
                    className="group flex h-9 w-9 items-center justify-center bg-white transition hover:ring-2 hover:ring-ring md:overflow-hidden md:rounded-full md:border md:border-border"
                  >
                    {selectedTeam?.logo_url ? (
                      <>
                        <Image
                          src={selectedTeam.logo_url}
                          alt={`${selectedTeam.name} logo`}
                          width={36}
                          height={36}
                          className="block h-8 w-8 object-contain md:hidden"
                        />
                        <Image
                          src={selectedTeam.logo_url}
                          alt={`${selectedTeam.name} logo`}
                          width={36}
                          height={36}
                          className="hidden h-full w-full object-cover md:block"
                        />
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {selectedTeam?.abbr ?? '--'}
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {selectedTeam?.name ?? 'Select a team'}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 inline-flex max-w-full items-center gap-1 text-xs font-medium',
                            trajectoryAccentClass,
                            trajectoryPulse ? 'animate-pulse' : null,
                          )}
                        >
                          <span className="inline-flex items-start gap-1 text-foreground">
                            <span>
                              OVR{' '}
                              <span className="text-sm font-semibold">
                                {liveTeamSummary.overall ?? '—'}
                              </span>
                            </span>
                            <HeaderDelta delta={liveOverallDelta} />
                          </span>
                          <span className="ml-1.5 truncate">{liveTrajectory.state}</span>
                        </span>
                      </div>
                      <div className="h-9 w-px shrink-0 bg-border" />
                      <div className="shrink-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Cap Space
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-start gap-1 whitespace-nowrap text-sm font-semibold',
                            capSpace < 0 ? 'text-destructive' : 'text-foreground',
                          )}
                        >
                          <span>{formatMoneyMillions(capSpace)}</span>
                          <HeaderDelta delta={liveCapSpaceDelta} suffix="M" />
                        </span>
                      </div>
                      {showTeamNeeds ? (
                        <div className="hidden md:flex items-center border-l border-border pl-3">
                          <TeamNeeds teamNeeds={liveTeamSummary.needs as TeamNeed[]} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="hidden md:flex md:items-center md:justify-between md:gap-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <Link
                      href="/teams?switch=1"
                      aria-label="Change team"
                      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-white transition hover:ring-2 hover:ring-ring"
                    >
                      {selectedTeam?.logo_url ? (
                        <Image
                          src={selectedTeam.logo_url}
                          alt={`${selectedTeam.name} logo`}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {selectedTeam?.abbr ?? '--'}
                        </span>
                      )}
                    </Link>
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {selectedTeam?.name ?? 'Select a team'}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 inline-flex max-w-full items-center gap-1 text-xs font-medium',
                            trajectoryAccentClass,
                            trajectoryPulse ? 'animate-pulse' : null,
                          )}
                        >
                          <span className="inline-flex items-start gap-1 text-foreground">
                            <span>
                              OVR{' '}
                              <span className="text-sm font-semibold">
                                {liveTeamSummary.overall ?? '—'}
                              </span>
                            </span>
                            <HeaderDelta delta={liveOverallDelta} />
                          </span>
                          <span className="ml-1.5 truncate">{liveTrajectory.state}</span>
                        </span>
                      </div>
                      <div className="h-10 w-px shrink-0 bg-border" />
                      <div className="shrink-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Cap Space
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-start gap-1 whitespace-nowrap text-sm font-semibold',
                            capSpace < 0 ? 'text-destructive' : 'text-foreground',
                          )}
                        >
                          <span>{formatMoneyMillions(capSpace)}</span>
                          <HeaderDelta delta={liveCapSpaceDelta} suffix="M" />
                        </span>
                      </div>
                      {showTeamNeeds ? (
                        <div className="hidden lg:flex items-center border-l border-border pl-3">
                          <TeamNeeds teamNeeds={liveTeamSummary.needs as TeamNeed[]} />
                        </div>
                      ) : null}
                    </div>
                    {showOnTheClock ? (
                      <span
                        className="hidden text-xs font-extrabold uppercase tracking-[0.25em] text-[#ff2d55] lg:inline"
                        style={{ textShadow: '0 2px 12px rgba(255, 45, 85, 0.45)' }}
                      >
                        ON THE CLOCK
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            {showOffseasonStepper && mode === 'full' ? (
              <PhaseStepper currentStep={currentStep} completedSteps={completedSteps} />
            ) : null}

            {showOnTheClock ? (
              <div className="mt-3 w-full px-4 md:hidden">
                <div className="rounded-xl bg-gradient-to-r from-[#0A2A66] via-[#1453B8] to-[#0A2A66] px-4 py-2 text-center">
                  <span
                    className="text-sm font-extrabold uppercase tracking-[0.25em] text-[#ff2d55]"
                    style={{ textShadow: '0 2px 12px rgba(255, 45, 85, 0.45)' }}
                  >
                    ON THE CLOCK
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex min-w-0 flex-1 items-start gap-0">
              <main className="front-office-workspace min-w-0 flex-1 px-4 py-6 pb-24 sm:py-8 md:px-8 md:pb-8">
                {children}
              </main>
              {showShellRightRail ? (
                <aside className="hidden w-[260px] shrink-0 px-0 py-5 md:block md:pr-6 md:pt-6 lg:w-[280px] lg:pr-8">
                  <AdSlot placement="RIGHT_RAIL" sticky={false} />
                </aside>
              ) : null}
            </div>
          </div>
          <TradeOfferToast scopeKey={tradeOfferScopeKey} />
        </div>
      </div>
    </TeamThemeProvider>
  );
}
