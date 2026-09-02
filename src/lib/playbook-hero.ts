import { lightenHexColor } from '@/lib/color-utils';
import { getTeamBrandTheme, type TeamBrandTheme } from '@/lib/team-brand-themes';

export type HeroPalette = {
  background: string;
  chalk: string;
  primaryRoute: string;
  secondaryRoute: string;
  cta: string;
  ctaText: string;
  muted: string;
};

const background = '#171a18';
const chalk = '#f2e7d2';

const channels = (hex: string) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
};

const luminance = (hex: string) => {
  const linear = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

export const contrastRatio = (first: string, second: string) => {
  const [bright, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (bright + 0.05) / (dark + 0.05);
};

const accessibleRoute = (color: string, fallback: string) => {
  let candidate = color;
  for (let step = 0; step < 5 && contrastRatio(candidate, background) < 3; step += 1) {
    candidate = lightenHexColor(candidate, 0.18);
  }
  if (contrastRatio(candidate, background) < 3) candidate = fallback;
  for (let step = 0; step < 5 && contrastRatio(candidate, background) < 3; step += 1) {
    candidate = lightenHexColor(candidate, 0.18);
  }
  return candidate;
};

export function getHeroPalette(teamAbbr?: string | null): HeroPalette {
  const theme: TeamBrandTheme = getTeamBrandTheme(teamAbbr);
  const primaryRoute = accessibleRoute(theme.primary, theme.secondary);
  const secondaryRoute = accessibleRoute(theme.secondary, chalk);
  const darkText = '#000000';
  const lightText = '#ffffff';
  return {
    background,
    chalk,
    primaryRoute,
    secondaryRoute,
    cta: primaryRoute,
    ctaText:
      contrastRatio(primaryRoute, darkText) >= contrastRatio(primaryRoute, lightText)
        ? darkText
        : lightText,
    muted: '#b9b8ad',
  };
}

export function getPlaybookDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getDeterministicPlayIndex(teamAbbr: string, dayKey: string, count = 6) {
  let hash = 2166136261;
  for (const character of `${teamAbbr.toUpperCase()}:${dayKey}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % count;
}
