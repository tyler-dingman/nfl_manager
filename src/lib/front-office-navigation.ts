export const FRONT_OFFICE_ROUTES = {
  Overview: '/experience',
  Roster: '/roster?view=roster',
  Contracts: '/roster?view=contracts',
  'Cap Space': '/cap-space',
  'Depth Chart': '/roster?view=depth',
  'Re-sign/Cut Players': '/roster?view=resign',
  'Trade Hub': '/manage/trades',
  'Free Agency': '/free-agents',
  'Draft Board': '/draft/room?mode=mock',
} as const;

export type FrontOfficeNavItem = keyof typeof FRONT_OFFICE_ROUTES;

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
