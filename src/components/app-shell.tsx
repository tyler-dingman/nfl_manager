'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDownRight, ArrowUpRight, Lock, Menu, Minus, X } from 'lucide-react';

import TeamThemeProvider from '@/components/team-theme-provider';
import ConfirmAdvanceModal from '@/components/confirm-advance-modal';
import { StepIndicator } from '@/components/offseason/step-indicator';
import { OffseasonStepperNav } from '@/components/offseason/offseason-stepper-nav';
import { TeamFavicon } from '@/components/team-favicon';
import { TradeOfferToast } from '@/components/trade-offer-toast';
import { AdSlot } from '@/components/ads/AdSlot';
import { Button } from '@/components/ui/button';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { getRouteForStep, getStepForPath } from '@/features/experience/experience-utils';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildCapCrisisAlert } from '@/lib/falco-alerts';
import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import {
  createEmptyOffseasonProgressSnapshot,
  getHighestUnlockedStepIndexFromProgress,
  getStepProgressPercent,
} from '@/lib/offseason-progress';
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const saveId = useSaveStore((state) => state.saveId);
  const storedTeamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const isUserOnClock = useSaveStore((state) => state.isUserOnClock);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const setPhase = useSaveStore((state) => state.setPhase);
  const mode = useExperienceStore((state) => state.mode);
  const experienceHasHydrated = useExperienceStore((state) => state.hasHydrated);
  const isHydrated = hasHydrated && experienceHasHydrated;
  const currentStep = useExperienceStore((state) => state.currentStep);
  const completedSteps = useExperienceStore((state) => state.completedSteps);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const progressSnapshot = useOffseasonProgressStore((state) =>
    saveId ? (state.bySave[saveId] ?? createEmptyOffseasonProgressSnapshot()) : createEmptyOffseasonProgressSnapshot(),
  );
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<'free_agency' | 'draft' | 'season' | null>(
    null,
  );
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
    if (
      liveTeamSummary.overall === null ||
      liveTeamSummary.overall === undefined ||
      selectedTeam?.teamOverview === null ||
      selectedTeam?.teamOverview === undefined
    ) {
      return null;
    }

    const delta = liveTeamSummary.overall - selectedTeam.teamOverview;
    return delta === 0 ? null : delta;
  }, [liveTeamSummary.overall, selectedTeam?.teamOverview]);
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
  const TrajectoryIcon =
    liveTrajectory.state === 'Contender' || liveTrajectory.state === 'Rising'
      ? ArrowUpRight
      : liveTrajectory.state === 'Balanced'
        ? Minus
        : ArrowDownRight;
  const headerStepIndex = useMemo(() => {
    if (mode === 'full') {
      const fullModeIndex = OFFSEASON_STEPS.findIndex((step) => step.id === currentStep);
      return fullModeIndex >= 0 ? fullModeIndex : 0;
    }

    if (phase === 'draft' || phase === 'season') {
      return 2;
    }
    if (phase === 'free_agency') {
      return 1;
    }
    return 0;
  }, [currentStep, mode, phase]);
  const actualUnlockedStepIndex = useMemo(() => {
    if (phase === 'draft' || phase === 'season' || unlocked.draft) {
      return 2;
    }
    if (phase === 'free_agency' || unlocked.freeAgency) {
      return 1;
    }
    return 0;
  }, [phase, unlocked.draft, unlocked.freeAgency]);
  const progressUnlockedStepIndex = useMemo(
    () => getHighestUnlockedStepIndexFromProgress(progressSnapshot),
    [progressSnapshot],
  );
  const stepIndicatorUnlockedIndex = Math.max(actualUnlockedStepIndex, progressUnlockedStepIndex);
  const completedStepIndices = useMemo(
    () =>
      OFFSEASON_STEPS.flatMap((step, index) =>
        completedSteps.includes(step.id) || getStepProgressPercent(progressSnapshot, step.id) >= 100
          ? [index]
          : [],
      ),
    [completedSteps, progressSnapshot],
  );

  useEffect(() => {
    if (!pathname) return;
    if (mode === 'full') {
      const requestedStep = getStepForPath(pathname);
      if (!requestedStep) return;
      if (requestedStep !== currentStep && requestedStep !== 'manage') {
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
    if (phase === 'draft') {
      if (pathname.startsWith('/free-agents')) {
        router.replace('/draft/room?mode=mock');
      }
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

  const headerAdvanceTarget = useMemo<'free_agency' | 'draft' | 'season'>(() => {
    if (mode === 'full') {
      if (currentStep === 'manage') return 'free_agency';
      if (currentStep === 'free-agency') return 'draft';
      return 'season';
    }

    if (phase === 'free_agency') return 'draft';
    if (phase === 'draft' || phase === 'season') return 'season';
    return 'free_agency';
  }, [currentStep, mode, phase]);

  const handleHeaderContinue = () => {
    if (!saveId) return;
    setAdvanceTarget(headerAdvanceTarget);
    setIsAdvanceModalOpen(true);
  };

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
                      <span className="text-foreground">OVR {liveTeamSummary.overall ?? '—'}</span>
                      <TrajectoryIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{liveTrajectory.state}</span>
                    </span>
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

                <div className="md:hidden">
                  <StepIndicator
                    currentStep={headerStepIndex}
                    steps={['Manage', 'Free Agency', 'Draft']}
                    unlockedStepIndex={stepIndicatorUnlockedIndex}
                    completedStepIndices={completedStepIndices}
                    className="w-full"
                  />
                </div>

                <div className="md:hidden">
                  <Button
                    type="button"
                    onClick={handleHeaderContinue}
                    className="h-10 w-full bg-[var(--team-primary)] text-[var(--team-primary-foreground)] hover:bg-[var(--team-primary)] hover:opacity-95"
                  >
                    Continue
                  </Button>
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
                        <span className="text-foreground">OVR {liveTeamSummary.overall ?? '—'}</span>
                        <TrajectoryIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{liveTrajectory.state}</span>
                      </span>
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
                    <StepIndicator
                      currentStep={headerStepIndex}
                      steps={['Manage', 'Free Agency', 'Draft']}
                      unlockedStepIndex={stepIndicatorUnlockedIndex}
                      completedStepIndices={completedStepIndices}
                      className="max-w-full"
                    />
                    <Button
                      type="button"
                      onClick={handleHeaderContinue}
                      className="h-10 shrink-0 bg-[var(--team-primary)] px-4 text-[var(--team-primary-foreground)] hover:bg-[var(--team-primary)] hover:opacity-95"
                    >
                      Continue
                    </Button>
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
          <ConfirmAdvanceModal
            open={isAdvanceModalOpen}
            onOpenChange={setIsAdvanceModalOpen}
            title={
              advanceTarget === 'draft'
                ? 'Enter the Draft'
                : advanceTarget === 'season'
                  ? 'Enter the Season'
                  : 'Enter Free Agency'
            }
            body={
              advanceTarget === 'draft'
                ? `You’re about to enter the NFL Draft.\n\nOnce you move on, Free Agency will be closed and you won’t be able to sign additional free agents.\n\nMake sure your roster is ready and your cap space is where you want it before drafting.`
                : advanceTarget === 'season'
                  ? `You’re about to begin the season.\n\nOnce you move on, the draft stage will be locked and you won’t be able to make further draft picks.\n\nMake sure your roster is ready before you move on.`
                  : `You’re about to enter Free Agency.\n\nOnce you move on, the re-sign / cut stage will be closed and you won’t be able to return to make additional cap moves here.\n\nMake sure you’re comfortable with your cap space and roster before entering the market.`
            }
            confirmText={
              advanceTarget === 'draft'
                ? 'Confirm & Enter Draft'
                : advanceTarget === 'season'
                  ? 'Confirm & Enter Season'
                  : 'Confirm & Enter Free Agency'
            }
            onConfirm={async () => {
              if (!saveId || !advanceTarget) return;
              if (advanceTarget === 'free_agency') {
                recordProgressEvent({
                  saveId,
                  step: 'manage',
                  eventKey: 'manage:continue',
                  complete: true,
                });
                if (mode === 'full' && currentStep === 'manage') {
                  completeCurrentStep();
                }
              } else if (advanceTarget === 'draft') {
                recordProgressEvent({
                  saveId,
                  step: 'free-agency',
                  eventKey: 'free-agency:continue',
                  complete: true,
                });
                if (mode === 'full' && currentStep === 'free-agency') {
                  completeCurrentStep();
                }
              } else {
                recordProgressEvent({
                  saveId,
                  step: 'draft',
                  eventKey: 'draft:continue',
                  complete: true,
                });
                if (mode === 'full' && currentStep === 'draft') {
                  completeCurrentStep();
                }
              }
              await setPhase(advanceTarget);
              setIsAdvanceModalOpen(false);
              setAdvanceTarget(null);
              if (advanceTarget === 'draft') {
                router.push('/draft/room?mode=mock');
              } else if (advanceTarget === 'free_agency') {
                router.push('/free-agents');
              }
            }}
          />
          <TradeOfferToast scopeKey={tradeOfferScopeKey} />
          <ToastViewport />
        </div>
      </ToastProvider>
    </TeamThemeProvider>
  );
}
