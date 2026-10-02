import { getTeamBrandTheme } from '../../../src/lib/team-brand-themes';
import { getTeamThemeTokens } from '../../../src/lib/team-theme-tokens';
import { useTeam } from './team-context';

export function useTeamBranding() {
  const { teamId } = useTeam();
  const brand = getTeamBrandTheme(teamId);
  const theme = { ...brand, ...getTeamThemeTokens(teamId) };

  return {
    teamId,
    theme,
  };
}
