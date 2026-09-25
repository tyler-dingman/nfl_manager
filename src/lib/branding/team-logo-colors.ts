import referenceThemes from '../../../public/images/team_branded_logos/down-distance-team-colors.json';
import logoOverrides from './team-logo-overrides.json';
import {
  DEFAULT_TEAM_BRAND_THEME,
  getTeamBrandTheme,
  TEAM_BRANDED_LOGO_URLS,
} from '../team-brand-themes';

export type TeamLogoColors = {
  border: string;
  background: string;
  badge: string;
  ticks: string;
  lettering: string;
  ampersand: string;
};

const referencePalettes = Object.fromEntries(
  Object.entries(referenceThemes).map(([name, palette]) => [
    name.toLowerCase().replaceAll(' ', '-'),
    palette,
  ]),
);

export function getTeamLogoColors(team?: string | null): TeamLogoColors {
  const abbr = team?.toUpperCase() ?? '';
  const filename = TEAM_BRANDED_LOGO_URLS[abbr]
    ?.split('/')
    .pop()
    ?.replace('down-distance-', '')
    .replace('.png', '');
  const reference = filename ? referencePalettes[filename] : undefined;
  if (!reference) {
    return {
      border: DEFAULT_TEAM_BRAND_THEME.light,
      background: '#00172B',
      badge: DEFAULT_TEAM_BRAND_THEME.primary,
      ticks: DEFAULT_TEAM_BRAND_THEME.primary,
      lettering: DEFAULT_TEAM_BRAND_THEME.light,
      ampersand: '#00172B',
    };
  }
  const theme = getTeamBrandTheme(abbr);
  // Prefer the UI token whenever it agrees with the original artwork palette.
  const secondary = reference.secondary === theme.secondary ? theme.secondary : reference.secondary;
  const overrides = logoOverrides[abbr as keyof typeof logoOverrides];
  // ARI/ATL/BAL/CIN intentionally use canonical team colors: their old PNGs
  // are incorrect artwork and must not supply sampled logo overrides.
  const background = ['NO', 'PIT'].includes(abbr) ? theme.dark : (overrides?.background ?? theme.dark);
  const badge = ['ARI', 'BAL', 'CAR', 'CIN', 'DEN', 'DET', 'NO', 'PIT', 'TB'].includes(abbr) ? theme.primary : secondary;
  return {
    border: abbr === 'DEN' ? theme.light : secondary,
    background,
    badge,
    ticks: ['ATL', 'DEN'].includes(abbr) ? theme.primary : secondary,
    lettering: overrides ? '#FAFAFA' : theme.light,
    ampersand: ['ARI', 'BAL'].includes(abbr)
      ? theme.light
      : abbr === 'ATL'
        ? theme.primary
        : background,
  };
}
