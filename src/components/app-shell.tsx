'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Menu, X } from 'lucide-react';

import TeamThemeProvider from '@/components/team-theme-provider';
import ConfirmAdvanceModal from '@/components/confirm-advance-modal';
import NextActionBanner from '@/components/next-action-banner';
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
  const storedTeamId = useSaveStore((state) => state.teamId);
  const storedTeamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const clearSave = useSaveStore((state) => state.clearSave);
  const advancePhase = useSaveStore((state) => state.advancePhase);
  const setPhase = useSaveStore((state) => state.setPhase);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<'free_agency' | 'draft' | 'season' | null>(
    null,
  );
  const [capPulse, setCapPulse] = useState(false);
  const loadKeyRef = useRef<string | null>(null);
  const isBootstrappingRef = useRef(false);
  const wasNegativeRef = useRef(false);
  const lastSaveIdRef = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const hasActiveTeam = Boolean(storedTeamAbbr);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!hasActiveTeam && pathname !== '/teams') {
      router.replace('/teams');
    }
  }, [hasActiveTeam, hasHydrated, pathname, router]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [selectedTeamId, teams],
  );

  const activeCapDollars = saveId ? capSpace * 1_000_000 : 0;
  const capsWithActive = useMemo(
    () =>
      TEAM_CAP_SPACE.map((entry) =>
        entry.teamAbbr === selectedTeam?.abbr
          ? { ...entry, capSpace: activeCapDollars }
          : entry,
      ),
    [activeCapDollars, selectedTeam?.abbr],
  );
  const capRank = selectedTeam
    ? computeCapRank(selectedTeam.abbr, capsWithActive)
    : capsWithActive.length + 1;
  const formattedCapSpace = saveId ? formatCapMillions(activeCapDollars) : '--';
  const capRankLabel = ordinal(capRank);

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

  useEffect(() => {
    const loadSave = async () => {
      if (!hasHydrated) {
        return;
      }
      if (!hasActiveTeam) {
        return;
      }
      if (!selectedTeam?.abbr) {
        return;
      }

      if (storedTeamAbbr && selectedTeam.abbr !== storedTeamAbbr) {
        return;
      }

      const loadKey = `${selectedTeam.abbr}:${saveId ?? 'new'}`;
      // Guard against repeated save bootstrapping that causes rerender flicker.
      if (loadKeyRef.current === loadKey || isBootstrappingRef.current) {
        return;
      }
      loadKeyRef.current = loadKey;
      isBootstrappingRef.current = true;

      try {
        const isPersistedForTeam =
          Boolean(saveId) &&
          (selectedTeam.id === storedTeamId || selectedTeam.abbr === storedTeamAbbr);

        if (isPersistedForTeam && saveId) {
          try {
            const headerResponse = await fetch(`/api/saves/header?saveId=${saveId}`);
            if (headerResponse.ok) {
              const headerData = (await headerResponse.json()) as
                | {
                    ok: true;
                    saveId: string;
                    teamAbbr: string;
                    capSpace: number;
                    capLimit: number;
                    rosterCount: number;
                    rosterLimit: number;
                    phase: string;
                    unlocked?: { freeAgency: boolean; draft: boolean };
                  }
                | { ok: false; error: string };
              if (headerData.ok) {
                setSaveHeader(
                  {
                    ...headerData,
                    unlocked: headerData.unlocked ?? { freeAgency: false, draft: false },
                    createdAt: new Date().toISOString(),
                  },
                  selectedTeam.id,
                );
                return;
              }
            } else if (headerResponse.status === 404) {
              clearSave();
            }
          } catch {
            // Ignore errors when loading persisted save, will fall through to create new one
          }
        }

        const query = new URLSearchParams({ teamAbbr: selectedTeam.abbr });
        const existingResponse = await fetch(`/api/saves?${query.toString()}`);
        if (existingResponse.ok) {
          const existingData = (await existingResponse.json()) as
            | {
                ok: true;
                saves: Array<{
                  saveId: string;
                  teamAbbr: string;
                  capSpace: number;
                  capLimit: number;
                  rosterCount: number;
                  rosterLimit: number;
                  phase: string;
                  unlocked?: { freeAgency: boolean; draft: boolean };
                  createdAt: string;
                }>;
              }
            | { ok: false; error: string };
          if (existingData.ok && existingData.saves.length > 0) {
            const save = [...existingData.saves].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )[0];
            setSaveHeader(
              {
                ...save,
                ok: true,
                unlocked: save.unlocked ?? { freeAgency: false, draft: false },
              },
              selectedTeam.id,
            );
            return;
          }
        }

        const response = await fetch('/api/saves/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: selectedTeam.id, teamAbbr: selectedTeam.abbr }),
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as
          | {
              ok: true;
              saveId: string;
              teamAbbr: string;
              capSpace: number;
              capLimit: number;
              rosterCount: number;
              rosterLimit: number;
              phase: string;
              unlocked?: { freeAgency: boolean; draft: boolean };
            }
          | { ok: false; error: string };
        if (!data.ok) {
          return;
        }

        setSaveHeader(
          {
            ...data,
            unlocked: data.unlocked ?? { freeAgency: false, draft: false },
            createdAt: new Date().toISOString(),
          },
          selectedTeam.id,
        );
      } finally {
        isBootstrappingRef.current = false;
      }
    };

    loadSave();
  }, [
    clearSave,
    hasHydrated,
    hasActiveTeam,
    saveId,
    selectedTeam?.abbr,
    selectedTeam?.id,
    setSaveHeader,
    storedTeamAbbr,
    storedTeamId,
  ]);

  if (hasHydrated && !hasActiveTeam && pathname !== '/teams') {
    return null;
  }

  return (
    <TeamThemeProvider team={selectedTeam}>
      <ToastProvider>
        <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
          {isMobileSidebarOpen ? (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />
          ) : null}

          <aside
            className="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r border-border bg-white/95 px-5 py-6 transition-transform md:static md:z-auto md:flex md:translate-x-0 md:flex-col md:bg-white/80"
            style={{ transform: isMobileSidebarOpen ? 'translateX(0)' : undefined }}
          >
            <div className="mb-[20px] text-left text-sm">
              <Image
                src="/images/falco_logo.png"
                alt="Falco"
                width={200}
                height={60}
                className="block h-auto w-auto max-h-[120px] max-w-[120px] object-contain"
                priority
              />
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

          <div className="flex flex-1 flex-col">
            <header className="flex h-16 items-center justify-between border-b border-border bg-white/80 px-4 md:px-6">
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
                  className="group flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-white transition hover:ring-2 hover:ring-ring"
                >
                  {selectedTeam?.logo_url ? (
                    <img
                      src={selectedTeam.logo_url}
                      alt={`${selectedTeam.name} logo`}
                      className="h-full w-full object-cover"
                    />
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
                <div className="ml-2 flex flex-col rounded-xl border border-border bg-white px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Cap Space
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold md:text-sm',
                      saveId && activeCapDollars < 0 ? 'text-destructive' : 'text-foreground',
                      capPulse ? 'animate-pulse' : null,
                    )}
                  >
                    {formattedCapSpace} / {ordinal(capRank)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  onClick={clearSave}
                >
                  Reset Save
                </button>
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

            <main className="flex-1 px-4 py-6 md:px-8">
              {showNextActionBanner ? (
                <NextActionBanner
                  phase={phase}
                  capSpaceMillions={capSpace}
                  capRankLabel={capRankLabel}
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
