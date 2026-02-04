'use client';

import { useMemo, useState } from 'react';

import TeamThemeProvider from '@/components/team-theme-provider';
import { useTeamStore } from '@/features/team/team-store';

const navSections = [
  {
    title: 'Home',
    items: ['Overview', 'Schedule', 'Analytics'],
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0],
    [selectedTeamId, teams],
  );

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
            {navSections.map((section, sectionIndex) => (
              <div key={section.title} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item, itemIndex) => {
                    const isActive = sectionIndex === 0 && itemIndex === 0;
                    return (
                      <button
                        key={item}
                        type="button"
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
                      </button>
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
              <div className="hidden flex-col md:flex">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Active Team
                </span>
                <span className="text-sm font-semibold">{selectedTeam?.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:block">
                Switch
              </label>
              <select
                className="rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

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
