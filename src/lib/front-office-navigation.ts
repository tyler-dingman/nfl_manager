export const FRONT_OFFICE_ROUTES = {
  Roster: '/roster?view=roster',
  Draft: '/front-office/draft',
  League: '/front-office/league/news',
  Settings: '/front-office/settings',
} as const;

export const FRONT_OFFICE_ROSTER_ROUTES = {
  Roster: '/roster?view=roster',
  'Free Agents': '/free-agents',
  'Depth Chart': '/roster?view=depth',
  'Cap Space': '/roster?view=cap',
  'Re-sign/Cut Players': '/roster?view=resign',
  'Trade Hub': '/front-office/trade-hub',
} as const;

export const FRONT_OFFICE_DRAFT_ROUTES = {
  'Draft Central': '/front-office/draft',
  Prospects: '/front-office/draft/prospects',
  'My Big Board': '/front-office/draft/big-board',
  'Team Needs': '/front-office/draft/team-needs',
  'Mock Drafts': '/front-office/draft/mock-drafts',
  'Draft History': '/front-office/draft/history',
  'Scouting Reports': '/front-office/draft/scouting',
  'Draft Room': '/front-office/draft/room',
} as const;

export const FRONT_OFFICE_LEAGUE_ROUTES = {
  News: '/front-office/league/news',
  Standings: '/front-office/league/standings',
  Schedule: '/front-office/league/schedule',
  Transactions: '/league?view=transactions',
  Injuries: '/league?view=injuries',
  'League Leaders': '/league?view=stats',
} as const;

export type FrontOfficeNavItem = keyof typeof FRONT_OFFICE_ROUTES;
export type FrontOfficeRosterNavItem = keyof typeof FRONT_OFFICE_ROSTER_ROUTES;
export type FrontOfficeDraftNavItem = keyof typeof FRONT_OFFICE_DRAFT_ROUTES;
export type FrontOfficeLeagueNavItem = keyof typeof FRONT_OFFICE_LEAGUE_ROUTES;

export function isFrontOfficeRouteActive(
  itemHref: string,
  pathname: string,
  params: Pick<URLSearchParams, 'get'>,
) {
  const [hrefPath, hrefQuery] = itemHref.split('?');
  return (
    pathname === hrefPath &&
    (!hrefQuery ||
      hrefQuery.split('&').every((entry) => {
        const [key, value] = entry.split('=');
        return params.get(key) === value;
      }))
  );
}
