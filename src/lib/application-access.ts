/** Public pages do not require a Down & Distance account. APIs enforce their own auth. */
export function requiresApplicationSession(pathname: string) {
  return !(
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    ['/assets/', '/audio/', '/images/', '/fonts/', '/ads/'].some((path) =>
      pathname.startsWith(path),
    ) ||
    ['/login', '/preview', '/merch', '/promos'].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    [
      '/robots.txt',
      '/sitemap.xml',
      '/favicon.png',
      '/favicon.ico',
      '/icon.png',
      '/apple-icon.png',
    ].includes(pathname)
  );
}
