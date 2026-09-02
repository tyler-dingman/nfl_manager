export function getOffseasonManagerRoute(
  subpath: string = '',
  teamAbbr?: string | null,
) {
  const normalized = teamAbbr?.trim();
  const query = normalized ? `?team=${encodeURIComponent(normalized.toUpperCase())}` : '';
  const basePath = `/offseasonmanager${subpath}`;
  return `${basePath}${query}`;
}

export function getOffseasonManagerHref(teamAbbr?: string | null) {
  return getOffseasonManagerRoute('', teamAbbr);
}
