import { getTeamThemeTokens, getTeamDisplayAccent } from '../../../src/lib/team-theme-tokens';
import { ensureAccessibleTextColor, mixHexColors } from '../../../src/lib/color-utils';

/** Shared post-selection roles, derived entirely from the canonical team palette. */
export function getOnboardingTheme(team: string) {
  const primary = getTeamThemeTokens(team);
  const accent = ensureAccessibleTextColor(getTeamDisplayAccent(team), '#061a22', 4.5);
  return {
    accent,
    primaryCTA: primary.primaryFill,
    onPrimary: primary.onPrimary,
    selectedBorder: accent,
    selectedBackground: mixHexColors('#061a22', accent, 0.09),
    icon: accent,
    link: accent,
    progress: accent,
  };
}
