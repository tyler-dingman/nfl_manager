'use client';

import type { CSSProperties, ReactNode } from 'react';

import type { Team } from '@/features/team/team-store';
import { getReadableTextColor } from '@/lib/color-utils';

const normalizeHex = (value: string) => {
  const trimmed = value.trim().replace('#', '');
  if (trimmed.length === 3) {
    return trimmed
      .split('')
      .map((char) => char + char)
      .join('');
  }
  return trimmed;
};

const getLuminance = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (normalized.length !== 6) {
    return 0;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const toLinear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
};

const getOnColor = (hex: string) => (getLuminance(hex) > 0.5 ? '#0f172a' : '#ffffff');

const toTeamStyle = (team?: Team): CSSProperties => {
  const primary = team?.color_primary ?? '#1f2937';
  const secondary = team?.color_secondary ?? '#4b5563';
  const primaryForeground = getReadableTextColor(primary);
  return {
    '--team-primary': primary,
    '--team-secondary': secondary,
    '--team-primary-foreground': primaryForeground,
    '--team-on-primary': primaryForeground,
    '--team-on-secondary': getOnColor(secondary),
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
