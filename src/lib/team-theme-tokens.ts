import { getContrastRatio, getReadableTextColor } from '@/lib/color-utils';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

export type TeamThemeTokens = {
  primary: string;
  primaryFill: string;
  onPrimary: '#ffffff' | '#000000';
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
