'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Lock, Menu, X } from 'lucide-react';

import TeamThemeProvider from '@/components/team-theme-provider';
import ConfirmAdvanceModal from '@/components/confirm-advance-modal';
import NextActionBanner from '@/components/next-action-banner';
import { TeamFavicon } from '@/components/team-favicon';
import { AdSlot } from '@/components/ads/AdSlot';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { TEAM_CAP_SPACE } from '@/data/team-caps';
import { computeCapRank, formatCapMillions, ordinal } from '@/lib/cap-space';
import { buildCapCrisisAlert } from '@/lib/falco-alerts';
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
  const isUserOnClock = useSaveStore((state) => state.isUserOnClock);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const advancePhase = useSaveStore((state) => state.advancePhase);
  const setPhase = useSaveStore((state) => state.setPhase);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<'free_agency' | 'draft' | 'season' | null>(
    null,
  );
  const [capPulse, setCapPulse] = useState(false);
  const wasNegativeRef = useRef(false);
  const lastSaveIdRef = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!saveId && pathname !== '/') {
      router.replace('/');
    }
  }, [hasHydrated, pathname, router, saveId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [selectedTeamId, teams],
  );

  const hasCapSpace = hasHydrated && Boolean(saveId);
  const activeCapDollars = hasCapSpace ? capSpace * 1_000_000 : 0;
  const capsWithActive = useMemo(
    () =>
      TEAM_CAP_SPACE.map((entry) =>
        entry.teamAbbr === selectedTeam?.abbr ? { ...entry, capSpace: activeCapDollars } : entry,
      ),
    [activeCapDollars, selectedTeam?.abbr],
  );
  const capRank = selectedTeam
    ? computeCapRank(selectedTeam.abbr, capsWithActive)
    : capsWithActive.length + 1;
  const formattedCapSpace = hasCapSpace ? formatCapMillions(activeCapDollars) : '—';
  const showOnTheClock = Boolean(isUserOnClock && pathname?.startsWith('/draft'));

  const lockedRoutes = useMemo(() => {
    const locked = new Set<NavItem>();
    if (phase !== 'resign_cut') {
      locked.add('Re-sign/Cut Players');
    }
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
      setCapPulse(true);
      timer = window.setTimeout(() => setCapPulse(false), 900);
    }
    wasNegativeRef.current = isNegative;
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [capSpace, pushAlert, saveId]);

  const showNextActionBanner = useMemo(() => {
    if (!pathname) return false;
    if (phase === 'resign_cut') {
      return pathname.startsWith('/roster');
    }
    if (phase === 'free_agency') {
      return pathname.startsWith('/free-agents');
    }
    if (phase === 'draft') {
      return pathname.startsWith('/draft');
    }
    return false;
  }, [pathname, phase]);

  const bannerPhase: 'resign_cut' | 'free_agency' | 'draft' | 'season' =
    phase === 'free_agency' || phase === 'draft' || phase === 'season' ? phase : 'resign_cut';

  useEffect(() => {
    if (!pathname) return;
    if (phase === 'resign_cut') {
      if (pathname.startsWith('/free-agents') || pathname.startsWith('/draft')) {
        router.replace('/roster');
      }
      return;
    }
    if (phase === 'free_agency') {
      if (pathname.startsWith('/roster') || pathname.startsWith('/draft')) {
        router.replace('/free-agents');
      }
      return;
    }
    if (phase === 'draft') {
      if (pathname.startsWith('/roster') || pathname.startsWith('/free-agents')) {
        router.replace('/draft/room?mode=mock');
      }
    }
  }, [pathname, phase, router]);

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

  if (hasHydrated && !saveId && pathname !== '/') {
    return null;
  }

  return (
    <TeamThemeProvider team={selectedTeam}>
      <ToastProvider>
        <TeamFavicon primaryColor={selectedTeam?.color_primary ?? null} />
        <div
          className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50 md:flex-row"
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
            className="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r border-border bg-white/95 px-5 pb-6 pt-0 transition-transform md:static md:z-auto md:flex md:translate-x-0 md:flex-col md:self-start md:sticky md:top-0 md:max-h-[100vh] md:overflow-y-auto md:bg-white/80"
            style={{ transform: isMobileSidebarOpen ? 'translateX(0)' : undefined }}
          >
            <div className="mb-[20px] mt-[20px] text-left text-sm">
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
            </div>
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
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 items-center justify-between border-b border-border bg-white/80 px-4 md:sticky md:top-0 md:z-40 md:bg-white/95 md:backdrop-blur md:px-6">
              <div className="flex items-center gap-3">
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
                <div className="hidden flex-col md:flex">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Active Team
                  </span>
                  <span className="text-sm font-semibold">
                    {selectedTeam?.name ?? 'Select a team'}
                  </span>
                </div>
                <div className="ml-2 flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
                    Cap
                  </span>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:block">
                    Cap Space
                  </span>
                  <span
                    className={cn(
                      'whitespace-nowrap text-xs font-semibold md:text-sm',
                      hasCapSpace && activeCapDollars < 0 ? 'text-destructive' : 'text-foreground',
                      capPulse ? 'animate-pulse' : null,
                    )}
                  >
                    {hasCapSpace ? `${formattedCapSpace} / ${ordinal(capRank)}` : '—'}
                  </span>
                </div>
                {showOnTheClock ? (
                  <span
                    className="ml-3 hidden text-xs font-extrabold uppercase tracking-[0.25em] text-[#ff2d55] md:inline md:text-sm"
                    style={{ textShadow: '0 2px 12px rgba(255, 45, 85, 0.45)' }}
                  >
                    ON THE CLOCK
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden lg:block">
                  <AdSlot placement="HEADER" />
                </div>
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

            <main className="flex-1 min-w-0 px-4 py-6 md:px-8">
              {showNextActionBanner ? (
                <NextActionBanner
                  phase={bannerPhase}
                  capSpaceMillions={capSpace}
                  teamPrimaryColor={selectedTeam?.color_primary ?? 'var(--team-primary)'}
                  onAdvance={() => {
                    if (!saveId) return;
                    if (phase === 'resign_cut') {
                      setAdvanceTarget('free_agency');
                      setIsAdvanceModalOpen(true);
                      return;
                    }
                    if (phase === 'free_agency') {
                      setAdvanceTarget('draft');
                      setIsAdvanceModalOpen(true);
                      return;
                    }
                    if (phase === 'draft') {
                      setAdvanceTarget('season');
                      setIsAdvanceModalOpen(true);
                    }
                  }}
                />
              ) : null}
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
          <ToastViewport />
        </div>
      </ToastProvider>
    </TeamThemeProvider>
  );
}
