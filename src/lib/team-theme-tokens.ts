import displayAccents from '../../public/assets/the-beat-asset-library/config/team-accents.json';
import {
  ensureAccessibleTextColor,
  getContrastRatio,
  getReadableTextColor,
  mixHexColors,
} from '@/lib/color-utils';
import { TEAM_BRAND_THEMES, getTeamBrandTheme } from '@/lib/team-brand-themes';

export type TeamThemeTokens = {
  primary: string;
  primaryFill: string;
  onPrimary: '#ffffff' | '#000000';
};

export type FrontOfficeTeamTheme = {
  navBackground: string;
  navForeground: '#ffffff' | '#000000';
  navMutedForeground: string;
  navActiveIndicator: string;
  interactive: string;
  interactiveForeground: '#ffffff' | '#000000';
  interactiveText: string;
  interactiveHover: string;
  accent: string;
  borderAccent: string;
};

export function getTeamThemeTokens(teamAbbr?: string | null): TeamThemeTokens {
  const theme = getTeamBrandTheme(teamAbbr);
  // Chiefs brand red is slightly too light for white body text (4.23:1). Filled controls use
  // the official darker Chiefs red so the mandated white foreground reaches WCAG AA (4.72:1).
  const forceWhiteOnRed = !teamAbbr || teamAbbr.toUpperCase() === 'KC';
  const primaryFill = forceWhiteOnRed ? (!teamAbbr ? '#D71936' : theme.dark) : theme.primary;
  const onPrimary = forceWhiteOnRed ? '#ffffff' : getReadableTextColor(primaryFill);
  if (getContrastRatio(onPrimary, primaryFill) < 4.5)
    throw new Error(`Unsafe team primary color pair for ${teamAbbr ?? 'default'}.`);
  return { primary: theme.primary, primaryFill, onPrimary };
}

export function getFrontOfficeTeamTheme(teamAbbr?: string | null): FrontOfficeTeamTheme {
  const brand = getTeamBrandTheme(teamAbbr);
  const { primaryFill } = getTeamThemeTokens(teamAbbr);
  const navBackground = '#091A20';
  const navForeground = getReadableTextColor(navBackground);
  const interactive = teamAbbr?.toUpperCase() === 'CHI' ? brand.secondary : primaryFill;
  const interactiveForeground = getReadableTextColor(interactive);
  const interactiveText = ensureAccessibleTextColor(interactive, '#0E232A');
  const interactiveHover = mixHexColors(
    interactive,
    interactiveForeground === '#ffffff' ? '#000000' : '#ffffff',
    0.12,
  );

  return {
    navBackground,
    navForeground,
    navMutedForeground: '#A8BAC4',
    navActiveIndicator: ensureAccessibleTextColor(interactive, navBackground, 3),
    interactive,
    interactiveForeground,
    interactiveText,
    interactiveHover,
    accent: interactiveText,
    borderAccent: interactive,
  };
}

/** Filled pick controls always use white text, retaining the owner's primary hue. */
export function getAccessibleTeamPickColor(teamAbbr: string): string {
  if (!TEAM_BRAND_THEMES[teamAbbr.toUpperCase()]) {
    if (process.env.NODE_ENV === 'development')
      console.warn(`Missing pick owner theme: ${teamAbbr}`);
    return '#00172b';
  }
  return ensureAccessibleTextColor(getTeamThemeTokens(teamAbbr).primaryFill, '#ffffff');
}

/** Existing bright team palette for display text on near-black hero surfaces. */
export function getTeamDisplayAccent(teamAbbr?: string | null) {
  const abbr = teamAbbr?.toUpperCase() ?? '';
  const configured = displayAccents.teams[abbr as keyof typeof displayAccents.teams];
  if (!configured) return '#FFFFFF';
  // Minnesota's fan headline uses their purple rather than the gold secondary accent.
  const accent = abbr === 'MIN' ? getTeamBrandTheme(abbr).primary : configured.accent;
  return ensureAccessibleTextColor(accent, '#070a0d', 3);
}
