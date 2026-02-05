'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import TeamThemeProvider from '@/components/team-theme-provider';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';

const navRoutes = {
  Overview: '/overview',
  Roster: '/manage/roster',
  'Free Agents': '/manage/free-agents',
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
  const capSpace = useSaveStore((state) => state.capSpace);
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const pathname = usePathname();

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

      const response = await fetch('/api/saves/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam.id, teamAbbr: selectedTeam.abbr }),
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as
        | { ok: true; saveId: string; teamAbbr: string; capSpace: number; capLimit: number; rosterCount: number; rosterLimit: number; phase: string }
        | { ok: false; error: string };
      if (!data.ok) {
        return;
      }

      setSaveHeader(data, selectedTeam.id);
    };

    loadSave();
  }, [selectedTeam?.abbr, selectedTeam?.id, setSaveHeader]);

  return (
    <TeamThemeProvider team={selectedTeam}>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="hidden w-64 flex-col gap-6 border-r border-border bg-white/80 px-5 py-6 md:flex">
          <div
            className="rounded-xl border border-transparent p-4"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--team-primary) 8%, transparent)',
            }}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Team
            </p>
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
                        aria-current={isActive ? 'page' : undefined}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        <span
                          className="h-6 w-1 rounded-full"
                          style={{
                            backgroundColor: isActive
                              ? 'var(--team-primary)'
                              : 'transparent',
                          }}
                        />
                        <span className={isActive ? 'text-foreground' : undefined}>
                          {item}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b border-border bg-white/80 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
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
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Active Team
                </span>
                <span className="text-sm font-semibold">{selectedTeam?.name}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Switch
              </label>
              <select
                className="min-w-[180px] flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm sm:flex-none"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <div className="flex w-full items-center gap-4 text-xs font-semibold text-muted-foreground sm:w-auto md:ml-2">
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
                  <span className="text-sm font-semibold text-muted-foreground">
                    JD
                  </span>
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
              className="mb-6 rounded-2xl border border-transparent p-5"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--team-primary) 6%, transparent)',
              }}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Next Action
              </p>
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Finalize depth chart for week one.
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Review roster health and confirm your starters.
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full rounded-full px-4 py-2 text-sm font-semibold text-slate-900 md:w-auto"
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
