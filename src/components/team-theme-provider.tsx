'use client';

import type { CSSProperties, ReactNode } from 'react';

import type { Team } from '@/features/team/team-store';
import { ensureAccessibleTextColor, getReadableTextColor } from '@/lib/color-utils';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

const SITE_SURFACE = '#f7f4ee';

const toTeamStyle = (team?: Team): CSSProperties => {
  const theme = getTeamBrandTheme(team?.abbr);
  const { primary, secondary, dark, light } = theme;
  const primaryForeground = getReadableTextColor(primary);
  const secondaryForeground = getReadableTextColor(secondary);
  const darkForeground = getReadableTextColor(dark);
  const lightForeground = getReadableTextColor(light);
  return {
    '--primary': primary,
    '--secondary': secondary,
    '--dark': dark,
    '--light': light,
    '--team-primary': primary,
    '--team-secondary': secondary,
    '--team-dark': dark,
    '--team-light': light,
    '--brand-primary': primary,
    '--brand-secondary': secondary,
    '--brand-dark': dark,
    '--brand-light': light,
    '--team-primary-foreground': primaryForeground,
    '--team-on-primary': primaryForeground,
    '--team-on-secondary': secondaryForeground,
    '--team-on-dark': darkForeground,
    '--team-on-light': lightForeground,
    '--team-primary-text': ensureAccessibleTextColor(primary, SITE_SURFACE),
    '--team-secondary-text': ensureAccessibleTextColor(secondary, SITE_SURFACE),
    '--team-primary-on-dark': ensureAccessibleTextColor(primary, dark),
    '--team-secondary-on-dark': ensureAccessibleTextColor(secondary, dark),
    '--team-secondary-on-primary': ensureAccessibleTextColor(secondary, primary),
    '--team-light-on-dark': ensureAccessibleTextColor(light, dark),
  } as CSSProperties;
};

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
