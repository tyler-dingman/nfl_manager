import { NextResponse, type NextRequest } from 'next/server';
import { PREVIEW_COOKIE, prelaunchEnabled, verifyPreviewToken } from '@/lib/prelaunch';
import { hasMobilePreviewAccess, isMobileAuthRoute } from '@/lib/mobile-preview-access';
import { requiresApplicationSession } from '@/lib/application-access';
import { SESSION_COOKIE } from '@/server/auth/http';

const TOOL_PREFIX = '/offseasonmanager';
const TOOL_ROUTES = [
  '/experience',
  '/roster',
  '/manage-team',
  '/manage',
  '/free-agents',
  '/draft',
  '/cap-space',
  '/offseason-recap',
  '/sim-season',
  '/season-recap',
  '/teams',
  '/start',
];

function developmentAppOrigin(origin: string | null) {
  if (process.env.NODE_ENV !== 'development' || !origin) return null;
  return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/.test(
    origin,
  )
    ? origin
    : null;
}

function withDevelopmentCors(response: NextResponse, origin: string) {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  response.headers.set('Vary', 'Origin');
  return response;
}

const PUBLIC_PRELAUNCH_ROUTES = new Set([
  '/preview',
  '/preview/logout',
  '/login',
  '/robots.txt',
  '/api/preview/access',
  '/api/automation/content',
  '/api/automation/content/global',
  // Automation handlers enforce their own Bearer-token authentication.
  '/api/automation/three-and-out',
  '/api/commerce/stripe/webhook',
]);

function noIndex(response: NextResponse) {
  if (prelaunchEnabled()) response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    prelaunchEnabled() &&
    !PUBLIC_PRELAUNCH_ROUTES.has(pathname) &&
    !pathname.startsWith('/api/auth/') &&
    !isMobileAuthRoute(pathname)
  ) {
    const authorized =
      (await verifyPreviewToken(request.cookies.get(PREVIEW_COOKIE)?.value)) ||
      (await hasMobilePreviewAccess(pathname, request.headers.get('authorization')));
    if (!authorized) {
      if (pathname.startsWith('/api/'))
        return noIndex(
          NextResponse.json(
            { ok: false, error: 'Private preview access required.' },
            { status: 401 },
          ),
        );
      const url = request.nextUrl.clone();
      url.pathname = '/preview';
      url.search = '';
      url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return noIndex(NextResponse.redirect(url));
    }
  }

  if (requiresApplicationSession(pathname)) {
    let authenticated = false;
    if (request.cookies.get(SESSION_COOKIE)?.value) {
      try {
        // Session tokens are opaque and revocable. Let the existing Node auth handler
        // validate them against the database rather than treating a cookie as proof.
        const session = await fetch(new URL('/api/auth/me', request.url), {
          headers: { cookie: request.headers.get('cookie') ?? '' },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        if (session.status !== 401 && !session.ok) throw new Error('Session lookup failed');
        if (session.ok) {
          const body = await session.json();
          authenticated = body.ok === true && Boolean(body.user?.id);
        }
      } catch {
        console.error('[application-auth] Session lookup unavailable', { pathname });
        return noIndex(
          new NextResponse('Sign-in verification is temporarily unavailable. Please retry.', {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
          }),
        );
      }
    }
    if (!authenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      const response = NextResponse.redirect(url);
      response.headers.set('Cache-Control', 'no-store');
      return noIndex(response);
    }
  }

  const appOrigin = pathname.startsWith('/api/')
    ? developmentAppOrigin(request.headers.get('origin'))
    : null;

  if (appOrigin) {
    if (request.method === 'OPTIONS')
      return noIndex(withDevelopmentCors(new NextResponse(null, { status: 204 }), appOrigin));
    return noIndex(withDevelopmentCors(NextResponse.next(), appOrigin));
  }

  if (pathname.startsWith(`${TOOL_PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(TOOL_PREFIX.length);
    return noIndex(NextResponse.rewrite(url));
  }

  if (TOOL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = `${TOOL_PREFIX}${pathname}`;
    return noIndex(NextResponse.redirect(url));
  }

  return noIndex(NextResponse.next());
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!api|_next/static|_next/image|images|fonts|ads|favicon.ico|icon.png|apple-icon.png|robots.txt).*)',
  ],
};
