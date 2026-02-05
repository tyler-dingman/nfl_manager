'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';

import TeamThemeProvider from '@/components/team-theme-provider';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';

const navRoutes = {
  Overview: '/',
  Roster: '/roster',
  'Free Agents': '/free-agents',
  Trades: '/manage/trades',
  'Big Board': '/draft/big-board',
  'Draft Room': '/draft/room?mode=mock',
} as const;

type NavItem = keyof typeof navRoutes;

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Home',
    items: ['Overview'],
  },
  {
    title: 'Manage Team',
    items: ['Roster', 'Free Agents', 'Trades'],
  },
  {
    title: 'Draft',
    items: ['Big Board', 'Draft Room'],
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
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

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

  // Close mobile sidebar when pathname changes
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [selectedTeamId, teams],
  );

  const formattedCapSpace = saveId ? `$${capSpace.toFixed(1)}M` : '--';
  const formattedRoster = saveId ? `${rosterCount}/${rosterLimit}` : '--';

  useEffect(() => {
    const loadSave = async () => {
      if (!selectedTeam?.abbr) {
        return;
      }

      const isPersistedForTeam =
        Boolean(saveId) &&
        (selectedTeam.id === storedTeamId || selectedTeam.abbr === storedTeamAbbr);

      if (isPersistedForTeam && saveId) {
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
              }
            | { ok: false; error: string };
          if (headerData.ok) {
            setSaveHeader({ ...headerData, createdAt: new Date().toISOString() }, selectedTeam.id);
            return;
          }
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
                createdAt: string;
              }>;
            }
          | { ok: false; error: string };
        if (existingData.ok && existingData.saves.length > 0) {
          const save = existingData.saves[0];
          setSaveHeader({ ...save, ok: true }, selectedTeam.id);
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
          }
        | { ok: false; error: string };
      if (!data.ok) {
        return;
      }

      setSaveHeader({ ...data, createdAt: new Date().toISOString() }, selectedTeam.id);
    };

    loadSave();
  }, [saveId, selectedTeam?.abbr, selectedTeam?.id, setSaveHeader, storedTeamAbbr, storedTeamId]);

  return (
    <TeamThemeProvider team={selectedTeam}>
      <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col gap-6 border-r border-border bg-white/95 px-5 py-6 transition-transform duration-300 ease-in-out md:static md:top-0 md:z-0 md:h-auto md:w-64 md:max-w-none md:bg-white/80 md:translate-x-0 ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Primary navigation"
        >
          <div className="flex items-center justify-between md:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Navigation
            </p>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="rounded-xl border border-transparent p-4"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--team-primary) 8%, transparent)',
            }}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Team</p>
            <p className="mt-2 text-lg font-semibold">{selectedTeam?.name}</p>
            <p className="text-sm text-muted-foreground">{selectedTeam?.abbr}</p>
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
                    return (
                      <Link
                        key={item}
                        href={href}
                        onClick={() => setIsMobileSidebarOpen(false)}
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
          <header className="flex min-h-16 items-center justify-between gap-2 border-b border-border bg-white/80 px-3 py-2 sm:px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="rounded-md p-1 md:hidden"
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                aria-expanded={isMobileSidebarOpen}
                aria-label="Toggle navigation"
              >
                {isMobileSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                {selectedTeam?.logo_url ? (
                  <img
                    src={selectedTeam.logo_url}
                    alt={`${selectedTeam.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {selectedTeam?.abbr}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground md:hidden">
                  {selectedTeam?.abbr}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:hidden">
                  {formattedCapSpace} · {formattedRoster}
                </p>
              </div>
              <div className="hidden min-w-0 flex-col md:flex">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Active Team
                </span>
                <span className="truncate text-sm font-semibold">{selectedTeam?.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <label className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:block">
                Switch
              </label>
              <select
                className="max-w-[8.5rem] rounded-md border border-border bg-white px-2 py-2 text-xs sm:max-w-[11rem] sm:px-3 sm:text-sm md:max-w-none"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <div className="hidden items-center gap-4 text-xs font-semibold text-muted-foreground md:flex">
                <div className="flex flex-col text-right">
                  <span className="uppercase tracking-[0.2em]">Cap Space</span>
                  <span className="text-sm text-foreground">{formattedCapSpace}</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col text-right">
                  <span className="uppercase tracking-[0.2em]">Roster</span>
                  <span className="text-sm text-foreground">{formattedRoster}</span>
                </div>
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

          <main className="flex-1 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 md:px-8">
            <div
              className="mb-6 rounded-2xl border border-transparent p-5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--team-primary) 6%, transparent)',
              }}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Next Action
              </p>
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Finalize depth chart for week one.</h2>
                  <p className="text-sm text-muted-foreground">
                    Review roster health and confirm your starters.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-900"
                  style={{ backgroundColor: 'var(--team-secondary)' }}
                >
                  Review lineup
                </button>
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </TeamThemeProvider>
  );
}
