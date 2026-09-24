export const FRONT_OFFICE_NAVIGATION = {
  ownership: [
    { label: 'Ownership Central', href: '/front-office/ownership', key: 'central' },
    { label: 'Stadium', href: '/front-office/ownership/stadium', key: 'stadium' },
    { label: 'Facilities', href: '/front-office/ownership/facilities', key: 'facilities' },
    { label: 'Business', href: '/front-office/ownership/business', key: 'business' },
    { label: 'Fans', href: '/front-office/ownership/fans', key: 'fans' },
    { label: 'Report Card', href: '/front-office/ownership/report-card', key: 'report-card' },
    { label: 'Legacy', href: '/front-office/ownership/legacy', key: 'legacy' },
  ],
  roster: [
    { label: 'Roster Central', href: '/roster?view=roster', key: 'roster-central' },
    { label: 'Depth Chart', href: '/roster?view=depth', key: 'depth-chart' },
    { label: 'Contracts', href: '/roster?view=resign', key: 'contracts' },
    { label: 'Free Agency', href: '/free-agents', key: 'free-agency' },
    { label: 'Trade Hub', href: '/front-office/trade-hub?context=roster', key: 'trade-hub' },
    { label: 'Practice Squad', href: '/roster?view=practice-squad', key: 'practice-squad' },
  ],
  draft: [
    { label: 'Draft Central', href: '/front-office/draft', key: 'draft-central' },
    { label: 'Mock Draft', href: '/front-office/draft/room?mode=mock', key: 'mock-draft' },
    { label: 'Big Board', href: '/front-office/draft/big-board', key: 'big-board' },
    { label: 'Draft Guide', href: '/front-office/draft/scouting', key: 'draft-guide' },
    { label: 'Position Rankings', href: '/front-office/draft/prospects', key: 'position-rankings' },
    { label: 'Team Needs', href: '/front-office/draft/team-needs', key: 'team-needs' },
    { label: 'Trade Machine', href: '/front-office/trade-hub', key: 'trade-machine' },
    { label: 'My Drafts', href: '/front-office/draft/history', key: 'my-drafts' },
  ],
  league: [
    { label: 'League Central', href: '/league', key: 'league-central' },
    { label: 'News', href: '/front-office/league/news', key: 'news' },
    { label: 'Standings', href: '/front-office/league/standings', key: 'standings' },
    { label: 'Schedule', href: '/front-office/league/schedule', key: 'schedule' },
    { label: 'Transactions', href: '/league?view=transactions', key: 'transactions' },
  ],
} as const;

export type FrontOfficeSection = keyof typeof FRONT_OFFICE_NAVIGATION;

export const FRONT_OFFICE_ROUTES = {
  Roster: FRONT_OFFICE_NAVIGATION.roster[0].href,
  Draft: FRONT_OFFICE_NAVIGATION.draft[0].href,
  League: FRONT_OFFICE_NAVIGATION.league[0].href,
  Settings: '/front-office/settings',
} as const;

export const FRONT_OFFICE_ROSTER_ROUTES = Object.fromEntries(
  FRONT_OFFICE_NAVIGATION.roster.map(({ label, href }) => [label, href]),
) as Record<(typeof FRONT_OFFICE_NAVIGATION.roster)[number]['label'], string>;
export const FRONT_OFFICE_DRAFT_ROUTES = Object.fromEntries(
  FRONT_OFFICE_NAVIGATION.draft.map(({ label, href }) => [label, href]),
) as Record<(typeof FRONT_OFFICE_NAVIGATION.draft)[number]['label'], string>;
export const FRONT_OFFICE_LEAGUE_ROUTES = Object.fromEntries(
  FRONT_OFFICE_NAVIGATION.league.map(({ label, href }) => [label, href]),
) as Record<(typeof FRONT_OFFICE_NAVIGATION.league)[number]['label'], string>;

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
