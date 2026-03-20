'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDownRight, ArrowUpRight, Lock, Menu, X } from 'lucide-react';

import TeamThemeProvider from '@/components/team-theme-provider';
import { OffseasonStepperNav } from '@/components/offseason/offseason-stepper-nav';
import { TeamFavicon } from '@/components/team-favicon';
import { TradeOfferToast } from '@/components/trade-offer-toast';
import { AdSlot } from '@/components/ads/AdSlot';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useExperienceStore } from '@/features/experience/experience-store';
import {
  getRouteForStep,
  getStepForPath,
  isStepUnlocked,
} from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildCapCrisisAlert } from '@/lib/falco-alerts';
import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import { formatMoneyMillions } from '@/server/logic/cap';
import { computeTeamNeeds, computeTeamOverviewRaw, scaleOverviewScore } from '@/lib/team-overview';
import { cn } from '@/lib/utils';

const navRoutes = {
  'Re-sign/Cut Players': '/roster',
  'Trade Hub': '/manage/trades',
  'Free Agency': '/free-agents',
  Draft: '/draft/room?mode=mock',
} as const;

type NavItem = keyof typeof navRoutes;

const navSections: { title: string; items: NavItem[] }[] = [
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
    items: ['Draft'],
  },
];

function HeaderDelta({
  delta,
  suffix = '',
}: {
  delta: number | null;
  suffix?: string;
}) {
  if (!delta) return null;

  const positive = delta > 0;
  const negative = delta < 0;
  if (!positive && !negative) return null;

  const Icon = positive ? ArrowUpRight : ArrowDownRight;
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [trajectoryPulse, setTrajectoryPulse] = useState(false);
  const wasNegativeRef = useRef(false);
  const lastSaveIdRef = useRef<string | null>(null);
  const lastTrajectoryStateRef = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

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
      needs: computeTeamNeeds(liveRosterPlayers),
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

  const showOnTheClock = Boolean(isUserOnClock && pathname?.startsWith('/draft'));

  const lockedRoutes = useMemo(() => {
    const locked = new Set<NavItem>();
    if (!unlocked.freeAgency || phase === 'draft' || phase === 'season') {
      locked.add('Free Agency');
    }
    if (!unlocked.draft) {
      locked.add('Draft');
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

    if (phase === 'resign_cut') {
      if (pathname.startsWith('/free-agents') || pathname.startsWith('/draft')) {
        router.replace('/roster');
      }
      return;
    }
    if (phase === 'free_agency') {
      if (pathname.startsWith('/draft')) {
        router.replace('/free-agents');
      }
      return;
    }
  }, [pathname, phase, router, mode, currentStep]);

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
        <div
          className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 md:flex-row"
          style={{ '--app-header-height': '64px' } as CSSProperties}
        />
      </TeamThemeProvider>
    );
  }

  if (!saveId && pathname !== '/') {
    return null;
  }

  return (
    <TeamThemeProvider team={selectedTeam}>
      <ToastProvider>
        <TeamFavicon primaryColor={selectedTeam?.color_primary ?? null} />
        <div
          className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 md:min-h-screen md:flex-row md:items-stretch"
          style={{ '--app-header-height': '64px' } as CSSProperties}
        >
          {isMobileSidebarOpen ? (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />
          ) : null}

          <aside
            className="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r border-border bg-white px-5 pb-6 pt-0 transition-transform md:sticky md:top-0 md:z-auto md:flex md:min-h-screen md:h-auto md:translate-x-0 md:flex-col md:self-stretch md:overflow-y-auto"
            style={{ transform: isMobileSidebarOpen ? 'translateX(0)' : undefined }}
          >
            <div className="mb-[20px] mt-[20px] flex items-start justify-between gap-3 text-left text-sm">
              <Link
                href="/experience"
                aria-label="Go to experience selection"
                className="inline-flex cursor-pointer"
              >
                <Image
                  src="/images/falco_logo.png"
                  alt="Falco"
                  width={200}
                  height={60}
                  className="block h-auto w-auto max-h-[120px] max-w-[120px] object-contain"
                  priority
                />
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
            {mode === 'full' ? (
              <OffseasonStepperNav
                seasonLabel="2026 Offseason"
                teamName={selectedTeam?.name ?? 'Your Team'}
                currentStep={currentStep}
                completedSteps={completedSteps}
              />
            ) : (
              <nav className="flex flex-col gap-6 text-sm">
                {navSections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {section.title}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const href = navRoutes[item];
                        const isActive = pathname === href.split('?')[0];
                        if (lockedRoutes.has(item)) {
                          return (
                            <span
                              key={item}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground/70 opacity-70"
                              title="Locked until the next phase"
                            >
                              <span className="flex h-6 w-1 rounded-full bg-transparent" />
                              <Lock className="h-4 w-4 text-muted-foreground/70" />
                              <span>{item}</span>
                            </span>
                          );
                        }

                        return (
                          <Link
                            key={item}
                            href={href}
                            aria-current={isActive ? 'page' : undefined}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:text-foreground"
                          >
                            <span
                              className="h-6 w-1 rounded-full"
                              style={{
                                backgroundColor: isActive ? 'var(--team-primary)' : 'transparent',
                              }}
                            />
                            <span className={isActive ? 'text-foreground' : undefined}>{item}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            )}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col md:min-h-screen">
            <header className="border-b border-border bg-white/80 px-4 py-3 md:sticky md:top-0 md:z-40 md:bg-white/95 md:px-6 md:backdrop-blur">
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
                            <span>OVR {liveTeamSummary.overall ?? '—'}</span>
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
                    </div>
                  </div>
                  <div className="relative md:hidden">
                    <button
                      type="button"
                      onClick={() => setIsProfileOpen((open) => !open)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white"
                    >
                      <span className="text-sm font-semibold text-muted-foreground">JD</span>
                    </button>
                    {isProfileOpen ? (
                      <div className="absolute right-0 top-12 z-10 w-48 rounded-lg border border-border bg-white p-2 text-sm shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Settings
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Log out
                        </button>
                      </div>
                    ) : null}
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
                            <span>OVR {liveTeamSummary.overall ?? '—'}</span>
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

                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsProfileOpen((open) => !open)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white"
                      >
                        <span className="text-sm font-semibold text-muted-foreground">JD</span>
                      </button>
                      {isProfileOpen ? (
                        <div className="absolute right-0 top-12 w-48 rounded-lg border border-border bg-white p-2 text-sm shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Profile
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Settings
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Log out
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </header>

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

            <main className="min-w-0 flex-1 px-4 py-5 sm:py-6 md:px-8">
              {children}
            </main>
          </div>
          <TradeOfferToast scopeKey={tradeOfferScopeKey} />
          <ToastViewport />
        </div>
      </ToastProvider>
    </TeamThemeProvider>
  );
}
