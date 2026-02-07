'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Handshake, Lock, Menu, PlayCircle, Users, X } from 'lucide-react';

import TeamThemeProvider from '@/components/team-theme-provider';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';

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
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const clearSave = useSaveStore((state) => state.clearSave);
  const advancePhase = useSaveStore((state) => state.advancePhase);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const loadKeyRef = useRef<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [selectedTeamId, teams],
  );

  const formattedCapSpace = saveId ? `$${capSpace.toFixed(1)}M` : '--';
  const formattedRoster = saveId ? `${rosterCount}/${rosterLimit}` : '--';
  const phaseLabel = useMemo(() => {
    switch (phase) {
      case 'draft':
        return 'Draft';
      case 'free_agency':
        return 'Free Agency';
      case 'season':
        return 'Season';
      default:
        return 'Re-sign/Cut Players';
    }
  }, [phase]);

  const lockedRoutes = useMemo(() => {
    const locked = new Set<NavItem>();
    if (!unlocked.freeAgency) {
      locked.add('Free Agency');
    }
    if (!unlocked.draft) {
      locked.add('Draft');
    }
    return locked;
  }, [unlocked.draft, unlocked.freeAgency]);

  const nextAction = useMemo(() => {
    if (phase === 'free_agency') {
      return {
        title: 'Fill roster holes by signing free agents',
        subtitle: 'Upgrade starters and depth—keep an eye on cap space.',
        ctaLabel: 'Go to free agency',
        href: '/free-agents',
        advanceLabel: 'Enter Draft',
        advanceHref: '/draft/room?mode=mock',
      };
    }
    if (phase === 'draft') {
      return {
        title: 'Draft the future of your franchise.',
        subtitle: 'Use picks and trades to add impact rookies.',
        ctaLabel: 'Go to draft room',
        href: '/draft/room?mode=mock',
        advanceLabel: 'Start Season',
        advanceHref: '/overview',
      };
    }
    if (phase === 'season') {
      return {
        title: 'Season ready.',
        subtitle: 'Your roster is set—manage, trade, and simulate the year.',
        ctaLabel: 'View overview',
        href: '/overview',
        advanceLabel: null,
        advanceHref: null,
      };
    }
    return {
      title: 'Re-sign or cut players before Free Agency',
      subtitle: 'Get under the cap and shape your roster before entering the market.',
      ctaLabel: 'Go to roster',
      href: '/roster',
      advanceLabel: 'Enter Free Agency',
      advanceHref: '/free-agents',
    };
  }, [phase]);

  const phaseIcon = useMemo(() => {
    switch (phase) {
      case 'free_agency':
        return Users;
      case 'draft':
        return ClipboardList;
      case 'season':
        return PlayCircle;
      default:
        return Handshake;
    }
  }, [phase]);

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
      if (!selectedTeam?.abbr) {
        return;
      }

      const loadKey = `${selectedTeam.abbr}:${saveId ?? 'new'}`;
      // Guard against repeated save bootstrapping that causes rerender flicker.
      if (loadKeyRef.current === loadKey) {
        return;
      }
      loadKeyRef.current = loadKey;

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
          const save = existingData.saves[0];
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
    };

    loadSave();
  }, [
    clearSave,
    saveId,
    selectedTeam?.abbr,
    selectedTeam?.id,
    setSaveHeader,
    storedTeamAbbr,
    storedTeamId,
  ]);

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
            <div
              className="rounded-xl border border-transparent p-4 text-[var(--team-primary-foreground)] mb-6 text-left text-sm"
              style={{
                backgroundColor: 'var(--team-primary)',
              }}
            >
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">
                    Cap Space
                  </span>
                  <p className="mt-0.5 text-sm font-bold">Cap Space: {formattedCapSpace}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Roster</span>
                  <p className="mt-0 text-sm font-semibold">Roster: {formattedRoster}</p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[10px] font-semibold">
                  {phaseLabel}
                </span>
              </div>
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
              <div
                className="mb-6 rounded-2xl border border-transparent p-5 text-[var(--team-primary-foreground)]"
                style={{
                  backgroundColor: 'var(--team-primary)',
                }}
              >
                <p
                  className="text-xs uppercase tracking-[0.2em]"
                  style={{
                    color: 'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
                  }}
                >
                  Next Action
                </p>
                <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/15">
                      {(() => {
                        const Icon = phaseIcon;
                        return <Icon className="h-5 w-5" />;
                      })()}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{nextAction.title}</h2>
                      <p
                        className="text-sm"
                        style={{
                          color:
                            'color-mix(in srgb, var(--team-primary-foreground) 70%, transparent)',
                        }}
                      >
                        {nextAction.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {nextAction.advanceLabel ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold"
                        style={{ color: 'var(--team-primary-foreground)' }}
                        onClick={async () => {
                          if (!saveId) {
                            return;
                          }
                          await advancePhase();
                          if (nextAction.advanceHref) {
                            router.push(nextAction.advanceHref);
                          }
                        }}
                      >
                        {nextAction.advanceLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              {children}
            </main>
          </div>
          <ToastViewport />
        </div>
      </ToastProvider>
    </TeamThemeProvider>
  );
}
