export const PRIMARY_NAV_ITEMS = [
  { id: 'huddle', label: 'The Huddle', href: '/huddle' },
  { id: 'three-and-out', label: 'Three and Out', href: '/three-and-out' },
  { id: 'watch', label: 'Watch', href: '/watch' },
  { id: 'front-office', label: 'Front Office', href: '/offseasonmanager' },
  { id: 'trivia', label: 'Trivia', href: '/trivia' },
  { id: 'merch', label: 'Merch', href: '/merch' },
] as const;

export type PrimaryNavItemId = (typeof PRIMARY_NAV_ITEMS)[number]['id'];

const FRONT_OFFICE_PATHS = [
  '/offseasonmanager',
  '/front-office',
  '/experience',
  '/manage-team',
  '/manage',
  '/roster',
  '/free-agents',
  '/draft',
  '/cap-space',
  '/offseason-recap',
  '/season-recap',
  '/sim-season',
];

const matchesPath = (pathname: string, basePath: string) =>
  pathname === basePath || pathname.startsWith(`${basePath}/`);

export function getPrimaryNavActive(pathname: string | null): PrimaryNavItemId | null {
  if (!pathname) return null;
  if (matchesPath(pathname, '/huddle') || matchesPath(pathname, '/story')) return 'huddle';
  if (matchesPath(pathname, '/three-and-out')) return 'three-and-out';
  if (matchesPath(pathname, '/watch')) return 'watch';
  if (FRONT_OFFICE_PATHS.some((path) => matchesPath(pathname, path))) return 'front-office';
  if (matchesPath(pathname, '/trivia')) return 'trivia';
  if (matchesPath(pathname, '/merch')) return 'merch';
  return null;
}

export function getPrimaryNavHref(href: string, teamAbbr?: string | null) {
  if (!teamAbbr || href === '/merch') return href;
  return `${href}?team=${encodeURIComponent(teamAbbr)}`;
}
