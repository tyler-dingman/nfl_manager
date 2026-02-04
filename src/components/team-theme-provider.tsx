'use client';

import type { CSSProperties, ReactNode } from 'react';

import type { Team } from '@/features/team/team-store';

const toTeamStyle = (team?: Team): CSSProperties => ({
  '--team-primary': team?.color_primary ?? '#1f2937',
  '--team-secondary': team?.color_secondary ?? '#4b5563',
} as CSSProperties);

export default function TeamThemeProvider({
  team,
  children,
}: {
  team?: Team;
  children: ReactNode;
}) {
  return (
    <div style={toTeamStyle(team)} className="min-h-screen">
      {children}
    </div>
  );
}
