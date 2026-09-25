'use client';

import { getActiveSimulationRoster } from '@/lib/front-office-roster';

import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUp } from 'lucide-react';

import { FrontOfficeMobileStatus } from '@/components/front-office/front-office-mobile-status';
import MainSiteHeader from '@/components/main-site-header';
import {
  FrontOfficeSidebar,
  FrontOfficeMobileNav,
} from '@/components/front-office/front-office-sidebar';
import TeamThemeProvider from '@/components/team-theme-provider';
import { FrontOfficePhaseControl } from '@/components/front-office/front-office-phase-control';
import { FrontOfficeEventCenter } from '@/components/front-office/front-office-event-center';
import { PhaseStepper } from '@/components/phase-stepper';
import { TeamFavicon } from '@/components/team-favicon';
import { TradeOfferToast } from '@/components/trade-offer-toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useExperienceStore } from '@/features/experience/experience-store';
import { getStepForPath } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildCapCrisisAlert } from '@/lib/falco-alerts';
import { formatMoneyMillions } from '@/server/logic/cap';
import { computeTeamNeeds, computeTeamOverviewRaw, scaleOverviewScore } from '@/lib/team-overview';
import { cn } from '@/lib/utils';

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

export default function AppShell({
  children,
  showTeamSummary = true,
  showLeagueWire = true,
  phaseControl,
  preFranchise = false,
}: {
  children: React.ReactNode;
  showTeamSummary?: boolean;
  showLeagueWire?: boolean;
  phaseControl?: React.ReactNode;
  preFranchise?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <AppShellContent
        preFranchise={preFranchise}
        phaseControl={phaseControl}
        showTeamSummary={showTeamSummary}
        showLeagueWire={showLeagueWire}
      >
        {children}
      </AppShellContent>
    </Suspense>
  );
}

function AppShellContent({
  children,
  showTeamSummary,
  showLeagueWire,
  phaseControl,
  preFranchise = false,
}: {
  children: React.ReactNode;
  showTeamSummary: boolean;
  showLeagueWire: boolean;
  phaseControl?: React.ReactNode;
  preFranchise?: boolean;
}) {
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const saveId = useSaveStore((state) => state.saveId);
  const storedTeamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const startingCapSpace = useSaveStore((state) => state.startingCapSpace);
  const startingOverall = useSaveStore((state) => state.startingOverall);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
  const roster = useSaveStore((state) => state.roster);
  const isUserOnClock = useSaveStore((state) => state.isUserOnClock);
  const phase = useSaveStore((state) => state.phase);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const freeAgencyWave = useSaveStore((state) => state.freeAgencyWave);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const mode = useExperienceStore((state) => state.mode);
  const experienceHasHydrated = useExperienceStore((state) => state.hasHydrated);
  const isHydrated = hasHydrated && experienceHasHydrated;
  const currentStep = useExperienceStore((state) => state.currentStep);
  const completedSteps = useExperienceStore((state) => state.completedSteps);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const wasNegativeRef = useRef(false);
  const lastSaveIdRef = useRef<string | null>(null);
  const pathname = usePathname()?.replace(/^\/offseasonmanager(?=\/)/, '') ?? '';
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
    () => getActiveSimulationRoster(roster, storedTeamAbbr || selectedTeam?.abbr),
    [roster, storedTeamAbbr, selectedTeam?.abbr],
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
        : Math.round(rawOverview.overall);

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
  const [record, setRecord] = useState('—');

  const showOnTheClock = Boolean(isUserOnClock && pathname?.startsWith('/draft'));

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

    const desktop = window.matchMedia('(min-width: 1100px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMobileSidebarOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  if (!isHydrated) {
    return (
      <TeamThemeProvider team={teams[0]}>
        <div
          className={`front-office-app min-h-screen ${pathname?.endsWith('/experience') ? 'fo-home-shell' : ''} ${pathname === '/front-office/draft' ? 'fo-draft-central-shell' : ''}`}
        />
      </TeamThemeProvider>
    );
  }

  if (!saveId && pathname !== '/') {
    return null;
  }

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
      <div
        className={`front-office-app min-h-screen ${pathname?.endsWith('/experience') ? 'fo-home-shell' : ''} ${pathname === '/front-office/draft' ? 'fo-draft-central-shell' : ''}`}
      >
        <FrontOfficeMobileNav
          preFranchise={preFranchise}
          open={isMobileSidebarOpen}
          onOpen={() => setIsMobileSidebarOpen(true)}
        />
        <div className="front-office-shell flex min-h-[calc(100vh-var(--site-header-height))] flex-col">
          <FrontOfficeSidebar
            preFranchise={preFranchise}
            team={selectedTeam}
            season={franchiseYear}
            open={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
          <div className="front-office-content flex min-w-0 flex-1 flex-col">
            {!preFranchise && (showTeamSummary || pathname === '/experience') && (
              <FrontOfficeMobileStatus />
            )}
            {showTeamSummary && (
              <details className="fo-mobile-franchise-actions">
                <summary>Franchise actions</summary>
                <FrontOfficePhaseControl
                  season={franchiseYear}
                  phase={phase}
                  freeAgencyWave={freeAgencyWave}
                  actionOverride={phaseControl}
                />
              </details>
            )}
            {showTeamSummary ? (
              <header className="front-office-team-summary fo-franchise-summary">
                <dl>
                  <div>
                    <dd>
                      <span className="front-office-stat-value">
                        {liveTeamSummary.overall ?? '—'}
                      </span>{' '}
                      <HeaderDelta delta={liveOverallDelta} />
                    </dd>
                    <dt>Team OVR</dt>
                  </div>
                  <div>
                    <dd>
                      <span className="front-office-stat-value">{record}</span>
                    </dd>
                    <dt>Record</dt>
                  </div>
                  <div>
                    <dd>
                      <span className="front-office-stat-value">
                        {formatMoneyMillions(capSpace)}
                      </span>
                      <HeaderDelta delta={liveCapSpaceDelta} suffix="M" />
                    </dd>
                    <dt>Cap Space</dt>
                  </div>
                  <div>
                    <dd>
                      <span className="front-office-stat-value">
                        {liveRosterPlayers.length} / {rosterLimit || '—'}
                      </span>
                    </dd>
                    <dt>{showOnTheClock ? 'On the clock' : 'Roster Size'}</dt>
                  </div>
                </dl>
                <FrontOfficePhaseControl
                  season={franchiseYear}
                  phase={phase}
                  freeAgencyWave={freeAgencyWave}
                  actionOverride={phaseControl}
                  onRecordChange={setRecord}
                />
              </header>
            ) : null}

            {showTeamSummary && showOffseasonStepper && mode === 'full' ? (
              <div className="fo-desktop-phase-stepper">
                <PhaseStepper currentStep={currentStep} completedSteps={completedSteps} />
              </div>
            ) : null}

            {showTeamSummary && showOnTheClock ? (
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
            </div>
          </div>
          <TradeOfferToast scopeKey={tradeOfferScopeKey} />
          {showLeagueWire && saveId ? (
            <FrontOfficeEventCenter saveId={saveId} teamAbbr={storedTeamAbbr ?? ''} />
          ) : null}
        </div>
      </div>
    </TeamThemeProvider>
  );
}
