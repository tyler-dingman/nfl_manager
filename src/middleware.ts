import { NextResponse, type NextRequest } from 'next/server';

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
  return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/.test(origin)
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appOrigin = pathname.startsWith('/api/')
    ? developmentAppOrigin(request.headers.get('origin'))
    : null;

  if (appOrigin) {
    if (request.method === 'OPTIONS')
      return withDevelopmentCors(new NextResponse(null, { status: 204 }), appOrigin);
    return withDevelopmentCors(NextResponse.next(), appOrigin);
  }

  if (pathname.startsWith(`${TOOL_PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(TOOL_PREFIX.length);
    return NextResponse.rewrite(url);
  }

  if (TOOL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = `${TOOL_PREFIX}${pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/((?!api|_next/static|_next/image|images|ads|favicon.ico).*)'],
};
