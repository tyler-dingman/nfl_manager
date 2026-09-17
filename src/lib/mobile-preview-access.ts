import { jwtVerify } from 'jose';

// Login bootstraps remain reachable; account authorization stays in each API handler.
export function isMobileAuthRoute(path: string) {
  return (
    [
      '/api/auth/config',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/mobile/exchange',
    ].includes(path) ||
    /^\/api\/auth\/social\/(apple|google|facebook)\/(start|callback|exchange)$/.test(path)
  );
}
export async function hasMobilePreviewAccess(path: string, authorization: string | null) {
  if (
    !path.startsWith('/api/') ||
    !authorization?.startsWith('Bearer ') ||
    !process.env.AUTH_JWT_SECRET
  )
    return false;
  try {
    const { payload } = await jwtVerify(
      authorization.slice(7),
      new TextEncoder().encode(process.env.AUTH_JWT_SECRET),
      {
        algorithms: ['HS256'],
        issuer: 'down-distance',
        audience: 'down-distance-api',
      },
    );
    return Boolean(payload.sub && typeof payload.sid === 'string');
  } catch {
    return false;
  }
}
