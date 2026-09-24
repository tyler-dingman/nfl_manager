import { getTeamBrandTheme } from '../../../src/lib/team-brand-themes';
import { getReadableTextColor } from '../../../src/lib/color-utils';
import { useTeam } from './team-context';

export function useTeamBranding() {
  const { teamId } = useTeam();
  const brand = getTeamBrandTheme(teamId);
  const forceWhiteOnRed = teamId.toUpperCase() === 'KC';
  const primaryFill = forceWhiteOnRed ? brand.dark : brand.primary;
  const theme = {
    ...brand,
    primaryFill,
    onPrimary: forceWhiteOnRed ? ('#ffffff' as const) : getReadableTextColor(primaryFill),
  };

  return {
    teamId,
    theme,
  };
}
