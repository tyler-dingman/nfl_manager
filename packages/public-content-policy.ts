/** Only routes audited to ignore identity may use anonymous shared caching.
 * Unknown parameters fail closed instead of creating unbounded cache keys. */
export function publicContentPath(path: string): string | null {
  const url = new URL(path, 'https://public.invalid');
  if (url.origin !== 'https://public.invalid') return null;
  if (
    url.pathname === '/api/teams' ||
    /^\/api\/mobile\/stories\/[A-Za-z0-9_-]{1,160}$/.test(url.pathname)
  )
    return url.search ? null : url.pathname;
  if (url.pathname === '/api/parlay-lab/research') {
    const allowed = ['eventId', 'lineMode', 'period'];
    const keys = [...url.searchParams.keys()];
    const event = url.searchParams.get('eventId'),
      mode = url.searchParams.get('lineMode') ?? 'all',
      period = url.searchParams.get('period') ?? 'game';
    if (
      keys.some((k) => !allowed.includes(k)) ||
      new Set(keys).size !== keys.length ||
      !event ||
      event === 'ALL' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(event) ||
      !['all', 'standard', 'alternate'].includes(mode) ||
      period !== 'game'
    )
      return null;
    return url.pathname + '?eventId=' + event + '&lineMode=' + mode + '&period=game';
  }
  const teamRoutes = new Set([
    '/api/content/homepage',
    '/api/content/wire',
    '/api/film-room',
    '/api/three-and-out',
  ]);
  if (url.pathname === '/api/parlay-lab/events') return url.search ? null : url.pathname;
  if (!teamRoutes.has(url.pathname)) return null;
  const keys = [...url.searchParams.keys()];
  if (
    keys.some((k) => k !== 'team' && !(k === 'date' && url.pathname === '/api/three-and-out')) ||
    new Set(keys).size !== keys.length
  )
    return null;
  const team = url.searchParams.get('team')?.toUpperCase();
  if (
    !team ||
    !/^(ARI|ATL|BAL|BUF|CAR|CHI|CIN|CLE|DAL|DEN|DET|GB|HOU|IND|JAX|KC|LAC|LAR|LV|MIA|MIN|NE|NO|NYG|NYJ|PHI|PIT|SEA|SF|TB|TEN|WAS|NFL)$/.test(
      team,
    )
  )
    return null;
  if (team === 'NFL' && url.pathname !== '/api/film-room') return null;
  const date = url.searchParams.get('date');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return url.pathname + '?team=' + team + (date ? '&date=' + date : '');
}
