import { LOGO_PATHS } from './team-logo-paths';
import type { TeamLogoColors } from './team-logo-colors';

// Paths 3 and 5 each contain disconnected regions with different colors in
// ARI/ATL/BAL/CIN. Clip at empty space; never rewrite their path coordinates.
export const LOGO_CLIPS = {
  badge: { x: 1100, y: 0, width: 494, height: 600 },
  ticks: { x: 0, y: 600, width: 1594, height: 206 },
  counters: { x: 0, y: 0, width: 1100, height: 806 },
} as const;
export const LOGO_REGIONS: {
  path: number;
  color: keyof TeamLogoColors;
  clip?: keyof typeof LOGO_CLIPS;
}[] = [
  { path: 0, color: 'border' },
  { path: 1, color: 'background' },
  { path: 2, color: 'badge', clip: 'badge' },
  { path: 2, color: 'ticks', clip: 'ticks' },
  { path: 3, color: 'lettering' },
  { path: 4, color: 'background', clip: 'counters' },
  { path: 4, color: 'ampersand', clip: 'badge' },
  { path: 5, color: 'badge' },
];
export { LOGO_PATHS };
