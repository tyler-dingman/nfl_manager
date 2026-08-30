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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ['/((?!api|_next/static|_next/image|images|ads|favicon.ico).*)'],
};
