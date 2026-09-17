import {
  ensureAccessibleTextColor,
  getContrastRatio,
  getReadableTextColor,
  mixHexColors,
} from '@/lib/color-utils';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

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
  const navBackground = primaryFill;
  const navForeground = getReadableTextColor(navBackground);
  const interactive = primaryFill;
  const interactiveForeground = getReadableTextColor(interactive);
  const interactiveText = ensureAccessibleTextColor(interactive, '#f7f4ee');
  const interactiveHover = mixHexColors(
    interactive,
    interactiveForeground === '#ffffff' ? '#000000' : '#ffffff',
    0.12,
  );

  return {
    navBackground,
    navForeground,
    navMutedForeground: ensureAccessibleTextColor(brand.light, navBackground),
    navActiveIndicator: ensureAccessibleTextColor(brand.secondary, navBackground, 3),
    interactive,
    interactiveForeground,
    interactiveText,
    interactiveHover,
    accent: brand.secondary,
    borderAccent: interactive,
  };
}
